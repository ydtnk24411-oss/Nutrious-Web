const router = require('express').Router();
const Voucher = require('../models/Voucher');
const UserVoucher = require('../models/UserVoucher');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

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

// GET /api/vouchers/my - Get user's vouchers
router.get('/my', protect, async (req, res, next) => {
  try {
    const userVouchers = await UserVoucher.find({ user: req.user.id })
      .populate('voucher')
      .sort({ receivedAt: -1 });
    res.json({ success: true, data: userVouchers });
  } catch (err) { next(err); }
});

// POST /api/vouchers/:id/claim - Claim a voucher
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
    // Check if user already claimed
    const existing = await UserVoucher.findOne({ user: req.user.id, voucher: req.params.id });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Bạn đã nhận voucher này rồi.' });
    }
    // Check points required
    const user = await User.findById(req.user.id);
    if (voucher.pointsRequired > 0 && user.points < voucher.pointsRequired) {
      return res.status(400).json({ success: false, message: `Bạn cần ${voucher.pointsRequired} điểm để nhận voucher này.` });
    }
    // Deduct points if required
    if (voucher.pointsRequired > 0) {
      user.points -= voucher.pointsRequired;
      await user.save();
    }
    // Create user voucher
    const userVoucher = await UserVoucher.create({
      user: req.user.id,
      voucher: req.params.id,
      status: 'available',
    });
    // Increment used count
    voucher.usedCount += 1;
    await voucher.save();
    res.json({ success: true, data: userVoucher });
  } catch (err) { next(err); }
});

module.exports = router;
