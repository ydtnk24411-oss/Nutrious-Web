const router = require('express').Router();
const { body } = require('express-validator');
const Order  = require('../models/Order');
const Product = require('../models/Product');
const InventoryLog = require('../models/InventoryLog');
const { protect, optionalAuth, adminOnly, staffOnly, hasRole } = require('../middleware/auth');
const { validate }           = require('../middleware/validate');
const { evaluateVoucher, consumeVoucher } = require('../utils/voucher');
const { creditOrderPoints }   = require('../utils/loyalty');

// POST /api/orders – khách vãng lai hoặc user đã đăng nhập.
router.post(
  '/',
  optionalAuth,
  [
    body('items').isArray({ min: 1 }).withMessage('Đơn hàng phải có ít nhất 1 sản phẩm.'),
    body('subtotal').isNumeric().withMessage('Subtotal phải là số.'),
    body('total').isNumeric().withMessage('Total phải là số.'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const orderData = { ...req.body };
      delete orderData.user;
      delete orderData.status;
      delete orderData.orderCode;

      if (req.user) {
        orderData.user       = req.user._id;
        orderData.guestName  = orderData.guestName  || req.user.name;
        orderData.guestEmail = orderData.guestEmail || req.user.email;
        orderData.guestPhone = orderData.guestPhone || req.user.phone || '';
      }
      const subtotal = Number(orderData.subtotal);
      orderData.estimatedPoints = Math.floor(subtotal / 1000);

      // Voucher
      let applied = null;
      const code = orderData.voucherCode ? String(orderData.voucherCode).trim() : '';
      if (code) {
        applied = await evaluateVoucher(code, subtotal, req.user?._id);
        if (!applied.valid) {
          return res.status(400).json({ success: false, message: applied.message });
        }
      }
      orderData.voucherCode = applied ? applied.voucher.code : '';
      orderData.discount    = applied ? applied.discount : 0;
      orderData.total = Math.max(0, subtotal - orderData.discount + (Number(orderData.shippingFee) || 0));

      const order = await Order.create(orderData);
      if (applied) await consumeVoucher(applied, req.user?._id, order._id);

      // Deduct product stock automatically
      for (const item of order.items) {
        if (item.product) {
          const prod = await Product.findById(item.product);
          if (prod) {
            const oldStock = prod.stock ?? 0;
            const newStock = Math.max(0, oldStock - item.quantity);
            prod.stock = newStock;
            await prod.save();

            await InventoryLog.create({
              product: prod._id,
              productName: prod.name,
              type: 'order_confirmed',
              delta: -item.quantity,
              oldStock,
              newStock,
              reason: `Đơn hàng ${order.orderCode}`,
              note: `Trừ kho khi tạo đơn hàng`,
              updatedBy: req.user?._id || null,
            });
          }
        }
      }

      res.status(201).json({
        success: true,
        data: { orderCode: order.orderCode, _id: order._id, discount: order.discount, total: order.total },
      });
    } catch (err) { next(err); }
  }
);

// GET /api/orders — admin & sales & support: all orders with filters
router.get('/', protect, staffOnly, async (req, res, next) => {
  try {
    const { status, paymentMethod, page = 1, limit = 20, search, startDate, endDate, user, userId } = req.query;
    const filter = {};
    if (user || userId) filter.user = user || userId;
    if (status && status !== 'all') filter.status = status;
    if (paymentMethod && paymentMethod !== 'all') filter.paymentMethod = paymentMethod;

    if (search) {
      filter.$or = [
        { orderCode: { $regex: search, $options: 'i' } },
        { guestName:  { $regex: search, $options: 'i' } },
        { guestEmail: { $regex: search, $options: 'i' } },
        { guestPhone: { $regex: search, $options: 'i' } },
      ];
    }

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filter.createdAt = { $gte: start, $lte: end };
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [orders, total] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit))
        .populate('user', 'name email phone'),
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
    const userId = req.user._id;
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
      .populate('user', 'name email phone');
    if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
    
    const isOwner = (order.user && (order.user._id?.toString() === req.user.id || order.user.toString() === req.user.id)) ||
                    (!order.user && order.guestEmail === req.user.email);
    if (!isOwner && req.user.role !== 'admin' && req.user.role !== 'sales') {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền xem đơn hàng này.' });
    }
    res.json({ success: true, data: order });
  } catch (err) { next(err); }
});

// PUT /api/orders/:id/status — admin/sales status update with stock compensation on cancel
router.put('/:id/status', protect, hasRole('sales', 'admin'), async (req, res, next) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending','confirmed','preparing','shipping','delivered','cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Trạng thái không hợp lệ.' });
    }

    const currentOrder = await Order.findById(req.params.id);
    if (!currentOrder) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
    }

    const previousStatus = currentOrder.status;
    currentOrder.status = status;
    await currentOrder.save();

    // If order was cancelled from active state, return items to inventory
    if (status === 'cancelled' && previousStatus !== 'cancelled') {
      for (const item of currentOrder.items) {
        if (item.product) {
          const prod = await Product.findById(item.product);
          if (prod) {
            const oldStock = prod.stock ?? 0;
            const newStock = oldStock + item.quantity;
            prod.stock = newStock;
            await prod.save();

            await InventoryLog.create({
              product: prod._id,
              productName: prod.name,
              type: 'order_cancel',
              delta: item.quantity,
              oldStock,
              newStock,
              reason: `Hủy đơn ${currentOrder.orderCode}`,
              note: `Hoàn tồn tự động do đơn hàng bị hủy`,
              updatedBy: req.user?._id || null,
            });
          }
        }
      }
    }

    if (status === 'delivered') {
      await creditOrderPoints(currentOrder._id);
    }

    res.json({ success: true, data: currentOrder });
  } catch (err) { next(err); }
});

module.exports = router;
