const router = require('express').Router();
const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');
const Category = require('../models/Category');
const Complaint = require('../models/Complaint');
const Conversation = require('../models/Conversation');
const Voucher = require('../models/Voucher');
const Review = require('../models/Review');
const ShippingConfig = require('../models/ShippingConfig');
const StoreInventory = require('../models/StoreInventory');
const Store = require('../models/Store');
const StockAdjustmentTicket = require('../models/StockAdjustmentTicket');
const { protect, staffOnly, adminOnly, authorizeRoles, getScopedStoreId } = require('../middleware/auth');

const dashCache = new Map();
function clearDashboardCache() {
  dashCache.clear();
}
function getCache(key) {
  const item = dashCache.get(key);
  if (!item) return null;
  if (Date.now() > item.expires) {
    dashCache.delete(key);
    return null;
  }
  return item.data;
}
function setCache(key, data, ttlMs = 30000) {
  dashCache.set(key, { data, expires: Date.now() + ttlMs });
}

function getEffectiveStoreFilter(req) {
  const scopedStore = getScopedStoreId(req);
  if (!scopedStore || scopedStore === 'all' || scopedStore === 'ALL') {
    return null;
  }
  return scopedStore;
}

function parseDateParam(dateStr, isEndOfDay = false) {
  if (!dateStr) return null;
  const parts = String(dateStr).split('T')[0].split('-').map(Number);
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    const [y, m, d] = parts;
    return isEndOfDay
      ? new Date(y, m - 1, d, 23, 59, 59, 999)
      : new Date(y, m - 1, d, 0, 0, 0, 0);
  }
  const dt = new Date(dateStr);
  if (isEndOfDay) dt.setHours(23, 59, 59, 999);
  return dt;
}

function buildDateFilter(startDate, endDate) {
  const filter = {};
  const start = parseDateParam(startDate, false);
  const end = parseDateParam(endDate, true);

  if (start && end) {
    filter.createdAt = { $gte: start, $lte: end };
  } else if (start) {
    filter.createdAt = { $gte: start };
  } else if (end) {
    filter.createdAt = { $lte: end };
  }
  return filter;
}

// GET /api/dashboard/stats - admin/staff
router.get('/stats', protect, staffOnly, async (req, res, next) => {
  try {
    const { startDate, endDate, store } = req.query;
    const scopedStore = getEffectiveStoreFilter(req) || (store && store !== 'all' ? store : null);
    const cacheKey = `stats_${startDate || ''}_${endDate || ''}_${scopedStore || 'all'}`;
    const cached = getCache(cacheKey);
    if (cached) return res.json(cached);

    const dateFilter = buildDateFilter(startDate, endDate);
    const orderMatch = { ...dateFilter };
    if (scopedStore) {
      orderMatch.warehouseId = scopedStore;
    }
    const now = new Date();

    // Nếu là Store Manager: Tồn kho lấy từ StoreInventory của đúng chi nhánh đó!
    const stockQuery = scopedStore
      ? StoreInventory.aggregate([
          { $match: { storeId: scopedStore } },
          {
            $group: {
              _id: null,
              totalProducts: { $sum: 1 },
              lowStockCount: {
                $sum: { $cond: [{ $and: [{ $gt: ['$physicalStock', 0] }, { $lte: ['$physicalStock', 10] }] }, 1, 0] },
              },
              outOfStockCount: {
                $sum: { $cond: [{ $lte: ['$physicalStock', 0] }, 1, 0] },
              },
            },
          },
        ]).option({ maxTimeMS: 6000 })
      : Product.aggregate([
          { $match: { isActive: { $ne: false } } },
          {
            $group: {
              _id: null,
              totalProducts: { $sum: 1 },
              lowStockCount: {
                $sum: { $cond: [{ $and: [{ $gt: ['$stock', 0] }, { $lte: ['$stock', 10] }] }, 1, 0] },
              },
              outOfStockCount: {
                $sum: { $cond: [{ $lte: ['$stock', 0] }, 1, 0] },
              },
            },
          },
        ]).option({ maxTimeMS: 6000 });

    const [
      stockAgg,
      orderAgg,
      totalUsers,
      recentOrders,
      pendingComplaintsCount,
      waitingSupportCount,
      activeVouchersCount,
      reviewsAgg,
      storeInfo,
    ] = await Promise.all([
      stockQuery,

      Order.aggregate([
        { $match: orderMatch },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            revenue: { $sum: { $cond: [{ $ne: ['$status', 'cancelled'] }, '$total', 0] } },
            realizedRevenue: {
              $sum: {
                $cond: [
                  { $or: [{ $eq: ['$status', 'delivered'] }, { $eq: ['$paymentStatus', 'paid'] }] },
                  '$total',
                  0
                ]
              }
            },
            completedCount: {
              $sum: {
                $cond: [
                  { $or: [{ $eq: ['$status', 'delivered'] }, { $eq: ['$paymentStatus', 'paid'] }] },
                  1,
                  0
                ]
              }
            },
            validCount: { $sum: { $cond: [{ $ne: ['$status', 'cancelled'] }, 1, 0] } },
          },
        },
      ]).option({ maxTimeMS: 6000 }),

      User.countDocuments({ role: 'customer' }).maxTimeMS(6000),

      Order.find(orderMatch)
        .sort({ createdAt: -1 })
        .limit(5)
        .select('orderCode guestName total status createdAt warehouseId pickupStore')
        .maxTimeMS(6000)
        .lean(),

      Complaint.countDocuments({ status: 'pending' }).maxTimeMS(6000),
      Conversation.countDocuments({ status: 'WAITING_FOR_ADMIN' }).maxTimeMS(6000),
      Voucher.countDocuments({ isActive: true, endDate: { $gte: now } }).maxTimeMS(6000),

      Review.aggregate([
        { $match: { isHidden: { $ne: true } } },
        {
          $group: {
            _id: null,
            averageRating: { $avg: '$rating' },
            totalReviews: { $sum: 1 },
          },
        },
      ]).option({ maxTimeMS: 6000 }),

      scopedStore ? Store.findById(scopedStore).lean() : null,
    ]);

    const stock = stockAgg[0] || { totalProducts: 0, lowStockCount: 0, outOfStockCount: 0 };
    const ordersByStatus = (orderAgg || []).map((o) => ({ _id: o._id, count: o.count }));
    const totalOrders = (orderAgg || []).reduce((s, o) => s + o.count, 0);
    const pendingOrders = (orderAgg || []).find((o) => o._id === 'pending')?.count || 0;
    const completedOrders = (orderAgg || []).reduce((s, o) => s + (o.completedCount || 0), 0);
    const cancelledOrdersCount = (orderAgg || []).find((o) => o._id === 'cancelled')?.count || 0;
    const validOrdersCount = totalOrders - cancelledOrdersCount;
    const inPipelineOrdersCount = Math.max(0, validOrdersCount - completedOrders);

    // Chuẩn kế toán & TMĐT: Doanh thu thuần (Net Revenue) = Tổng giá trị các đơn hàng hợp lệ (không hủy)
    const netRevenue = (orderAgg || []).reduce((s, o) => s + o.revenue, 0);
    // Tiền thực thu (Realized Revenue): Đơn đã giao thành công hoặc VietQR đã thanh toán
    const realizedRevenue = (orderAgg || []).reduce((s, o) => s + (o.realizedRevenue || 0), 0);
    // Tiền đang luân chuyển / chờ thu (In-pipeline)
    const pipelineRevenue = Math.max(0, netRevenue - realizedRevenue);
    const allOrdersValue = netRevenue;
    const averageOrderValue = validOrdersCount > 0 ? Math.round(netRevenue / validOrdersCount) : 0;
    const reviewData = reviewsAgg[0] || { averageRating: 0, totalReviews: 0 };
    const averageRating = reviewData.averageRating ? Math.round(reviewData.averageRating * 10) / 10 : 0;

    const responseData = {
      success: true,
      data: {
        totalProducts: stock.totalProducts,
        totalOrders,
        validOrdersCount,
        completedOrders,
        pendingOrders,
        cancelledOrdersCount,
        inPipelineOrdersCount,
        totalRevenue: netRevenue,
        netRevenue,
        realizedRevenue,
        pipelineRevenue,
        allOrdersValue,
        averageOrderValue,
        totalUsers: totalUsers || 0,
        recentOrders: recentOrders || [],
        ordersByStatus,
        lowStockCount: stock.lowStockCount,
        outOfStockCount: stock.outOfStockCount,
        pendingComplaintsCount,
        waitingSupportCount,
        activeVouchersCount,
        reviewStats: {
          averageRating,
          totalReviews: reviewData.totalReviews,
        },
        storeScope: {
          isScoped: Boolean(scopedStore),
          storeId: scopedStore || 'all',
          storeName: storeInfo?.name || (scopedStore ? scopedStore : 'Toàn bộ 18 chi nhánh'),
        },
      },
    };

    setCache(cacheKey, responseData, 30000);
    res.json(responseData);
  } catch (err) { next(err); }
});

// GET /api/dashboard/revenue - revenue over time chart
router.get('/revenue', protect, staffOnly, async (req, res, next) => {
  try {
    const { startDate, endDate, store } = req.query;
    const scopedStore = getEffectiveStoreFilter(req) || (store && store !== 'all' ? store : null);
    const cacheKey = `rev_${startDate || ''}_${endDate || ''}_${scopedStore || 'all'}`;
    const cached = getCache(cacheKey);
    if (cached) return res.json(cached);

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 86400000);
    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

    const dateFilter = {
      createdAt: { $gte: start, $lte: end },
      status: { $ne: 'cancelled' },
    };
    if (scopedStore) {
      dateFilter.warehouseId = scopedStore;
    }

    const data = await Order.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: {
            year:  { $year:  '$createdAt' },
            month: { $month: '$createdAt' },
            day:   { $dayOfMonth: '$createdAt' },
          },
          revenue: { $sum: '$total' },
          count:   { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
    ]);

    const revMap = {};
    data.forEach(d => {
      const key = `${d._id.year}-${String(d._id.month).padStart(2, '0')}-${String(d._id.day).padStart(2, '0')}`;
      revMap[key] = { revenue: d.revenue, count: d.count };
    });

    const formattedData = [];
    const cur = new Date(start);
    cur.setHours(0, 0, 0, 0);
    const limitEnd = new Date(end);

    while (cur <= limitEnd) {
      const y = cur.getFullYear();
      const m = String(cur.getMonth() + 1).padStart(2, '0');
      const d = String(cur.getDate()).padStart(2, '0');
      const key = `${y}-${m}-${d}`;
      const entry = revMap[key] || { revenue: 0, count: 0 };
      formattedData.push({
        date: `${d}/${m}`,
        revenue: entry.revenue,
        count: entry.count,
      });
      cur.setDate(cur.getDate() + 1);
    }

    const responseData = { success: true, data: formattedData };
    setCache(cacheKey, responseData, 30000);
    res.json(responseData);
  } catch (err) { next(err); }
});

// GET /api/dashboard/revenue-by-category - bar chart data
router.get('/revenue-by-category', protect, staffOnly, async (req, res, next) => {
  try {
    const { startDate, endDate, store } = req.query;
    const scopedStore = getEffectiveStoreFilter(req) || (store && store !== 'all' ? store : null);
    const cacheKey = `revcat_${startDate || ''}_${endDate || ''}_${scopedStore || 'all'}`;
    const cached = getCache(cacheKey);
    if (cached) return res.json(cached);

    const dateFilter = {
      ...buildDateFilter(startDate, endDate),
      status: { $ne: 'cancelled' },
    };
    if (scopedStore) {
      dateFilter.warehouseId = scopedStore;
    }

    const [categories, products, orderItems] = await Promise.all([
      Category.find({ isActive: { $ne: false } }).select('_id name').lean(),
      Product.find({ isActive: { $ne: false } }).select('_id name slug categoryId').lean(),
      Order.aggregate([
        { $match: dateFilter },
        { $unwind: '$items' },
        {
          $group: {
            _id: { $ifNull: ['$items.product', '$items.productName'] },
            revenue: { $sum: { $multiply: ['$items.priceNumber', '$items.quantity'] } },
          },
        },
      ]),
    ]);

    const catMap = {};
    categories.forEach(c => {
      catMap[c._id.toString()] = c.name;
    });

    const prodMap = {};
    for (const p of products) {
      const catName = catMap[p.categoryId?.toString()] || 'Khác';
      prodMap[p._id.toString()] = catName;
      prodMap[p.name] = catName;
      if (p.slug) prodMap[p.slug] = catName;
    }

    const catRevMap = {};
    categories.forEach(c => { catRevMap[c.name] = 0; });
    catRevMap['Khác'] = 0;

    for (const item of orderItems) {
      const cat = prodMap[item._id] || 'Khác';
      catRevMap[cat] = (catRevMap[cat] || 0) + item.revenue;
    }

    const result = Object.entries(catRevMap)
      .map(([label, revenue]) => ({ label, slug: label, revenue }))
      .filter(item => item.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue);

    const responseData = { success: true, data: result };
    setCache(cacheKey, responseData, 30000);
    res.json(responseData);
  } catch (err) { next(err); }
});

// GET /api/dashboard/top-products - top selling products
router.get('/top-products', protect, staffOnly, async (req, res, next) => {
  try {
    const { startDate, endDate, limit = 5, store } = req.query;
    const scopedStore = getEffectiveStoreFilter(req) || (store && store !== 'all' ? store : null);
    const cacheKey = `topprod_${startDate || ''}_${endDate || ''}_${limit}_${scopedStore || 'all'}`;
    const cached = getCache(cacheKey);
    if (cached) return res.json(cached);

    const dateFilter = {
      ...buildDateFilter(startDate, endDate),
      status: { $ne: 'cancelled' },
    };
    if (scopedStore) {
      dateFilter.warehouseId = scopedStore;
    }

    const top = await Order.aggregate([
      { $match: dateFilter },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.productName',
          quantity: { $sum: '$items.quantity' },
          revenue: { $sum: { $multiply: ['$items.priceNumber', '$items.quantity'] } },
          image: { $first: '$items.productImage' },
        },
      },
      { $sort: { quantity: -1, revenue: -1 } },
      { $limit: Number(limit) },
      {
        $project: {
          _id: 0,
          name: '$_id',
          quantity: 1,
          revenue: 1,
          image: { $ifNull: ['$image', ''] },
        },
      },
    ]);

    const responseData = { success: true, data: top };
    setCache(cacheKey, responseData, 30000);
    res.json(responseData);
  } catch (err) { next(err); }
});

// GET /api/dashboard/finance - full & per-store financial analytics (Admin & Branch Manager)
router.get('/finance', protect, authorizeRoles('admin', 'manager'), async (req, res, next) => {
  try {
    const { startDate, endDate, store } = req.query;
    const scopedStore = getEffectiveStoreFilter(req);
    const cacheKey = `finance_${startDate || ''}_${endDate || ''}_${scopedStore || store || 'all'}`;
    const cached = getCache(cacheKey);
    if (cached) return res.json(cached);

    const dateFilter = buildDateFilter(startDate, endDate);
    if (scopedStore) {
      dateFilter.warehouseId = scopedStore;
    }

    const [orders, shippingCfg, allProducts] = await Promise.all([
      Order.find(dateFilter)
        .sort({ createdAt: -1 })
        .select('orderCode guestName subtotal discount comboDiscount addonDiscount shippingDiscount shippingVoucherDiscount shippingFee total shippingMethod pickupStore paymentMethod paymentStatus status createdAt warehouseId items')
        .lean(),
      ShippingConfig.findOne({ key: 'default' }).lean(),
      Product.find().select('_id costPrice priceNumber').lean(),
    ]);

    const prodCostMap = new Map();
    allProducts.forEach((p) => {
      const fallbackCost = p.priceNumber ? Math.round(p.priceNumber * 0.55) : 0;
      prodCostMap.set(String(p._id), p.costPrice || fallbackCost);
    });

    let rawWarehouses = Array.isArray(shippingCfg?.warehouses) && shippingCfg.warehouses.length > 0
      ? shippingCfg.warehouses
      : [{
          id: 'hq',
          name: shippingCfg?.warehouse?.name || 'Cửa hàng Trung tâm Evergreen Mart',
          address: shippingCfg?.warehouse?.address || 'TP. Hồ Chí Minh',
          isHeadquarter: true,
        }];

    if (scopedStore) {
      rawWarehouses = rawWarehouses.filter(w => w.id === scopedStore);
    }

    const hqStore = rawWarehouses.find((w) => w.isHeadquarter) || rawWarehouses[0] || { name: 'Cửa hàng Evergreen Mart' };
    const storeMap = new Map();

    const ensureStore = (name, address = '', isHeadquarter = false) => {
      const key = name || hqStore.name;
      if (!storeMap.has(key)) {
        storeMap.set(key, {
          storeName: key,
          address,
          isHeadquarter,
          orderCount: 0,
          cancelledCount: 0,
          grossRevenue: 0,
          voucherDiscount: 0,
          comboDiscount: 0,
          addonDiscount: 0,
          shippingDiscount: 0,
          totalDiscount: 0,
          shippingRevenue: 0,
          netRevenue: 0,
          collectedAmount: 0,
          pendingAmount: 0,
          cancelledAmount: 0,
          codAmount: 0,
          codCount: 0,
          vietqrAmount: 0,
          vietqrCount: 0,
          vietqrPaidAmount: 0,
          vietqrPendingAmount: 0,
          cogs: 0,
        });
      }
      return storeMap.get(key);
    };

    rawWarehouses.forEach((w) => ensureStore(w.name, w.address || '', Boolean(w.isHeadquarter)));

    const resolveOrderStoreName = (o) => {
      // Ưu tiên kho xuất hàng trực tiếp (warehouseId) vì đây là kho trừ tồn và ghi nhận doanh thu chi nhánh
      if (o.warehouseId) {
        const found = rawWarehouses.find((w) => w.id === o.warehouseId);
        if (found) return found.name;
      }
      const pName = o.pickupStore?.name?.trim();
      if (pName) return pName;
      return hqStore.name;
    };

    const transactions = [];

    for (const o of orders) {
      const sName = resolveOrderStoreName(o);
      const bucket = ensureStore(sName, o.pickupStore?.address || '', sName === hqStore.name);
      const isCancelled = o.status === 'cancelled';
      const isCollected = !isCancelled && (o.status === 'delivered' || o.paymentStatus === 'paid');
      const subtotal = Number(o.subtotal || 0);
      const total = Number(o.total || 0);
      const vDisc = Number(o.discount || 0);
      const cDisc = Number(o.comboDiscount || 0);
      const aDisc = Number(o.addonDiscount || 0);
      const sDisc = Number(o.shippingDiscount || 0) + Number(o.shippingVoucherDiscount || 0);
      const shipFee = Number(o.shippingFee || 0);
      const orderDiscount = vDisc + cDisc + aDisc;

      // Tính giá vốn thực tế từ từng món trong đơn hàng
      let orderActualCogs = 0;
      if (Array.isArray(o.items) && o.items.length > 0) {
        for (const it of o.items) {
          const cp = prodCostMap.get(String(it.productId)) || (it.priceNumber ? Math.round(it.priceNumber * 0.55) : 0);
          orderActualCogs += cp * (Number(it.quantity) || 1);
        }
      } else {
        orderActualCogs = Math.round(subtotal * 0.55);
      }

      if (isCancelled) {
        bucket.cancelledCount += 1;
        bucket.cancelledAmount += total;
      } else {
        bucket.orderCount += 1;
        bucket.grossRevenue += subtotal;
        bucket.voucherDiscount += vDisc;
        bucket.comboDiscount += cDisc;
        bucket.addonDiscount += aDisc;
        bucket.shippingDiscount += sDisc;
        bucket.totalDiscount += orderDiscount;
        bucket.shippingRevenue += shipFee;
        bucket.netRevenue += total;
        bucket.cogs += orderActualCogs;

        if (isCollected) bucket.collectedAmount += total;
        else bucket.pendingAmount += total;

        if (o.paymentMethod === 'bank_transfer') {
          bucket.vietqrCount += 1;
          bucket.vietqrAmount += total;
          if (o.paymentStatus === 'paid') bucket.vietqrPaidAmount += total;
          else bucket.vietqrPendingAmount += total;
        } else {
          bucket.codCount += 1;
          bucket.codAmount += total;
        }
      }

      if (!store || store === sName) {
        const estCogs = isCancelled ? 0 : orderActualCogs;
        const estOps = Math.round(total * 0.08);
        transactions.push({
          _id: String(o._id),
          orderCode: o.orderCode,
          storeName: sName,
          customer: o.guestName || 'Khách lẻ',
          shippingMethod: o.shippingMethod,
          paymentMethod: o.paymentMethod,
          paymentStatus: o.paymentStatus,
          status: o.status,
          subtotal,
          totalDiscount: orderDiscount,
          shippingFee: shipFee,
          total,
          estimatedCogs: estCogs,
          cogs: estCogs,
          estimatedOps: estOps,
          estimatedProfit: isCancelled ? 0 : (total - estCogs - estOps),
          isCollected,
          createdAt: o.createdAt,
        });
      }
    }

    const totalSystemNet = Array.from(storeMap.values()).reduce((sum, s) => sum + s.netRevenue, 0);

    const stores = Array.from(storeMap.values()).map((s) => {
      const estimatedCogs = s.cogs;
      const estimatedOps = Math.round(s.netRevenue * 0.08);
      const estimatedProfit = s.netRevenue - estimatedCogs - estimatedOps;
      const profitMargin = s.netRevenue > 0 ? Number(((estimatedProfit / s.netRevenue) * 100).toFixed(1)) : 0;
      const cogsRate = s.netRevenue > 0 ? Number(((estimatedCogs / s.netRevenue) * 100).toFixed(1)) : 0;
      const avgOrderValue = s.orderCount > 0 ? Math.round(s.netRevenue / s.orderCount) : 0;
      const revenueShare = totalSystemNet > 0 ? Number(((s.netRevenue / totalSystemNet) * 100).toFixed(1)) : 0;
      return {
        ...s,
        estimatedCogs,
        cogsRate,
        estimatedOps,
        estimatedProfit,
        profitMargin,
        avgOrderValue,
        revenueShare,
      };
    }).sort((a, b) => b.netRevenue - a.netRevenue);

    const activeStores = store ? stores.filter((s) => s.storeName === store) : stores;
    const summary = activeStores.reduce((acc, s) => ({
      validOrdersCount: acc.validOrdersCount + s.orderCount,
      cancelledOrdersCount: acc.cancelledOrdersCount + s.cancelledCount,
      grossRevenue: acc.grossRevenue + s.grossRevenue,
      voucherDiscount: acc.voucherDiscount + s.voucherDiscount,
      comboDiscount: acc.comboDiscount + s.comboDiscount,
      addonDiscount: acc.addonDiscount + s.addonDiscount,
      shippingDiscount: acc.shippingDiscount + s.shippingDiscount,
      totalDiscount: acc.totalDiscount + s.totalDiscount,
      shippingRevenue: acc.shippingRevenue + s.shippingRevenue,
      netRevenue: acc.netRevenue + s.netRevenue,
      collectedAmount: acc.collectedAmount + s.collectedAmount,
      pendingAmount: acc.pendingAmount + s.pendingAmount,
      cancelledAmount: acc.cancelledAmount + s.cancelledAmount,
      codAmount: acc.codAmount + s.codAmount,
      codCount: acc.codCount + s.codCount,
      vietqrAmount: acc.vietqrAmount + s.vietqrAmount,
      vietqrCount: acc.vietqrCount + s.vietqrCount,
      vietqrPaidAmount: acc.vietqrPaidAmount + s.vietqrPaidAmount,
      vietqrPendingAmount: acc.vietqrPendingAmount + s.vietqrPendingAmount,
      estimatedCogs: acc.estimatedCogs + s.estimatedCogs,
      estimatedOps: acc.estimatedOps + s.estimatedOps,
      estimatedProfit: acc.estimatedProfit + s.estimatedProfit,
    }), {
      validOrdersCount: 0,
      cancelledOrdersCount: 0,
      grossRevenue: 0,
      voucherDiscount: 0,
      comboDiscount: 0,
      addonDiscount: 0,
      shippingDiscount: 0,
      totalDiscount: 0,
      shippingRevenue: 0,
      netRevenue: 0,
      collectedAmount: 0,
      pendingAmount: 0,
      cancelledAmount: 0,
      codAmount: 0,
      codCount: 0,
      vietqrAmount: 0,
      vietqrCount: 0,
      vietqrPaidAmount: 0,
      vietqrPendingAmount: 0,
      estimatedCogs: 0,
      estimatedOps: 0,
      estimatedProfit: 0,
    });

    summary.profitMargin = summary.netRevenue > 0
      ? Number(((summary.estimatedProfit / summary.netRevenue) * 100).toFixed(1))
      : 0;
    summary.cogsRate = summary.netRevenue > 0
      ? Number(((summary.estimatedCogs / summary.netRevenue) * 100).toFixed(1))
      : 0;
    summary.avgOrderValue = summary.validOrdersCount > 0
      ? Math.round(summary.netRevenue / summary.validOrdersCount)
      : 0;

    // Tính Daily Trends cho biểu đồ Xu hướng Tài chính
    const dailyMap = new Map();
    for (const o of orders) {
      if (o.status === 'cancelled') continue;
      const sName = resolveOrderStoreName(o);
      if (store && store !== sName) continue;

      const dateKey = new Date(o.createdAt).toISOString().slice(0, 10);
      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, {
          date: dateKey,
          netRevenue: 0,
          estimatedProfit: 0,
          orderCount: 0,
        });
      }
      const d = dailyMap.get(dateKey);
      const total = Number(o.total || 0);
      let orderActualCogs = 0;
      if (Array.isArray(o.items) && o.items.length > 0) {
        for (const it of o.items) {
          const cp = prodCostMap.get(String(it.productId)) || (it.priceNumber ? Math.round(it.priceNumber * 0.55) : 0);
          orderActualCogs += cp * (Number(it.quantity) || 1);
        }
      } else {
        orderActualCogs = Math.round(Number(o.subtotal || 0) * 0.55);
      }
      const estOps = Math.round(total * 0.08);
      d.netRevenue += total;
      d.estimatedProfit += (total - orderActualCogs - estOps);
      d.orderCount += 1;
    }

    const dailyTrends = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    const responseData = {
      success: true,
      data: {
        summary,
        stores,
        dailyTrends,
        transactions: transactions.slice(0, 100),
      },
    };
    setCache(cacheKey, responseData, 20000);
    res.json(responseData);
  } catch (err) { next(err); }
});

// GET /api/dashboard/badges - realtime unread / pending counts for sidebar pills
router.get('/badges', protect, staffOnly, async (req, res, next) => {
  try {
    const scopedStore = getEffectiveStoreFilter(req);
    const qrFilter = {
      paymentMethod: 'bank_transfer',
      paymentStatus: { $in: ['pending', 'unpaid'] },
      status: { $nin: ['cancelled', 'delivered'] },
    };
    if (scopedStore) {
      qrFilter.$or = [
        { warehouseId: scopedStore },
        { pickupStoreId: scopedStore },
      ];
    }

    const complaintFilter = { status: 'pending' };
    if (scopedStore) {
      complaintFilter.warehouseId = scopedStore;
    }

    // Chuyển kho đến (kho đích cần nhận hàng)
    const transferFilter = { type: 'store_transfer', status: 'in_transit' };
    if (scopedStore) {
      transferFilter.targetStoreId = scopedStore;
    }

    // Phiếu kho chờ CHT duyệt (kiểm kê lệch / xuất hủy hao hụt)
    const approvalFilter = { status: 'pending_approval' };
    if (scopedStore) {
      approvalFilter.storeId = scopedStore;
    }

    const userRole = (req.user?.role || '').toLowerCase();
    const isStoreManager = userRole === 'manager';

    const [pendingQr, waitingChats, pendingComplaints, badReviews, incomingTransfers, pendingTickets] = await Promise.all([
      Order.countDocuments(qrFilter),
      !isStoreManager
        ? Conversation.countDocuments({
            $or: [
              { status: 'WAITING_FOR_ADMIN' },
              { unreadAdminCount: { $gt: 0 } },
            ],
          })
        : 0,
      Complaint.countDocuments(complaintFilter),
      !isStoreManager
        ? Review.countDocuments({
            rating: { $lte: 2 },
            isHidden: { $ne: true },
            $or: [{ adminReply: '' }, { adminReply: null }, { adminReply: { $exists: false } }],
          })
        : 0,
      StockAdjustmentTicket.countDocuments(transferFilter),
      StockAdjustmentTicket.countDocuments(approvalFilter),
    ]);

    const isWarehouseRole = userRole === 'warehouse';
    const isMarketingRole = userRole === 'marketing';
    const isSupportRole = userRole === 'support' || userRole === 'sales';

    const actualIncomingTransfers = (userRole === 'manager' || userRole === 'admin') ? incomingTransfers : 0;
    const actualComplaints = (!isWarehouseRole && !isMarketingRole) ? pendingComplaints : 0;
    const actualQr = (!isWarehouseRole && !isMarketingRole) ? pendingQr : 0;

    let bellTotal = 0;
    if (isWarehouseRole) {
      bellTotal = pendingTickets || 0;
    } else if (isMarketingRole) {
      bellTotal = 0;
    } else if (isSupportRole) {
      bellTotal = (actualQr || 0) + (actualComplaints || 0);
    } else {
      bellTotal = (actualQr || 0) + (actualIncomingTransfers || 0) + (pendingTickets || 0) + (actualComplaints || 0);
    }

    res.json({
      success: true,
      data: {
        pendingQr: isWarehouseRole ? 0 : (pendingQr || 0),
        waitingChats: (isStoreManager || isWarehouseRole) ? 0 : (waitingChats || 0),
        pendingComplaints: actualComplaints || 0,
        incomingTransfers: actualIncomingTransfers || 0,
        pendingTickets: pendingTickets || 0,
        bellTotal,
        badReviews: (isStoreManager || isWarehouseRole) ? 0 : (badReviews || 0),
        unrepliedReviews: (isStoreManager || isWarehouseRole) ? 0 : (badReviews || 0),
        supportTotal: 0,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/dashboard/operational-notifications - thông báo nghiệp vụ toàn diện cho chuông
router.get('/operational-notifications', protect, staffOnly, async (req, res, next) => {
  try {
    const role = (req.user?.role || '').toLowerCase();
    const scopedStore = getEffectiveStoreFilter(req);

    const isWarehouseRole = role === 'warehouse';
    const isMarketingRole = role === 'marketing';
    const isSupportRole = role === 'support' || role === 'sales';

    // 1. Chuyển kho đến (kho đích cần nhận hàng)
    // CHỈ gửi thông báo cho Cửa hàng trưởng (Manager) của kho đích hoặc Admin khi theo dõi kho đích.
    // Thủ kho toàn chuỗi là người điều phối xuất/nhập trực tiếp trên Tab Phiếu kho, không nhận chuông tự báo cho chính mình.
    let incomingTransfers = [];
    if (role === 'manager' || role === 'admin') {
      const transferFilter = { type: 'store_transfer', status: 'in_transit' };
      if (scopedStore) {
        transferFilter.targetStoreId = scopedStore;
        transferFilter.storeId = { $ne: scopedStore }; // Không bao giờ báo cho kho xuất hàng
      } else if (role === 'manager' && req.user.assignedStore && req.user.assignedStore !== 'all') {
        transferFilter.targetStoreId = req.user.assignedStore;
        transferFilter.storeId = { $ne: req.user.assignedStore };
      }
      incomingTransfers = await StockAdjustmentTicket.find(transferFilter)
        .sort({ createdAt: -1 })
        .limit(10)
        .select('ticketCode storeId storeName targetStoreId targetStoreName totalAmount createdAt')
        .lean();
    }

    // 2. Phiếu kho chờ duyệt/kiểm đếm - Phục vụ Kho & CHT
    let pendingTickets = [];
    if (!isSupportRole && !isMarketingRole) {
      const approvalFilter = { status: 'pending_approval' };
      if (scopedStore) {
        approvalFilter.storeId = scopedStore;
      }
      pendingTickets = await StockAdjustmentTicket.find(approvalFilter)
        .sort({ createdAt: -1 })
        .limit(10)
        .select('ticketCode storeId storeName type totalLossValue totalAmount createdBy creatorName createdAt')
        .lean();
    }

    // 3. Khiếu nại & phản ánh chờ giải quyết (Chỉ CSKH, Cửa hàng trưởng và Admin - không gửi cho Marketing & Kho)
    let pendingComplaints = [];
    if (!isWarehouseRole && !isMarketingRole) {
      const complaintFilter = { status: 'pending' };
      if (scopedStore) {
        complaintFilter.warehouseId = scopedStore;
      }
      pendingComplaints = await Complaint.find(complaintFilter)
        .sort({ createdAt: -1 })
        .limit(10)
        .select('complaintCode customerName customerPhone title type warehouseId createdAt')
        .lean();
    }

    // 4. Đơn hàng VietQR chờ duyệt thanh toán (Chỉ Thu ngân, CSKH, CHT và Admin - không gửi cho Marketing & Kho)
    let pendingQrOrders = [];
    if (!isWarehouseRole && !isMarketingRole) {
      const qrFilter = {
        paymentMethod: 'bank_transfer',
        paymentStatus: { $in: ['pending', 'unpaid'] },
        status: { $nin: ['cancelled', 'delivered'] },
      };
      if (scopedStore) {
        qrFilter.$or = [
          { warehouseId: scopedStore },
          { pickupStoreId: scopedStore },
        ];
      }
      pendingQrOrders = await Order.find(qrFilter)
        .sort({ createdAt: -1 })
        .limit(10)
        .select('orderCode guestName guestPhone total createdAt warehouseId pickupStore')
        .lean();
    }

    const counts = {
      incomingTransfers: incomingTransfers.length,
      pendingTickets: pendingTickets.length,
      pendingComplaints: pendingComplaints.length,
      pendingQr: pendingQrOrders.length,
      total: incomingTransfers.length + pendingTickets.length + pendingComplaints.length + pendingQrOrders.length,
    };

    res.json({
      success: true,
      counts,
      data: {
        incomingTransfers,
        pendingTickets,
        pendingComplaints,
        pendingQrOrders,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.clearDashboardCache = clearDashboardCache;
module.exports = router;

module.exports.clearDashboardCache = clearDashboardCache;
