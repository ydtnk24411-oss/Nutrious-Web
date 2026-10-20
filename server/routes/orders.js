const router = require('express').Router();
const { body } = require('express-validator');
const Order  = require('../models/Order');
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
      const order = await Order.create(req.body);
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
    const filter = { user: req.user.id };
    if (status) filter.status = status;
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
    if (order.user && order.user._id.toString() !== req.user.id && req.user.role !== 'admin') {
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
