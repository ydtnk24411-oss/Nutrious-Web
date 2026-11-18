const ShippingConfig = require('../models/ShippingConfig');

const DEFAULT_WAREHOUSES = [
  // TP. Hồ Chí Minh
  {
    id: 'store-thuduc',
    name: 'Tổng kho Evergreen Mart Thủ Đức (Trụ sở chính)',
    address: 'Khu phố 6, Phường Linh Trung, TP. Thủ Đức, TP. Hồ Chí Minh',
    province: 'Thành phố Hồ Chí Minh',
    district: 'TP. Thủ Đức',
    lat: 10.8703,
    lng: 106.7782,
    phone: '0962 299 122',
    openingHours: '07:00 - 21:30',
    readyTime: 'Chuẩn bị hàng: 15 - 30 phút',
    isHeadquarter: true,
  },
  {
    id: 'store-q1',
    name: 'Cửa hàng Evergreen Mart Quận 1',
    address: '128 Hai Bà Trưng, Phường Đa Kao, Quận 1, TP. Hồ Chí Minh',
    province: 'Thành phố Hồ Chí Minh',
    district: 'Quận 1',
    lat: 10.7865,
    lng: 106.6998,
    phone: '028 3822 5588',
    openingHours: '07:30 - 21:30',
    readyTime: 'Chuẩn bị hàng: 15 - 30 phút',
  },
  {
    id: 'store-binhthanh',
    name: 'Cửa hàng Evergreen Mart Bình Thạnh',
    address: '45 Điện Biên Phủ, Phường 15, Quận Bình Thạnh, TP. Hồ Chí Minh',
    province: 'Thành phố Hồ Chí Minh',
    district: 'Quận Bình Thạnh',
    lat: 10.7981,
    lng: 106.7058,
    phone: '028 3514 6677',
    openingHours: '07:00 - 21:00',
    readyTime: 'Chuẩn bị hàng: 15 - 30 phút',
  },
  {
    id: 'store-q7',
    name: 'Cửa hàng Evergreen Mart Quận 7',
    address: '105 Nguyễn Thị Thập, Phường Tân Phú, Quận 7, TP. Hồ Chí Minh',
    province: 'Thành phố Hồ Chí Minh',
    district: 'Quận 7',
    lat: 10.7382,
    lng: 106.7196,
    phone: '028 5410 8899',
    openingHours: '07:30 - 21:30',
    readyTime: 'Chuẩn bị hàng: 15 - 30 phút',
  },
  {
    id: 'store-tanbinh',
    name: 'Cửa hàng Evergreen Mart Tân Bình',
    address: '32 Phổ Quang, Phường 2, Quận Tân Bình, TP. Hồ Chí Minh',
    province: 'Thành phố Hồ Chí Minh',
    district: 'Quận Tân Bình',
    lat: 10.8038,
    lng: 106.6662,
    phone: '028 3844 1122',
    openingHours: '07:00 - 21:00',
    readyTime: 'Chuẩn bị hàng: 15 - 30 phút',
  },
  {
    id: 'store-govap',
    name: 'Cửa hàng Evergreen Mart Gò Vấp',
    address: '366 Phan Văn Trị, Phường 5, Quận Gò Vấp, TP. Hồ Chí Minh',
    province: 'Thành phố Hồ Chí Minh',
    district: 'Quận Gò Vấp',
    lat: 10.8228,
    lng: 106.6908,
    phone: '028 3894 3355',
    openingHours: '07:00 - 21:30',
    readyTime: 'Chuẩn bị hàng: 15 - 30 phút',
  },
  {
    id: 'store-binhtan',
    name: 'Cửa hàng Evergreen Mart Bình Tân',
    address: 'Số 1 Đường Số 17A, Phường Bình Trị Đông B, Quận Bình Tân, TP. Hồ Chí Minh',
    province: 'Thành phố Hồ Chí Minh',
    district: 'Quận Bình Tân',
    lat: 10.7516,
    lng: 106.6083,
    phone: '028 3752 9988',
    openingHours: '07:00 - 21:30',
    readyTime: 'Chuẩn bị hàng: 15 - 30 phút',
  },

  // Dĩ An (Bình Dương - cửa ngõ Thủ Đức)
  {
    id: 'store-dian',
    name: 'Kho Evergreen Mart Dĩ An',
    address: '01/08 Quốc Lộ 1K, Phường Tân Hòa, TP. Dĩ An, Bình Dương',
    province: 'Tỉnh Bình Dương',
    district: 'TP. Dĩ An',
    lat: 10.8986,
    lng: 106.7865,
    phone: '0274 377 8899',
    openingHours: '07:00 - 21:30',
    readyTime: 'Chuẩn bị hàng: 15 - 30 phút',
  },
];

/**
 * Tự động tìm kho / cửa hàng gần nhất với tọa độ khách hàng
 */
function findNearestWarehouse(customerLat, customerLng, warehouses = DEFAULT_WAREHOUSES) {
  const list = Array.isArray(warehouses) && warehouses.length > 0 ? warehouses : DEFAULT_WAREHOUSES;
  let nearest = list[0];
  let minDistance = Infinity;

  for (const wh of list) {
    if (typeof wh.lat !== 'number' || typeof wh.lng !== 'number') continue;
    const dist = calculateHaversineDistance(customerLat, customerLng, wh.lat, wh.lng);
    if (dist < minDistance) {
      minDistance = dist;
      nearest = wh;
    }
  }
  return nearest;
}

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
        { minOrderValue: 300000, discountAmount: 25000, label: 'Đơn từ 300.000đ: giảm 25.000đ phí ship (Freeship)' },
        { minOrderValue: 150000, discountAmount: 10000, label: 'Đơn từ 150.000đ: giảm 10.000đ phí ship' },
      ],
      foodPreservationPolicy: 'Ưu tiên giao nhanh trong ngày bằng xe chuyên dụng / túi giữ nhiệt bảo quản thực phẩm mát.',
      isServiceActive: true,
      warehouses: DEFAULT_WAREHOUSES,
    });
  } else if (!config.warehouses || config.warehouses.length === 0) {
    config.warehouses = DEFAULT_WAREHOUSES;
    await config.save();
  }
  return config;
}

/**
 * Tính toán phí vận chuyển hoàn chỉnh theo khoảng cách, giá trị đơn hàng & đặc quyền hạng thành viên
 */
async function calculateShipping(customerLat, customerLng, subtotal = 0, customConfig = null, loyaltyTier = '') {
  const config = customConfig || (await getOrCreateShippingConfig());
  const allWarehouses = (Array.isArray(config.warehouses) && config.warehouses.length > 0)
    ? config.warehouses
    : DEFAULT_WAREHOUSES;

  // Tự động tìm kho / cửa hàng gần nhất với địa chỉ của khách hàng
  const warehouse = findNearestWarehouse(customerLat, customerLng, allWarehouses);

  const routeRes = await getOSRMRoute(warehouse.lat, warehouse.lng, customerLat, customerLng);
  const distanceKm = routeRes.distanceKm;

  // Bán kính giao hàng tiêu chuẩn (10km) & bán kính giao xa có phụ thu (tối đa 20km)
  const standardRadiusKm = 10;
  const maxExtendedRadiusKm = Math.max(20, Number(config.maxDeliveryRadiusKm) || 20);

  if (distanceKm > maxExtendedRadiusKm) {
    return {
      supported: false,
      distanceKm,
      standardRadiusKm,
      maxAllowedKm: maxExtendedRadiusKm,
      isFarDelivery: false,
      farSurcharge: 0,
      warehouse,
      routeGeometry: routeRes.geometry,
      baseFee: 0,
      discount: 0,
      finalFee: 0,
      message: `Địa chỉ của bạn cách cửa hàng gần nhất (${warehouse.name}) ${distanceKm} km, vượt quá phạm vi giao hàng tối đa ${maxExtendedRadiusKm} km đối với nông sản & thực phẩm mát. Quý khách vui lòng chọn địa chỉ gần hơn hoặc chọn "Nhận tại cửa hàng" (Miễn phí ship).`,
    };
  }

  // 1. Phí theo nấc khoảng cách & phụ thu giao xa (10 - 20km: +5.000đ/km vượt chuẩn)
  let baseFee = 30000;
  let matchedTierLabel = 'Trên 8–10 km';
  let isFarDelivery = false;
  let farSurcharge = 0;

  if (distanceKm <= 2) {
    baseFee = 15000;
    matchedTierLabel = '0–2 km';
  } else if (distanceKm <= 5) {
    baseFee = 20000;
    matchedTierLabel = 'Trên 2–5 km';
  } else if (distanceKm <= 8) {
    baseFee = 25000;
    matchedTierLabel = 'Trên 5–8 km';
  } else if (distanceKm <= standardRadiusKm) {
    baseFee = 30000;
    matchedTierLabel = 'Trên 8–10 km';
  } else {
    isFarDelivery = true;
    const extraKm = Math.ceil(distanceKm - standardRadiusKm);
    farSurcharge = extraKm * 5000;
    baseFee = 30000 + farSurcharge;
    matchedTierLabel = `Giao xa ${distanceKm} km (phụ thu +${farSurcharge.toLocaleString('vi-VN')}đ)`;
  }

  // Nếu trong config có tiers tùy chỉnh từ admin (áp dụng trong phạm vi tiêu chuẩn <= 10km):
  if (!isFarDelivery && Array.isArray(config.distanceTiers) && config.distanceTiers.length > 0) {
    const sortedTiers = [...config.distanceTiers].sort((a, b) => a.maxKm - b.maxKm);
    for (const tier of sortedTiers) {
      if (distanceKm > tier.minKm && distanceKm <= tier.maxKm) {
        baseFee = tier.fee;
        matchedTierLabel = tier.label || `${tier.minKm}–${tier.maxKm} km`;
        break;
      }
    }
  }

  // 2. Ưu đãi theo Hạng thành viên Loyalty & Giá trị đơn hàng
  let discountAmount = 0;
  let discountReason = 'Dưới 150.000đ: chưa đủ điều kiện hỗ trợ phí ship';

  const orderValue = Number(subtotal) || 0;
  const tier = String(loyaltyTier || '').toLowerCase();

  if (tier === 'platinum' || tier === 'gold') {
    discountAmount = baseFee;
    discountReason = `Đặc quyền thành viên ${tier === 'platinum' ? 'Bạch kim' : 'Vàng'}: Miễn phí giao hàng`;
  } else if (tier === 'silver' && orderValue >= 300000) {
    discountAmount = baseFee;
    discountReason = 'Đặc quyền thành viên Bạc: Miễn phí giao hàng đơn từ 300.000đ';
  } else if (tier === 'bronze' && orderValue >= 500000) {
    discountAmount = baseFee;
    discountReason = 'Đặc quyền thành viên Đồng: Miễn phí giao hàng đơn từ 500.000đ';
  } else if (orderValue >= 300000) {
    discountAmount = Math.min(25000, baseFee);
    discountReason = 'Đơn hàng từ 300.000đ: hỗ trợ tối đa 25.000đ phí vận chuyển (Freeship)';
  } else if (orderValue >= 150000) {
    discountAmount = Math.min(10000, baseFee);
    discountReason = 'Đơn hàng từ 150.000đ: giảm 10.000đ phí vận chuyển';
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
    standardRadiusKm,
    maxAllowedKm: maxExtendedRadiusKm,
    isFarDelivery,
    farSurcharge,
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
    message: isFarDelivery
      ? `Giao hàng xa ${distanceKm} km từ ${warehouse.name} (phụ thu +${farSurcharge.toLocaleString('vi-VN')}đ cho ${Math.ceil(distanceKm - standardRadiusKm)} km vượt chuẩn). Phí vận chuyển: ${finalFee.toLocaleString('vi-VN')}đ.`
      : `Khoảng cách ${distanceKm} km. Phí vận chuyển: ${finalFee.toLocaleString('vi-VN')}đ (Đã giảm ${discountAmount.toLocaleString('vi-VN')}đ ưu đãi).`,
  };
}

module.exports = {
  DEFAULT_WAREHOUSES,
  findNearestWarehouse,
  calculateHaversineDistance,
  getOSRMRoute,
  getOrCreateShippingConfig,
  calculateShipping,
};

