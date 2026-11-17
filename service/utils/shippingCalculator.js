const mongoose = require('mongoose');
const ShippingConfig = require('../models/ShippingConfig');

/**
 * Đọc danh sách cửa hàng / kho trực tiếp từ MongoDB collection 'stores' khi ShippingConfig chưa có warehouses.
 */
async function loadWarehousesFromStoresCollection() {
  try {
    const stores = await mongoose.connection.db.collection('stores').find({}).toArray();
    return stores
      .filter((s) => Array.isArray(s.location?.coordinates) && s.location.coordinates.length >= 2)
      .map((s) => ({
        id: String(s._id),
        name: s.name,
        address: s.address || '',
        province: s.province || '',
        district: s.district || '',
        lat: s.location.coordinates[1],
        lng: s.location.coordinates[0],
        phone: s.phone || '',
        openingHours: s.operatingHours ? `${s.operatingHours.open} - ${s.operatingHours.close}` : '',
        readyTime: 'Chuẩn bị hàng: 15 - 30 phút',
        isHeadquarter: Boolean(s.isHeadquarter),
      }));
  } catch {
    return [];
  }
}

/**
 * Tự động tìm kho / cửa hàng gần nhất với tọa độ khách hàng
 */
function findNearestWarehouse(customerLat, customerLng, warehouses = []) {
  if (!Array.isArray(warehouses) || warehouses.length === 0) return null;
  let nearest = warehouses[0];
  let minDistance = Infinity;

  for (const wh of warehouses) {
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
  const R = 6371;
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

    const url = `https://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=full&geometries=geojson`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'EvergreenMart-Shipping/1.0 (chamsoc@evergreenmart.vn)',
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
  } catch (_) {
    // Fallback nếu OSRM public API bận
  }

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
 * Lấy hoặc khởi tạo cấu hình vận chuyển trong MongoDB (không hardcode danh sách kho).
 */
async function getOrCreateShippingConfig() {
  let config = await ShippingConfig.findOne({ key: 'default' });
  if (!config) {
    const storeWarehouses = await loadWarehousesFromStoresCollection();
    const hq = storeWarehouses.find((w) => w.isHeadquarter) || storeWarehouses[0];
    config = await ShippingConfig.create({
      key: 'default',
      warehouse: hq
        ? { name: hq.name, address: hq.address, lat: hq.lat, lng: hq.lng }
        : undefined,
      warehouses: storeWarehouses,
      isServiceActive: true,
    });
  }
  return config;
}

/**
 * Tính toán phí vận chuyển hoàn chỉnh theo khoảng cách & cấu hình MongoDB
 */
async function calculateShipping(customerLat, customerLng, subtotal = 0, customConfig = null) {
  const config = customConfig || (await getOrCreateShippingConfig());
  let allWarehouses = Array.isArray(config.warehouses) && config.warehouses.length > 0
    ? config.warehouses
    : await loadWarehousesFromStoresCollection();

  if (allWarehouses.length === 0 && config.warehouse?.lat && config.warehouse?.lng) {
    allWarehouses = [config.warehouse];
  }

  const warehouse = findNearestWarehouse(customerLat, customerLng, allWarehouses);
  if (!warehouse) {
    throw new Error('Chưa có dữ liệu kho/cửa hàng trong MongoDB để tính phí giao hàng.');
  }

  const routeRes = await getOSRMRoute(warehouse.lat, warehouse.lng, customerLat, customerLng);
  const distanceKm = routeRes.distanceKm;

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

  let baseFee = 30000;
  let matchedTierLabel = 'Trên 8–10 km';
  let isFarDelivery = false;
  let farSurcharge = 0;

  if (distanceKm > standardRadiusKm) {
    isFarDelivery = true;
    const extraKm = Math.ceil(distanceKm - standardRadiusKm);
    farSurcharge = extraKm * 5000;
    baseFee = 30000 + farSurcharge;
    matchedTierLabel = `Giao xa ${distanceKm} km (phụ thu +${farSurcharge.toLocaleString('vi-VN')}đ)`;
  } else if (Array.isArray(config.distanceTiers) && config.distanceTiers.length > 0) {
    const sortedTiers = [...config.distanceTiers].sort((a, b) => a.maxKm - b.maxKm);
    for (const tier of sortedTiers) {
      if (distanceKm >= tier.minKm && distanceKm <= tier.maxKm) {
        baseFee = tier.fee;
        matchedTierLabel = tier.label || `${tier.minKm}–${tier.maxKm} km`;
        break;
      }
    }
  }

  // Đọc bậc ưu đãi phí vận chuyển từ MongoDB ShippingConfig.orderDiscounts
  let discountAmount = 0;
  let discountReason = 'Chưa đủ giá trị đơn hàng tối thiểu để hỗ trợ phí ship';
  const orderValue = Number(subtotal) || 0;
  const sortedDiscounts = [...(config.orderDiscounts || [])].sort(
    (a, b) => (b.minOrderValue || 0) - (a.minOrderValue || 0)
  );
  for (const rule of sortedDiscounts) {
    if (orderValue >= (rule.minOrderValue || 0)) {
      discountAmount = Number(rule.discountAmount) || 0;
      discountReason = rule.label || `Đơn từ ${rule.minOrderValue.toLocaleString('vi-VN')}đ: giảm ${discountAmount.toLocaleString('vi-VN')}đ phí ship`;
      break;
    }
  }

  const finalFee = Math.max(0, baseFee - discountAmount);

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
  findNearestWarehouse,
  calculateHaversineDistance,
  getOSRMRoute,
  getOrCreateShippingConfig,
  calculateShipping,
};
