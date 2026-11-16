const ShippingConfig = require('../models/ShippingConfig');
const StoreInventory = require('../models/StoreInventory');
const Product = require('../models/Product');
const Order = require('../models/Order');

/**
 * Tính khoảng cách Haversine giữa 2 tọa độ (đơn vị: km)
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
  return Math.round(R * c * 100) / 100; // Làm tròn 2 chữ số thập phân
}

/**
 * Smart Order Routing (SOR) Algorithm
 * @param {Array} orderItems - Mảng các sản phẩm trong đơn [{ productId, quantity }]
 * @param {Object} customerLocation - { lat, lng, address }
 * @param {Object} options - { maxRadiusKm: 5, weights: { fillRate: 0.40, distance: 0.30, capacity: 0.15, fefo: 0.15 } }
 */
async function smartOrderRouting(orderItems = [], customerLocation = {}, options = {}) {
  const maxRadiusKm = options.maxRadiusKm || 5;
  const weights = options.weights || {
    fillRate: 0.40,
    distance: 0.30,
    capacity: 0.15,
    fefo: 0.15,
  };

  const cLat = customerLocation?.lat ? Number(customerLocation.lat) : 10.8231;
  const cLng = customerLocation?.lng ? Number(customerLocation.lng) : 106.6297;

  // 1. Lấy danh sách tất cả các kho / chi nhánh từ ShippingConfig
  const shippingConfig = await ShippingConfig.findOne({ key: 'default' }).lean();
  let candidateStores = [];

  if (shippingConfig?.warehouses && shippingConfig.warehouses.length > 0) {
    candidateStores = shippingConfig.warehouses.map((w, idx) => ({
      storeId: w.id || `wh-${idx + 1}`,
      name: w.name,
      address: w.address,
      lat: Number(w.lat || 10.8703),
      lng: Number(w.lng || 106.7782),
      phone: w.phone || '',
      isHeadquarter: !!w.isHeadquarter,
    }));
  } else {
    // Dự phòng kho mặc định
    const defaultWh = shippingConfig?.warehouse || {
      name: 'Kho Nông Sản Evergreen Mart (Trung tâm)',
      address: 'Khu phố 6, Phường Linh Trung, TP. Thủ Đức, TP. Hồ Chí Minh',
      lat: 10.8703,
      lng: 106.7782,
    };
    candidateStores = [
      {
        storeId: 'default',
        name: defaultWh.name,
        address: defaultWh.address,
        lat: Number(defaultWh.lat),
        lng: Number(defaultWh.lng),
        phone: '1900-633-818',
        isHeadquarter: true,
      },
    ];
  }

  // 2. Chuẩn bị danh sách sản phẩm và số lượng yêu cầu
  const productQuantities = new Map();
  const productIds = [];
  for (const item of orderItems) {
    const pId = String(item.product?._id || item.product || item.productId || item._id);
    const qty = Number(item.quantity) || 1;
    productQuantities.set(pId, (productQuantities.get(pId) || 0) + qty);
    if (!productIds.includes(pId)) productIds.push(pId);
  }

  const totalRequiredQuantity = Array.from(productQuantities.values()).reduce((a, b) => a + b, 0) || 1;

  // Lấy master products nếu cần kiểm tra tồn kho dự phòng
  const masterProducts = await Product.find({ _id: { $in: productIds } }).lean();
  const masterProductMap = new Map(masterProducts.map((p) => [String(p._id), p]));

  // Lấy toàn bộ StoreInventories của các sản phẩm này
  const storeInventories = await StoreInventory.find({
    productId: { $in: productIds },
  }).lean();

  // Tạo map [storeId][productId] => inventory
  const storeInventoryMap = new Map();
  for (const inv of storeInventories) {
    const key = `${inv.storeId}__${String(inv.productId)}`;
    storeInventoryMap.set(key, inv);
  }

  // 3. Đếm số đơn hàng đang xử lý (Pending / Processing) của từng cửa hàng để tính Capacity
  const activeOrders = await Order.aggregate([
    {
      $match: {
        status: { $in: ['Pending', 'Processing', 'Confirmed', 'Packaging'] },
      },
    },
    {
      $group: {
        _id: '$warehouseId', // hoặc storeId
        pendingCount: { $sum: 1 },
      },
    },
  ]);
  const storeCapacityMap = new Map(activeOrders.map((o) => [String(o._id), o.pendingCount]));

  // 4. Chấm điểm từng cửa hàng ứng viên
  const scoredStores = [];
  const now = new Date();

  for (const store of candidateStores) {
    // a. Tính khoảng cách
    const distanceKm = calculateHaversineDistance(cLat, cLng, store.lat, store.lng);

    // b. Tính Tỷ lệ đáp ứng đơn hàng (Fill Rate) & FEFO
    let fulfilledQuantity = 0;
    let fefoWeightedDays = 0;
    let fefoItemsCount = 0;

    for (const [pId, reqQty] of productQuantities.entries()) {
      const inv = storeInventoryMap.get(`${store.storeId}__${pId}`);
      let availableStock = 0;

      if (inv) {
        const physical = inv.physicalStock ?? 0;
        const reserved = inv.reservedStock ?? 0;
        const buffer = inv.safetyBuffer ?? 2;
        availableStock = Math.max(0, physical - reserved - buffer);

        // Đánh giá FEFO: tìm lô hàng có hạn sử dụng gần nhất
        if (inv.batches && inv.batches.length > 0) {
          const validBatches = inv.batches
            .filter((b) => b.quantity > 0 && new Date(b.expDate) > now)
            .sort((a, b) => new Date(a.expDate) - new Date(b.expDate));

          if (validBatches.length > 0) {
            const nearestExpDays = Math.max(1, (new Date(validBatches[0].expDate) - now) / (1000 * 60 * 60 * 24));
            fefoWeightedDays += nearestExpDays;
            fefoItemsCount++;
          }
        }
      } else {
        // Nếu chi nhánh chưa có bảng StoreInventory riêng, fallback theo Product.stock
        const master = masterProductMap.get(pId);
        if (master) {
          const physical = master.stock ?? 0;
          const reserved = master.reservedStock ?? 0;
          const buffer = master.safetyBuffer ?? 2;
          availableStock = Math.max(0, physical - reserved - buffer);
        }
      }

      fulfilledQuantity += Math.min(availableStock, reqQty);
    }

    const fillRate = Math.min(1, fulfilledQuantity / totalRequiredQuantity);

    // c. Điểm khoảng cách (Distance Score: 1 nếu 0km, giảm dần đến 0 khi >= maxRadiusKm)
    const distanceScore = Math.max(0, 1 - distanceKm / (maxRadiusKm * 1.5));

    // d. Điểm công suất (Capacity Score: Giả định ngưỡng nghẽn là 50 đơn đang chờ)
    const currentOrders = storeCapacityMap.get(store.storeId) || 0;
    const capacityScore = Math.max(0, 1 - currentOrders / 50);

    // e. Điểm FEFO: Lô hàng có ngày sử dụng gần hơn (trong ngưỡng an toàn 30-90 ngày) được ưu tiên đẩy đi trước
    let fefoScore = 0.5; // Mặc định trung hòa nếu không có thông tin lô
    if (fefoItemsCount > 0) {
      const avgExpDays = fefoWeightedDays / fefoItemsCount;
      // Càng gần hạn (ví dụ dưới 45 ngày) điểm càng cao để xuất trước, nhưng nếu < 7 ngày thì giảm tránh hỏng
      if (avgExpDays >= 7 && avgExpDays <= 60) {
        fefoScore = 1 - (avgExpDays - 7) / 53; // 1.0 tại 7 ngày, 0.0 tại 60 ngày
      } else if (avgExpDays > 60) {
        fefoScore = 0.2; // Hạn còn rất dài, không cần vội xuất trước
      } else {
        fefoScore = 0.0; // Quá sát hạn (< 7 ngày)
      }
    }

    // TỔNG ĐIỂM THEO TRỌNG SỐ (Weights: 40% FillRate + 30% Distance + 15% Capacity + 15% FEFO)
    const totalScore =
      weights.fillRate * fillRate +
      weights.distance * distanceScore +
      weights.capacity * capacityScore +
      weights.fefo * fefoScore;

    scoredStores.push({
      storeId: store.storeId,
      name: store.name,
      address: store.address,
      distanceKm,
      isWithinRadius: distanceKm <= maxRadiusKm,
      fillRate: Math.round(fillRate * 100) / 100,
      fulfilledItemsPercent: Math.round(fillRate * 100),
      currentPendingOrders: currentOrders,
      capacityScore: Math.round(capacityScore * 100) / 100,
      fefoScore: Math.round(fefoScore * 100) / 100,
      distanceScore: Math.round(distanceScore * 100) / 100,
      totalScore: Math.round(totalScore * 1000) / 1000,
    });
  }

  // Sắp xếp cửa hàng có điểm cao nhất lên đầu
  scoredStores.sort((a, b) => b.totalScore - a.totalScore);

  const selectedStore = scoredStores[0] || null;

  return {
    selectedStore,
    candidates: scoredStores,
    routingCriteria: {
      maxRadiusKm,
      weights,
      customerLocation: { lat: cLat, lng: cLng },
    },
  };
}

module.exports = {
  calculateHaversineDistance,
  smartOrderRouting,
};
