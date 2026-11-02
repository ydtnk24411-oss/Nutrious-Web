const router    = require('express').Router();
const Product   = require('../models/Product');
const Order     = require('../models/Order');
const User      = require('../models/User');
const Event     = require('../models/Event');
const Booking   = require('../models/Booking');
const Category  = require('../models/Category');
const { protect, adminOnly } = require('../middleware/auth');

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

// GET /api/dashboard/stats — admin
router.get('/stats', protect, adminOnly, async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const dateFilter = buildDateFilter(startDate, endDate);

    const [
      totalProducts,
      totalOrders,
      totalUsers,
      totalEvents,
      totalBookings,
      pendingOrders,
      revenue,
      validOrdersCount,
      recentOrders,
      ordersByStatus,
    ] = await Promise.all([
      Product.countDocuments({ isActive: { $ne: false } }),
      Order.countDocuments(dateFilter),
      User.countDocuments({ role: 'customer' }),
      Event.countDocuments({ isActive: { $ne: false } }),
      Booking.countDocuments(),
      Order.countDocuments({ ...dateFilter, status: 'pending' }),

      // Total revenue from all active orders (not cancelled)
      Order.aggregate([
        { $match: { ...dateFilter, status: { $ne: 'cancelled' } } },
        { $group: { _id: null, total: { $sum: '$total' } } },
      ]),

      // Count valid orders for average calculation
      Order.countDocuments({ ...dateFilter, status: { $ne: 'cancelled' } }),

      // Last 5 orders
      Order.find(dateFilter).sort({ createdAt: -1 }).limit(5)
        .select('orderCode guestName total status createdAt'),

      // Orders by status breakdown
      Order.aggregate([
        { $match: dateFilter },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

    const averageOrderValue = validOrdersCount > 0 ? (revenue[0]?.total ?? 0) / validOrdersCount : 0;

    res.json({
      success: true,
      data: {
        totalProducts,
        totalOrders,
        totalUsers,
        totalEvents,
        totalBookings,
        pendingOrders,
        totalRevenue: revenue[0]?.total ?? 0,
        averageOrderValue,
        recentOrders,
        ordersByStatus,
      },
    });
  } catch (err) { next(err); }
});

// GET /api/dashboard/revenue — revenue over time chart
router.get('/revenue', protect, adminOnly, async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    
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

    // Generate daily points between start and end
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

    res.json({ success: true, data: formattedData });
  } catch (err) { next(err); }
});

// GET /api/dashboard/revenue-by-category — bar chart data
router.get('/revenue-by-category', protect, adminOnly, async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const dateFilter = {
      ...buildDateFilter(startDate, endDate),
      status: { $ne: 'cancelled' },
    };

    // 1. Lấy tất cả categories đang active
    const categories = await Category.find({ isActive: { $ne: false } });
    const catMap = {}; // categoryId -> name
    categories.forEach(c => {
      catMap[c._id.toString()] = c.name;
    });

    // 2. Lấy tất cả products để map sang category
    const products = await Product.find({ isActive: { $ne: false } }).select('name slug categoryId');
    const prodMap = {}; // productId hoặc name -> categoryName
    for (const p of products) {
      const catName = catMap[p.categoryId?.toString()] || 'Khác';
      prodMap[p._id.toString()] = catName;
      prodMap[p.name] = catName;
      if (p.slug) prodMap[p.slug] = catName;
    }

    // 3. Aggregate order items
    const orderItems = await Order.aggregate([
      { $match: dateFilter },
      { $unwind: '$items' },
      {
        $group: {
          _id: {
            productId:   '$items.product',
            productName: '$items.productName',
          },
          totalRevenue: { $sum: { $multiply: ['$items.priceNumber', '$items.quantity'] } },
          totalQty:     { $sum: '$items.quantity' },
        },
      },
    ]);

    // 4. Tổng hợp doanh thu theo tên category
    const revenueMap = {};
    for (const item of orderItems) {
      const pId = item._id.productId ? item._id.productId.toString() : '';
      const pName = item._id.productName || '';
      const catName = prodMap[pId] || prodMap[pName] || 'Khác';
      revenueMap[catName] = (revenueMap[catName] || 0) + (item.totalRevenue || 0);
    }

    // 5. Build result theo danh sách categories
    const result = categories.map(cat => ({
      label:   cat.name,
      slug:    cat.slug,
      revenue: revenueMap[cat.name] || 0,
    }));

    // Thêm "Khác" nếu có doanh thu nằm ngoài danh mục đã biết
    const knownNames = new Set(categories.map(c => c.name));
    let otherRevenue = 0;
    for (const [key, val] of Object.entries(revenueMap)) {
      if (!knownNames.has(key)) otherRevenue += val;
    }
    if (otherRevenue > 0) {
      result.push({ label: 'Khác', slug: 'other', revenue: otherRevenue });
    }

    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// GET /api/dashboard/top-products — top selling products by quantity
router.get('/top-products', protect, adminOnly, async (req, res, next) => {
  try {
    const { startDate, endDate, limit = 10 } = req.query;
    const dateFilter = {
      ...buildDateFilter(startDate, endDate),
      status: { $ne: 'cancelled' },
    };

    const topProducts = await Order.aggregate([
      { $match: dateFilter },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.productName',
          totalQuantity: { $sum: '$items.quantity' },
          totalRevenue:  { $sum: { $multiply: ['$items.priceNumber', '$items.quantity'] } },
        },
      },
      { $sort: { totalQuantity: -1, totalRevenue: -1 } },
      { $limit: parseInt(limit) },
    ]);

    const result = topProducts.map(p => ({
      name:     p._id,
      quantity: p.totalQuantity,
      revenue:  p.totalRevenue,
    }));

    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

module.exports = router;
