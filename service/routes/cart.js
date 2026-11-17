const router = require('express').Router();
const Cart = require('../models/Cart');
const { optionalAuth, protect, staffOnly, authorizeRoles } = require('../middleware/auth');

// POST /api/cart/sync — Đồng bộ giỏ hàng từ Storefront lên Server (Bắt buộc đăng nhập tài khoản)
router.post('/sync', protect, async (req, res, next) => {
  try {
    const { items = [], totalAmount = 0, customerName = '', customerEmail = '', customerPhone = '' } = req.body;
    const sessionId = req.sessionID || req.headers['x-session-id'] || req.cookies?.sessionId || 'session_' + Math.random().toString(36).substring(2);
    const customerId = req.user?._id || req.session?.customer?.id || null;

    const query = customerId
      ? { $or: [{ customerId }, { sessionId, status: 'Active' }] }
      : { sessionId, status: 'Active' };

    let cart = await Cart.findOne(query).sort({ updatedAt: -1 });

    const formattedItems = (Array.isArray(items) ? items : []).map(it => ({
      product: String(it.id || it.product || it._id || ''),
      productName: String(it.name || it.productName || ''),
      productImage: String(it.image || it.productImage || ''),
      price: Number(it.priceNumber || it.price || 0),
      quantity: Math.max(1, Number(it.quantity) || 1),
      selectedOption: String(it.selectedOption || ''),
      isCombo: Boolean(it.isCombo),
      addedAt: it.addedAt ? new Date(it.addedAt) : new Date(),
    }));

    const itemCount = formattedItems.reduce((sum, i) => sum + i.quantity, 0);

    if (!cart) {
      cart = await Cart.create({
        customerId,
        sessionId,
        customerName: customerName || req.user?.name || req.session?.customer?.name || '',
        customerEmail: customerEmail || req.user?.email || req.session?.customer?.email || '',
        customerPhone: customerPhone || req.user?.phone || req.session?.customer?.phone || '',
        items: formattedItems,
        totalAmount: Number(totalAmount) || 0,
        itemCount,
        status: 'Active',
        lastUpdatedAt: new Date(),
      });
    } else {
      cart.items = formattedItems;
      cart.totalAmount = Number(totalAmount) || 0;
      cart.itemCount = itemCount;
      cart.status = 'Active'; // Reset về Active khi khách còn thao tác
      cart.lastUpdatedAt = new Date();
      if (customerId && !cart.customerId) cart.customerId = customerId;
      if (customerName) cart.customerName = customerName;
      if (customerEmail) cart.customerEmail = customerEmail;
      if (customerPhone) cart.customerPhone = customerPhone;
      await cart.save();
    }

    res.json({ success: true, data: cart });
  } catch (err) { next(err); }
});

// GET /api/cart — Lấy giỏ hàng đang lưu trên server
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const sessionId = req.sessionID || req.headers['x-session-id'] || req.cookies?.sessionId || '';
    const customerId = req.user?._id || req.session?.customer?.id || null;

    const query = customerId
      ? { customerId, status: 'Active' }
      : { sessionId, status: 'Active' };

    const cart = await Cart.findOne(query).sort({ updatedAt: -1 });
    res.json({ success: true, data: cart });
  } catch (err) { next(err); }
});

// GET /api/cart/admin/abandoned — Danh sách giỏ hàng bị bỏ rơi & Báo cáo phục hồi cho Sales
router.get('/admin/abandoned', protect, staffOnly, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, minAmount = 0 } = req.query;
    const filter = { status: 'Abandoned' };
    if (minAmount > 0) filter.totalAmount = { $gte: Number(minAmount) };

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [abandonedCarts, totalAbandoned, allCartsStats] = await Promise.all([
      Cart.find(filter)
        .populate('customerId', 'name email phone')
        .sort({ lastUpdatedAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Cart.countDocuments(filter),
      Cart.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalRevenue: { $sum: '$totalAmount' },
          },
        },
      ]),
    ]);

    let totalCarts = 0;
    let convertedCarts = 0;
    let potentialLostRevenue = 0;

    for (const stat of allCartsStats) {
      totalCarts += stat.count;
      if (stat._id === 'Converted') convertedCarts = stat.count;
      if (stat._id === 'Abandoned') potentialLostRevenue = stat.totalRevenue;
    }

    const abandonmentRate = totalCarts > 0
      ? Math.round((totalAbandoned / totalCarts) * 100)
      : 68; // Tỷ lệ chuẩn ngành khi chưa đủ dữ liệu

    res.json({
      success: true,
      stats: {
        totalCarts,
        totalAbandoned,
        convertedCarts,
        abandonmentRate,
        potentialLostRevenue,
      },
      page: pageNum,
      totalPages: Math.ceil(totalAbandoned / limitNum) || 1,
      data: abandonedCarts,
    });
  } catch (err) { next(err); }
});

// Tiến trình quét tự động (Background Cron / Interval Job): Mỗi 5 phút quét giỏ Active quá 60 phút
function startCartAbandonmentJob() {
  const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 phút
  const ABANDON_THRESHOLD_MS = 60 * 60 * 1000; // 60 phút không tương tác

  setInterval(async () => {
    try {
      const thresholdDate = new Date(Date.now() - ABANDON_THRESHOLD_MS);
      const res = await Cart.updateMany(
        {
          status: 'Active',
          lastUpdatedAt: { $lte: thresholdDate },
          itemCount: { $gt: 0 },
        },
        { $set: { status: 'Abandoned' } }
      );
      if (res.modifiedCount > 0) {
        console.log(`[CartCron] Đã nhận diện và chuyển ${res.modifiedCount} giỏ hàng sang trạng thái "Abandoned".`);
      }
    } catch (err) {
      console.error('[CartCron] Lỗi quét giỏ hàng bỏ rơi:', err.message);
    }
  }, CHECK_INTERVAL_MS).unref();
}

startCartAbandonmentJob();

module.exports = router;
