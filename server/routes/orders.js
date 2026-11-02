const router = require('express').Router();
const jwt    = require('jsonwebtoken');
const { body } = require('express-validator');
const Order  = require('../models/Order');
const Voucher = require('../models/Voucher');
const UserVoucher = require('../models/UserVoucher');
const { protect, adminOnly } = require('../middleware/auth');
const { validate }           = require('../middleware/validate');

// POST /api/orders — public (guest checkout)
router.post(
  '/',
  [
    body('items').isArray({ min: 1 }).withMessage('Đơn hàng phải có ít nhất 1 sản phẩm.'),
    body('subtotal').isNumeric().withMessage('Subtotal phải là số.'),
    body('total').isNumeric().withMessage('Total phải là số.'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const orderData = { ...req.body };
      if (!orderData.user && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        try {
          const token = req.headers.authorization.split(' ')[1];
          const decoded = jwt.verify(token, process.env.JWT_SECRET || 'xanhla_secret');
          if (decoded && decoded.id) {
            orderData.user = decoded.id;
          }
        } catch (_) {}
      }
      const order = await Order.create(orderData);

      // Update voucher usage if voucherCode was applied
      if (orderData.voucherCode) {
        try {
          const voucher = await Voucher.findOne({ code: orderData.voucherCode.toUpperCase().trim() });
          if (voucher) {
            voucher.usedCount = (voucher.usedCount || 0) + 1;
            await voucher.save();

            if (orderData.user) {
              await UserVoucher.findOneAndUpdate(
                { user: orderData.user, voucher: voucher._id, status: 'available' },
                { status: 'used', usedAt: new Date(), orderId: order._id }
              );
            }
          }
        } catch (voucherErr) {
          console.error('Error updating voucher status:', voucherErr);
        }
      }

      res.status(201).json({ success: true, data: { orderCode: order.orderCode, _id: order._id } });
    } catch (err) { next(err); }
  }
);

// GET /api/orders — admin: all orders with filters
router.get('/', protect, adminOnly, async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20, search } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (search) filter.$or = [
      { orderCode: { $regex: search, $options: 'i' } },
      { guestName:  { $regex: search, $options: 'i' } },
      { guestEmail: { $regex: search, $options: 'i' } },
    ];

    const skip = (Number(page) - 1) * Number(limit);
    const [orders, total] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit))
        .populate('user', 'name email'),
      Order.countDocuments(filter),
    ]);
    res.json({ success: true, total, page: Number(page), data: orders });
  } catch (err) { next(err); }
});

// GET /api/orders/track/:code — public order tracking
router.get('/track/:code', async (req, res, next) => {
  try {
    const order = await Order.findOne({ orderCode: req.params.code })
      .populate('items.product', 'name image');
    if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
    res.json({ success: true, data: order });
  } catch (err) { next(err); }
});

// GET /api/orders/my — get current user's orders
router.get('/my', protect, async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20, search } = req.query;
    const userId = req.user._id || req.user.id;
    const userEmail = req.user.email;
    const filter = {
      $or: [
        { user: userId },
        ...(userEmail ? [{ user: null, guestEmail: userEmail }, { user: { $exists: false }, guestEmail: userEmail }] : [])
      ]
    };
    if (status && status !== 'all') filter.status = status;
    if (search) filter.orderCode = { $regex: search, $options: 'i' };

    const skip = (Number(page) - 1) * Number(limit);
    const [orders, total] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      Order.countDocuments(filter),
    ]);
    res.json({ success: true, total, page: Number(page), data: orders });
  } catch (err) { next(err); }
});

// GET /api/orders/:code — get order by code (authenticated)
router.get('/:code', protect, async (req, res, next) => {
  try {
    const order = await Order.findOne({ orderCode: req.params.code })
      .populate('user', 'name email');
    if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
    // Check if user owns this order or is admin
    const isOwner = (order.user && (order.user._id?.toString() === req.user.id || order.user.toString() === req.user.id)) ||
                    (!order.user && order.guestEmail === req.user.email);
    if (!isOwner && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền xem đơn hàng này.' });
    }
    res.json({ success: true, data: order });
  } catch (err) { next(err); }
});

// GET /api/orders/:id — admin
router.get('/:id', protect, adminOnly, async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id).populate('user', 'name email');
    if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
    res.json({ success: true, data: order });
  } catch (err) { next(err); }
});

// PUT /api/orders/:id/status — admin
router.put('/:id/status', protect, adminOnly, async (req, res, next) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending','confirmed','preparing','shipping','delivered','cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Trạng thái không hợp lệ.' });
    }
    const order = await Order.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
    res.json({ success: true, data: order });
  } catch (err) { next(err); }
});

module.exports = router;
