const router = require('express').Router();
const jwt = require('jsonwebtoken');
const Voucher = require('../models/Voucher');
const UserVoucher = require('../models/UserVoucher');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

function calculateDiscount(voucher, orderTotal) {
  const total = Number(orderTotal) || 0;
  const canApply = total >= (voucher.minOrderValue || 0);
  if (!canApply) return { canApply: false, discountAmount: 0 };

  let discountAmount = 0;
  if (voucher.discountType === 'percent') {
    discountAmount = Math.round((total * voucher.discountValue) / 100);
    if (voucher.maxDiscountValue > 0) {
      discountAmount = Math.min(discountAmount, voucher.maxDiscountValue);
    }
  } else {
    discountAmount = voucher.discountValue;
  }
  return { canApply: true, discountAmount };
}

// GET /api/vouchers - Get all available vouchers (public)
router.get('/', async (req, res, next) => {
  try {
    const now = new Date();
    const vouchers = await Voucher.find({
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
      $or: [
        { usageLimit: 0 },
        { $expr: { $lt: ['$usedCount', '$usageLimit'] } }
      ]
    }).sort({ createdAt: -1 });
    res.json({ success: true, data: vouchers });
  } catch (err) { next(err); }
});

// GET /api/vouchers/available-for-checkout - Public + optional auth wallet merge for checkout dropdown
router.get('/available-for-checkout', async (req, res, next) => {
  try {
    const orderTotal = Number(req.query.orderTotal) || 0;
    const now = new Date();

    let userId = null;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      try {
        const token = req.headers.authorization.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'xanhla_secret');
        if (decoded && decoded.id) userId = decoded.id;
      } catch (_) {}
    }

    const publicVouchers = await Voucher.find({
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
      $or: [
        { usageLimit: 0 },
        { $expr: { $lt: ['$usedCount', '$usageLimit'] } }
      ]
    }).sort({ createdAt: -1 });

    const savedMap = new Map();
    if (userId) {
      const userVouchers = await UserVoucher.find({
        user: userId,
        status: 'available'
      }).populate('voucher');
      for (const uv of userVouchers) {
        if (uv.voucher && uv.voucher._id) {
          savedMap.set(String(uv.voucher._id), uv);
        }
      }
    }

    const result = [];
    const seenIds = new Set();

    // First include user's saved vouchers in wallet
    for (const [vId, uv] of savedMap.entries()) {
      const v = uv.voucher;
      if (!v || !v.isActive || now < v.startDate || now > v.endDate) continue;
      seenIds.add(vId);
      const { canApply, discountAmount } = calculateDiscount(v, orderTotal);
      result.push({
        _id: uv._id,
        voucher: v,
        status: uv.status,
        receivedAt: uv.receivedAt,
        inWallet: true,
        canApply,
        discountAmount,
      });
    }

    // Then include all other public active vouchers so checkout dropdown always has offers
    for (const v of publicVouchers) {
      const vId = String(v._id);
      if (seenIds.has(vId)) continue;
      const { canApply, discountAmount } = calculateDiscount(v, orderTotal);
      result.push({
        _id: v._id,
        voucher: v,
        status: 'available',
        receivedAt: v.createdAt,
        inWallet: false,
        canApply,
        discountAmount,
      });
    }

    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// GET /api/vouchers/my - Get user's vouchers
router.get('/my', protect, async (req, res, next) => {
  try {
    const userVouchers = await UserVoucher.find({ user: req.user.id })
      .populate('voucher')
      .sort({ receivedAt: -1 });
    res.json({ success: true, data: userVouchers });
  } catch (err) { next(err); }
});

// GET /api/vouchers/my/available - Get user's available vouchers for checkout
router.get('/my/available', protect, async (req, res, next) => {
  try {
    const { orderTotal } = req.query;
    const now = new Date();
    const userVouchers = await UserVoucher.find({
      user: req.user.id,
      status: 'available'
    })
      .populate({
        path: 'voucher',
        match: {
          isActive: true,
          startDate: { $lte: now },
          endDate: { $gte: now },
        }
      })
      .sort({ receivedAt: -1 });

    const validVouchers = userVouchers
      .filter(uv => uv.voucher !== null)
      .map(uv => {
        const v = uv.voucher;
        const { canApply, discountAmount } = calculateDiscount(v, orderTotal);
        return {
          _id: uv._id,
          voucher: v,
          status: uv.status,
          receivedAt: uv.receivedAt,
          inWallet: true,
          canApply,
          discountAmount,
        };
      });

    res.json({ success: true, data: validVouchers });
  } catch (err) { next(err); }
});

// Helper to save/claim a voucher into UserVoucher wallet
async function saveVoucherToWallet(req, res, next, voucher) {
  try {
    if (!voucher || !voucher.isActive) {
      return res.status(404).json({ success: false, message: 'Voucher không tồn tại hoặc đã hết hạn.' });
    }
    const now = new Date();
    if (now < voucher.startDate || now > voucher.endDate) {
      return res.status(400).json({ success: false, message: 'Voucher chưa đến hạn hoặc đã hết hạn.' });
    }
    if (voucher.usageLimit > 0 && voucher.usedCount >= voucher.usageLimit) {
      return res.status(400).json({ success: false, message: 'Voucher đã hết lượt nhận.' });
    }
    const existing = await UserVoucher.findOne({ user: req.user.id, voucher: voucher._id });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Bạn đã lưu voucher này trong ví rồi.' });
    }
    if (voucher.pointsRequired > 0) {
      const user = await User.findById(req.user.id);
      if (!user || user.points < voucher.pointsRequired) {
        return res.status(400).json({ success: false, message: `Bạn cần ${voucher.pointsRequired} điểm để đổi voucher này.` });
      }
      user.points -= voucher.pointsRequired;
      await user.save();
    }
    const userVoucher = await UserVoucher.create({
      user: req.user.id,
      voucher: voucher._id,
      status: 'available',
    });
    const populated = await UserVoucher.findById(userVoucher._id).populate('voucher');
    res.json({ success: true, data: populated, message: 'Đã lưu voucher vào ví thành công!' });
  } catch (err) { next(err); }
}

// POST /api/vouchers/:id/save - Save a voucher to user's wallet
router.post('/:id/save', protect, async (req, res, next) => {
  try {
    const voucher = await Voucher.findById(req.params.id);
    return saveVoucherToWallet(req, res, next, voucher);
  } catch (err) { next(err); }
});

// POST /api/vouchers/:id/claim - Alias for save
router.post('/:id/claim', protect, async (req, res, next) => {
  try {
    const voucher = await Voucher.findById(req.params.id);
    return saveVoucherToWallet(req, res, next, voucher);
  } catch (err) { next(err); }
});

// POST /api/vouchers/code/:code/save - Save voucher by code
router.post('/code/:code/save', protect, async (req, res, next) => {
  try {
    const voucher = await Voucher.findOne({ code: req.params.code.toUpperCase().trim() });
    return saveVoucherToWallet(req, res, next, voucher);
  } catch (err) { next(err); }
});

// POST /api/vouchers/validate - Validate voucher code for order
router.post('/validate', async (req, res, next) => {
  try {
    const { code, orderTotal } = req.body;
    if (!code) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập mã voucher.' });
    }
    const voucher = await Voucher.findOne({ code: code.toUpperCase().trim(), isActive: true });
    if (!voucher) {
      return res.status(404).json({ success: false, message: 'Mã voucher không tồn tại hoặc đã ngừng áp dụng.' });
    }
    const now = new Date();
    if (now < voucher.startDate) {
      return res.status(400).json({ success: false, message: 'Voucher chưa đến thời gian sử dụng.' });
    }
    if (now > voucher.endDate) {
      return res.status(400).json({ success: false, message: 'Voucher đã hết hạn sử dụng.' });
    }
    if (voucher.usageLimit > 0 && voucher.usedCount >= voucher.usageLimit) {
      return res.status(400).json({ success: false, message: 'Voucher đã hết lượt sử dụng.' });
    }
    const total = Number(orderTotal) || 0;
    if (total < voucher.minOrderValue) {
      return res.status(400).json({
        success: false,
        message: `Đơn hàng tối thiểu ${voucher.minOrderValue.toLocaleString('vi-VN')}đ để áp dụng mã ${voucher.code}.`
      });
    }

    const { discountAmount } = calculateDiscount(voucher, total);

    res.json({
      success: true,
      data: {
        voucherId: voucher._id,
        code: voucher.code,
        name: voucher.name,
        description: voucher.description,
        discountType: voucher.discountType,
        discountValue: voucher.discountValue,
        discountAmount,
        maxDiscountValue: voucher.maxDiscountValue,
        minOrderValue: voucher.minOrderValue,
      }
    });
  } catch (err) { next(err); }
});

module.exports = router;
