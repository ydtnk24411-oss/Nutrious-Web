const router = require('express').Router();
const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');
const Event = require('../models/Event');
const Booking = require('../models/Booking');
const Category = require('../models/Category');
const Complaint = require('../models/Complaint');
const Conversation = require('../models/Conversation');
const Voucher = require('../models/Voucher');
const Review = require('../models/Review');
const { protect, staffOnly } = require('../middleware/auth');

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
    const dateFilter = buildDateFilter(startDate, endDate);
    const now = new Date();

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
      lowStockCount,
      outOfStockCount,
      pendingComplaintsCount,
      waitingSupportCount,
      activeVouchersCount,
      reviews,
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

      // Low stock count (<= 10 and > 0)
      Product.countDocuments({ isActive: { $ne: false }, stock: { $gt: 0, $lte: 10 } }),

      // Out of stock count (<= 0)
      Product.countDocuments({ isActive: { $ne: false }, stock: { $lte: 0 } }),

      // Pending complaints
      Complaint.countDocuments({ status: 'pending' }),

      // Waiting live chat
      Conversation.countDocuments({ status: 'WAITING_FOR_ADMIN' }),

      // Active vouchers
      Voucher.countDocuments({ isActive: true, endDate: { $gte: now } }),

      // Reviews summary
      Review.find({ isHidden: { $ne: true } }).select('rating'),
    ]);

    const averageOrderValue = validOrdersCount > 0 ? (revenue[0]?.total ?? 0) / validOrdersCount : 0;

    let reviewSum = 0;
    reviews.forEach((r) => (reviewSum += r.rating || 0));
    const averageRating = reviews.length ? Math.round((reviewSum / reviews.length) * 10) / 10 : 0;

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
        lowStockCount,
        outOfStockCount,
        pendingComplaintsCount,
        waitingSupportCount,
        activeVouchersCount,
        reviewStats: {
          averageRating,
          totalReviews: reviews.length,
        },
      },
    });
  } catch (err) { next(err); }
});

// GET /api/dashboard/revenue — revenue over time chart
router.get('/revenue', protect, staffOnly, async (req, res, next) => {
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
router.get('/revenue-by-category', protect, staffOnly, async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
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

    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// GET /api/dashboard/top-products — top selling products
router.get('/top-products', protect, staffOnly, async (req, res, next) => {
  try {
    const { startDate, endDate, limit = 5 } = req.query;
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

    res.json({ success: true, data: top });
  } catch (err) { next(err); }
});

module.exports = router;
