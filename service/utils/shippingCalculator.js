const ShippingConfig = require('../models/ShippingConfig');

/**
 * Tính khoảng cách đường chim bay Haversine (km)
 */
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Bán kính Trái Đất (km)
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(2));
}

/**
 * Gọi OSRM public API để lấy khoảng cách đường bộ thực tế (km) và GeoJSON route
 */
async function getOSRMRoute(lat1, lon1, lat2, lon2) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4500);

    // OSRM format: /route/v1/driving/{lon1},{lat1};{lon2},{lat2}
    const url = `https://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=full&geometries=geojson`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'EvergreenMart-Shipping/1.0 (contact@xanhla.vn)',
      },
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const distanceKm = Number((route.distance / 1000).toFixed(2));
        const durationMin = Math.round(route.duration / 60);
        return {
          success: true,
          distanceKm,
          durationMin,
          geometry: route.geometry,
          source: 'osrm',
        };
      }
    }
  } catch (err) {
    // Fallback nếu OSRM public API bận
  }

  // Fallback Haversine * 1.32 (hệ số uốn lượn đường phố TP.HCM)
  const haversine = calculateHaversineDistance(lat1, lon1, lat2, lon2);
  const estRoadKm = Number((haversine * 1.32).toFixed(2));
  return {
    success: true,
    distanceKm: estRoadKm,
    durationMin: Math.round(estRoadKm * 3.5) + 15,
    geometry: null,
    source: 'haversine_estimate',
  };
}

/**
 * Lấy hoặc tạo cấu hình mặc định trong MongoDB
 */
async function getOrCreateShippingConfig() {
  let config = await ShippingConfig.findOne({ key: 'default' });
  if (!config) {
    config = await ShippingConfig.create({
      key: 'default',
      warehouse: {
        name: 'Kho Nông Sản Evergreen Mart',
        address: 'Khu phố 6, Phường Linh Trung, TP. Thủ Đức, TP. Hồ Chí Minh',
        lat: 10.8703,
        lng: 106.7782,
      },
      distanceTiers: [
        { minKm: 0, maxKm: 2, fee: 15000, label: '0–2 km' },
        { minKm: 2, maxKm: 5, fee: 20000, label: 'Trên 2–5 km' },
        { minKm: 5, maxKm: 8, fee: 25000, label: 'Trên 5–8 km' },
        { minKm: 8, maxKm: 10, fee: 30000, label: 'Trên 8–10 km' },
      ],
      maxDeliveryRadiusKm: 10,
      orderDiscounts: [
        { minOrderValue: 499000, discountAmount: 15000, label: 'Đơn từ 499.000đ: giảm 15.000đ phí ship' },
        { minOrderValue: 299000, discountAmount: 10000, label: 'Đơn từ 299.000đ: giảm 10.000đ phí ship' },
        { minOrderValue: 199000, discountAmount: 5000,  label: 'Đơn từ 199.000đ: giảm 5.000đ phí ship' },
      ],
      foodPreservationPolicy: 'Ưu tiên giao nhanh trong ngày bằng xe chuyên dụng / túi giữ nhiệt bảo quản thực phẩm mát.',
      isServiceActive: true,
    });
  }
  return config;
}

/**
 * Tính toán phí vận chuyển hoàn chỉnh theo khoảng cách & giá trị đơn hàng
 */
async function calculateShipping(customerLat, customerLng, subtotal = 0, customConfig = null) {
  const config = customConfig || (await getOrCreateShippingConfig());
  const warehouse = config.warehouse || {
    lat: 10.8703,
    lng: 106.7782,
    address: 'Khu phố 6, Phường Linh Trung, TP. Thủ Đức, TP. Hồ Chí Minh',
  };

  const routeRes = await getOSRMRoute(warehouse.lat, warehouse.lng, customerLat, customerLng);
  const distanceKm = routeRes.distanceKm;

  // Kiểm tra bán kính tối đa
  const maxRadius = config.maxDeliveryRadiusKm || 10;
  if (distanceKm > maxRadius) {
    return {
      supported: false,
      distanceKm,
      maxAllowedKm: maxRadius,
      warehouse,
      routeGeometry: routeRes.geometry,
      baseFee: 0,
      discount: 0,
      finalFee: 0,
      message: `Khoảng cách giao hàng (${distanceKm} km) vượt quá bán kính tối đa ${maxRadius} km. Để đảm bảo độ tươi ngon nguyên vẹn của rau củ, thịt cá và thực phẩm mát, Evergreen Mart chỉ hỗ trợ giao hàng tận nơi trong phạm vi ${maxRadius} km. Quý khách có thể chọn phương thức "Đến lấy trực tiếp".`,
    };
  }

  // 1. Phí theo nấc khoảng cách
  let baseFee = 30000;
  let matchedTierLabel = 'Trên 8–10 km';

  if (distanceKm <= 2) {
    baseFee = 15000;
    matchedTierLabel = '0–2 km';
  } else if (distanceKm <= 5) {
    baseFee = 20000;
    matchedTierLabel = 'Trên 2–5 km';
  } else if (distanceKm <= 8) {
    baseFee = 25000;
    matchedTierLabel = 'Trên 5–8 km';
  } else if (distanceKm <= 10) {
    baseFee = 30000;
    matchedTierLabel = 'Trên 8–10 km';
  }

  // Nếu trong config có tiers tùy chỉnh từ admin:
  if (Array.isArray(config.distanceTiers) && config.distanceTiers.length > 0) {
    const sortedTiers = [...config.distanceTiers].sort((a, b) => a.maxKm - b.maxKm);
    for (const tier of sortedTiers) {
      if (distanceKm > tier.minKm && distanceKm <= tier.maxKm) {
        baseFee = tier.fee;
        matchedTierLabel = tier.label || `${tier.minKm}–${tier.maxKm} km`;
        break;
      }
    }
  }

  // 2. Ưu đãi theo giá trị đơn hàng
  // Dưới 199.000đ: không giảm
  // Từ 199.000đ: giảm 5.000đ
  // Từ 299.000đ: giảm 10.000đ
  // Từ 499.000đ: giảm 15.000đ
  let discountAmount = 0;
  let discountReason = 'Dưới 199.000đ: không áp dụng ưu đãi phí ship';

  const orderValue = Number(subtotal) || 0;
  if (orderValue >= 499000) {
    discountAmount = 15000;
    discountReason = 'Đơn hàng từ 499.000đ: giảm 15.000đ phí vận chuyển';
  } else if (orderValue >= 299000) {
    discountAmount = 10000;
    discountReason = 'Đơn hàng từ 299.000đ: giảm 10.000đ phí vận chuyển';
  } else if (orderValue >= 199000) {
    discountAmount = 5000;
    discountReason = 'Đơn hàng từ 199.000đ: giảm 5.000đ phí vận chuyển';
  }

  // Phí ship sau ưu đãi không được âm
  const finalFee = Math.max(0, baseFee - discountAmount);

  // 3. Thời gian giao hàng dự kiến
  let estimatedTime = '30 – 45 phút';
  if (distanceKm <= 3) {
    estimatedTime = '25 – 35 phút';
  } else if (distanceKm <= 6) {
    estimatedTime = '35 – 50 phút';
  } else {
    estimatedTime = '50 – 75 phút';
  }

  return {
    supported: true,
    distanceKm,
    durationMin: routeRes.durationMin,
    estimatedDeliveryTime: estimatedTime,
    baseFee,
    tierLabel: matchedTierLabel,
    discount: discountAmount,
    discountReason,
    finalFee,
    warehouse,
    routeGeometry: routeRes.geometry,
    foodPreservationPolicy: config.foodPreservationPolicy,
    message: `Khoảng cách ${distanceKm} km. Phí vận chuyển: ${finalFee.toLocaleString('vi-VN')}đ (Đã giảm ${discountAmount.toLocaleString('vi-VN')}đ ưu đãi).`,
  };
}

module.exports = {
  calculateHaversineDistance,
  getOSRMRoute,
  getOrCreateShippingConfig,
  calculateShipping,
};
