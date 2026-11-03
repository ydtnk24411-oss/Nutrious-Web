const router = require('express').Router();
const Voucher = require('../models/Voucher');
const UserVoucher = require('../models/UserVoucher');
const User = require('../models/User');
const PointTransaction = require('../models/PointTransaction');
const { protect, optionalAuth } = require('../middleware/auth');
const { evaluateVoucher } = require('../utils/voucher');

// GET /api/vouchers - voucher đang hoạt động (public)
router.get('/', async (req, res, next) => {
  try {
    const now = new Date();
    const vouchers = await Voucher.find({
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
      $or: [
        { usageLimit: 0 },
        { $expr: { $lt: ['$usedCount', '$usageLimit'] } },
      ],
    }).sort({ createdAt: -1 });
    res.json({ success: true, data: vouchers });
  } catch (err) { next(err); }
});

// GET /api/vouchers/my - voucher của tài khoản đang đăng nhập
router.get('/my', protect, async (req, res, next) => {
  try {
    const userVouchers = await UserVoucher.find({ user: req.user._id })
      .populate('voucher')
      .sort({ receivedAt: -1 });
    const now = new Date();
    const data = userVouchers
      .filter((uv) => uv.voucher)
      .map((uv) => {
        const o = uv.toObject();
        if (o.status === 'available' && o.voucher.endDate < now) o.status = 'expired';
        return o;
      });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// POST /api/vouchers/validate - kiểm tra mã + tính số tiền giảm (khách hoặc user)
router.post('/validate', optionalAuth, async (req, res, next) => {
  try {
    const subtotal = Number(req.body.subtotal) || 0;
    const r = await evaluateVoucher(req.body.code, subtotal, req.user?._id);
    if (!r.valid) return res.json({ success: true, valid: false, message: r.message, discount: 0 });
    res.json({
      success: true,
      valid: true,
      discount: r.discount,
      data: { code: r.voucher.code, name: r.voucher.name },
    });
  } catch (err) { next(err); }
});

// POST /api/vouchers/:id/claim - thu thập voucher (trừ điểm nếu voucher yêu cầu điểm)
router.post('/:id/claim', protect, async (req, res, next) => {
  try {
    const voucher = await Voucher.findById(req.params.id);
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
    const existing = await UserVoucher.findOne({ user: req.user._id, voucher: voucher._id });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Bạn đã nhận voucher này rồi.' });
    }

    // Trừ điểm nguyên tử: chỉ trừ khi còn đủ điểm
    let balanceAfter = req.user.points;
    if (voucher.pointsRequired > 0) {
      const updated = await User.findOneAndUpdate(
        { _id: req.user._id, points: { $gte: voucher.pointsRequired } },
        { $inc: { points: -voucher.pointsRequired } },
        { new: true }
      );
      if (!updated) {
        return res.status(400).json({
          success: false,
          message: `Bạn cần ${voucher.pointsRequired} điểm để nhận voucher này.`,
        });
      }
      balanceAfter = updated.points;
      await PointTransaction.create({
        user: req.user._id,
        type: 'redeemed',
        amount: -voucher.pointsRequired,
        description: `Đổi voucher ${voucher.code}`,
        voucherCode: voucher.code,
        balanceAfter,
      });
    }

    const userVoucher = await UserVoucher.create({
      user: req.user._id, voucher: voucher._id, status: 'available',
    });
    await Voucher.updateOne({ _id: voucher._id }, { $inc: { usedCount: 1 } });
    res.json({ success: true, data: userVoucher, points: balanceAfter });
  } catch (err) { next(err); }
});

module.exports = router;
