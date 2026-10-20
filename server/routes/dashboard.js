const router    = require('express').Router();
const Product   = require('../models/Product');
const Order     = require('../models/Order');
const User      = require('../models/User');
const Event     = require('../models/Event');
const Booking   = require('../models/Booking');
const Category  = require('../models/Category');
const { protect, adminOnly } = require('../middleware/auth');

// GET /api/dashboard/stats — admin
router.get('/stats', protect, adminOnly, async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Build date filter
    const dateFilter = {};
    if (startDate && endDate) {
      dateFilter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const [
      totalProducts,
      totalOrders,
      totalUsers,
      totalEvents,
      totalBookings,
      pendingOrders,
      revenue,
      deliveredOrders,
      recentOrders,
      ordersByStatus,
    ] = await Promise.all([
      Product.countDocuments({ isActive: true }),
      Order.countDocuments(dateFilter),
      User.countDocuments({ role: 'customer' }),
      Event.countDocuments({ isActive: true }),
      Booking.countDocuments(),
      Order.countDocuments({ ...dateFilter, status: 'pending' }),

      // Total revenue from delivered orders (consistent rule)
      Order.aggregate([
        { $match: { ...dateFilter, status: 'delivered' } },
        { $group: { _id: null, total: { $sum: '$total' } } },
      ]),

      // Count delivered orders for average calculation
      Order.countDocuments({ ...dateFilter, status: 'delivered' }),

      // Last 5 orders
      Order.find(dateFilter).sort({ createdAt: -1 }).limit(5)
        .select('orderCode guestName total status createdAt'),

      // Orders by status breakdown
      Order.aggregate([
        { $match: dateFilter },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

    const averageOrderValue = deliveredOrders > 0 ? (revenue[0]?.total ?? 0) / deliveredOrders : 0;

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

// GET /api/dashboard/revenue — monthly revenue chart
router.get('/revenue', protect, adminOnly, async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Build date filter
    const dateFilter = {};
    if (startDate && endDate) {
      dateFilter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    // Group by date (not month) for flexibility
    const data = await Order.aggregate([
      { $match: { ...dateFilter, status: 'delivered' } },
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
      { $limit: 90 }, // Limit to 90 data points
    ]);
    
    // Format date strings
    const formattedData = data.map(d => ({
      date: `${d._id.day}/${d._id.month}/${d._id.year}`,
      revenue: d.revenue,
      count: d.count,
    }));
    
    res.json({ success: true, data: formattedData });
  } catch (err) { next(err); }
});

// GET /api/dashboard/revenue-by-category — bar chart data
// Quét toàn bộ categories từ DB, tính tổng doanh thu mỗi danh mục
// dựa trên items trong orders (productName match với products có category đó)
router.get('/revenue-by-category', protect, adminOnly, async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Build date filter - only delivered orders
    const dateFilter = { status: 'delivered' };
    if (startDate && endDate) {
      dateFilter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    // 1. Lấy tất cả categories đang active
    const categories = await Category.find({ isActive: true }).sort({ order: 1 });

    // 2. Lấy tất cả products (để biết product nào thuộc category nào)
    const products = await Product.find({ isActive: true }).select('name slug categoryVi category');

    // 3. Tạo map: slug → { categoryVi, category }
    const slugToCat = {};
    for (const p of products) {
      slugToCat[p.slug] = { categoryVi: p.categoryVi, category: p.category };
      // cũng map tên sản phẩm để fallback
      slugToCat[p.name] = { categoryVi: p.categoryVi, category: p.category };
    }

    // 4. Aggregate orders — lấy tất cả order items with date filter
    const orderItems = await Order.aggregate([
      { $match: dateFilter },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.productName',
          totalRevenue: { $sum: { $multiply: ['$items.priceNumber', '$items.quantity'] } },
          totalQty:     { $sum: '$items.quantity' },
        },
      },
    ]);

    // 5. Tổng hợp doanh thu theo categoryVi
    const revenueMap = {}; // categoryVi → totalRevenue
    for (const item of orderItems) {
      const catInfo = slugToCat[item._id];
      const catLabel = catInfo?.categoryVi || catInfo?.category || 'Khác';
      revenueMap[catLabel] = (revenueMap[catLabel] || 0) + item.totalRevenue;
    }

    // 6. Build result theo thứ tự categories từ DB + thêm "Khác" nếu có
    const result = categories.map(cat => ({
      label:   cat.name,
      slug:    cat.slug,
      revenue: revenueMap[cat.name] || 0,
    }));

    // Thêm "Khác" nếu có doanh thu nằm ngoài categories đã biết
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
    
    // Build date filter - only delivered orders
    const dateFilter = { status: 'delivered' };
    if (startDate && endDate) {
      dateFilter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    // Aggregate order items by product name, sum quantities
    const topProducts = await Order.aggregate([
      { $match: dateFilter },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.productName',
          totalQuantity: { $sum: '$items.quantity' },
          totalRevenue: { $sum: { $multiply: ['$items.priceNumber', '$items.quantity'] } },
        },
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: parseInt(limit) },
    ]);

    // Map to simpler format
    const result = topProducts.map(p => ({
      name: p._id,
      quantity: p.totalQuantity,
      revenue: p.totalRevenue,
    }));

    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

module.exports = router;
