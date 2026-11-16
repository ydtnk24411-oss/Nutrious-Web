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
const { protect, staffOnly } = require('../middleware/auth');

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

function buildDateFilter(startDate, endDate) {
  const filter = {};
  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    filter.createdAt = { $gte: start, $lte: end };
  } else if (startDate) {
    filter.createdAt = { $gte: new Date(startDate) };
  } else if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    filter.createdAt = { $lte: end };
  }
  return filter;
}

// GET /api/dashboard/stats — admin/staff
router.get('/stats', protect, staffOnly, async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const cacheKey = `stats_${startDate || ''}_${endDate || ''}`;
    const cached = getCache(cacheKey);
    if (cached) return res.json(cached);

    const dateFilter = buildDateFilter(startDate, endDate);
    const now = new Date();

    const [
      stockAgg,
      orderAgg,
      totalUsers,
      recentOrders,
      pendingComplaintsCount,
      waitingSupportCount,
      activeVouchersCount,
      reviewsAgg,
    ] = await Promise.all([
      Product.aggregate([
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
      ]).option({ maxTimeMS: 6000 }),

      Order.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            revenue: { $sum: { $cond: [{ $ne: ['$status', 'cancelled'] }, '$total', 0] } },
            validCount: { $sum: { $cond: [{ $ne: ['$status', 'cancelled'] }, 1, 0] } },
          },
        },
      ]).option({ maxTimeMS: 6000 }),

      User.countDocuments({ role: 'customer' }).maxTimeMS(6000),

      Order.find(dateFilter)
        .sort({ createdAt: -1 })
        .limit(5)
        .select('orderCode guestName total status createdAt')
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
    ]);

    const stock = stockAgg[0] || { totalProducts: 0, lowStockCount: 0, outOfStockCount: 0 };
    const ordersByStatus = (orderAgg || []).map((o) => ({ _id: o._id, count: o.count }));
    const totalOrders = (orderAgg || []).reduce((s, o) => s + o.count, 0);
    const pendingOrders = (orderAgg || []).find((o) => o._id === 'pending')?.count || 0;
    const totalRevenue = (orderAgg || []).reduce((s, o) => s + o.revenue, 0);
    const validOrdersCount = (orderAgg || []).reduce((s, o) => s + o.validCount, 0);
    const averageOrderValue = validOrdersCount > 0 ? Math.round(totalRevenue / validOrdersCount) : 0;
    const reviewData = reviewsAgg[0] || { averageRating: 0, totalReviews: 0 };
    const averageRating = reviewData.averageRating ? Math.round(reviewData.averageRating * 10) / 10 : 0;

    const responseData = {
      success: true,
      data: {
        totalProducts: stock.totalProducts,
        totalOrders,
        totalUsers,
        pendingOrders,
        totalRevenue,
        averageOrderValue,
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
      },
    };

    setCache(cacheKey, responseData, 30000);
    res.json(responseData);
  } catch (err) { next(err); }
});

// GET /api/dashboard/revenue — revenue over time chart
router.get('/revenue', protect, staffOnly, async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const cacheKey = `rev_${startDate || ''}_${endDate || ''}`;
    const cached = getCache(cacheKey);
    if (cached) return res.json(cached);

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 86400000);
    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

    const dateFilter = {
      createdAt: { $gte: start, $lte: end },
      status: { $ne: 'cancelled' },
    };

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

// GET /api/dashboard/revenue-by-category — bar chart data
router.get('/revenue-by-category', protect, staffOnly, async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const cacheKey = `revcat_${startDate || ''}_${endDate || ''}`;
    const cached = getCache(cacheKey);
    if (cached) return res.json(cached);

    const dateFilter = {
      ...buildDateFilter(startDate, endDate),
      status: { $ne: 'cancelled' },
    };

    const categories = await Category.find({ isActive: { $ne: false } });
    const catMap = {};
    categories.forEach(c => {
      catMap[c._id.toString()] = c.name;
    });

    const products = await Product.find({ isActive: { $ne: false } }).select('name slug categoryId');
    const prodMap = {};
    for (const p of products) {
      const catName = catMap[p.categoryId?.toString()] || 'Khác';
      prodMap[p._id.toString()] = catName;
      prodMap[p.name] = catName;
      if (p.slug) prodMap[p.slug] = catName;
    }

    const orderItems = await Order.aggregate([
      { $match: dateFilter },
      { $unwind: '$items' },
      {
        $group: {
          _id: { $ifNull: ['$items.product', '$items.productName'] },
          revenue: { $sum: { $multiply: ['$items.priceNumber', '$items.quantity'] } },
        },
      },
    ]);

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

// GET /api/dashboard/top-products — top selling products
router.get('/top-products', protect, staffOnly, async (req, res, next) => {
  try {
    const { startDate, endDate, limit = 5 } = req.query;
    const cacheKey = `topprod_${startDate || ''}_${endDate || ''}_${limit}`;
    const cached = getCache(cacheKey);
    if (cached) return res.json(cached);

    const dateFilter = {
      ...buildDateFilter(startDate, endDate),
      status: { $ne: 'cancelled' },
    };

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

// GET /api/dashboard/finance — full & per-store financial analytics
router.get('/finance', protect, staffOnly, async (req, res, next) => {
  try {
    const { startDate, endDate, store } = req.query;
    const dateFilter = buildDateFilter(startDate, endDate);

    const [orders, shippingCfg] = await Promise.all([
      Order.find(dateFilter)
        .sort({ createdAt: -1 })
        .select('orderCode guestName subtotal discount comboDiscount addonDiscount shippingDiscount shippingVoucherDiscount shippingFee total shippingMethod pickupStore paymentMethod paymentStatus status createdAt')
        .lean(),
      ShippingConfig.findOne({ key: 'default' }).lean(),
    ]);

    const rawWarehouses = Array.isArray(shippingCfg?.warehouses) && shippingCfg.warehouses.length > 0
      ? shippingCfg.warehouses
      : [{
          id: 'hq',
          name: shippingCfg?.warehouse?.name || 'Cửa hàng Trung tâm Evergreen Mart',
          address: shippingCfg?.warehouse?.address || 'TP. Hồ Chí Minh',
          isHeadquarter: true,
        }];

    const hqStore = rawWarehouses.find((w) => w.isHeadquarter) || rawWarehouses[0];
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
        });
      }
      return storeMap.get(key);
    };

    rawWarehouses.forEach((w) => ensureStore(w.name, w.address || '', Boolean(w.isHeadquarter)));

    const resolveOrderStoreName = (o) => {
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
        const estCogs = Math.round(subtotal * 0.64);
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
          estimatedProfit: isCancelled ? 0 : (total - estCogs - estOps),
          isCollected,
          createdAt: o.createdAt,
        });
      }
    }

    const totalSystemNet = Array.from(storeMap.values()).reduce((sum, s) => sum + s.netRevenue, 0);

    const stores = Array.from(storeMap.values()).map((s) => {
      const estimatedCogs = Math.round(s.grossRevenue * 0.64);
      const estimatedOps = Math.round(s.netRevenue * 0.08);
      const estimatedProfit = s.netRevenue - estimatedCogs - estimatedOps;
      const profitMargin = s.netRevenue > 0 ? Number(((estimatedProfit / s.netRevenue) * 100).toFixed(1)) : 0;
      const avgOrderValue = s.orderCount > 0 ? Math.round(s.netRevenue / s.orderCount) : 0;
      const revenueShare = totalSystemNet > 0 ? Number(((s.netRevenue / totalSystemNet) * 100).toFixed(1)) : 0;
      return {
        ...s,
        estimatedCogs,
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
    summary.avgOrderValue = summary.validOrdersCount > 0
      ? Math.round(summary.netRevenue / summary.validOrdersCount)
      : 0;

    res.json({
      success: true,
      data: {
        summary,
        stores,
        transactions: transactions.slice(0, 60),
      },
    });
  } catch (err) { next(err); }
});

router.clearDashboardCache = clearDashboardCache;
module.exports = router;
module.exports.clearDashboardCache = clearDashboardCache;
