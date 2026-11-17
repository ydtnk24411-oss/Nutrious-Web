const router = require('express').Router();
const User = require('../models/User');
const PointTransaction = require('../models/PointTransaction');
const { protect } = require('../middleware/auth');
const { getLoyaltyConfig, tierFor, syncUserLoyalty } = require('../utils/loyalty');

// GET /api/loyalty/rewards - danh sách quà đổi điểm đọc từ MongoDB (public)
router.get('/rewards', async (_req, res, next) => {
  try {
    const config = await getLoyaltyConfig();
    res.json({ success: true, data: config.rewards || [] });
  } catch (err) {
    next(err);
  }
});

// GET /api/loyalty/my - điểm, hạng và lịch sử điểm của tài khoản đang đăng nhập
router.get('/my', protect, async (req, res, next) => {
  try {
    const [user, config, transactions] = await Promise.all([
      syncUserLoyalty(req.user._id),
      getLoyaltyConfig(),
      PointTransaction.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(100),
    ]);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
    }
    res.json({
      success: true,
      data: {
        points: user.points,
        totalSpent: user.totalSpent,
        tier: tierFor(user.points, user.totalSpent, config.tiers),
        transactions: transactions.map((t) => ({
          id: String(t._id),
          userId: String(t.user),
          type: t.type,
          amount: t.amount,
          description: t.description,
          orderId: t.order || undefined,
          rewardId: t.rewardId || undefined,
          createdAt: t.createdAt,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/loyalty/redeem - đổi điểm lấy quà { rewardId }
router.post('/redeem', protect, async (req, res, next) => {
  try {
    const config = await getLoyaltyConfig();
    const reward = (config.rewards || []).find((r) => r.id === req.body.rewardId);
    if (!reward) {
      return res.status(404).json({ success: false, message: 'Quà tặng không tồn tại.' });
    }
    // Trừ điểm nguyên tử: chỉ trừ khi còn đủ điểm
    const user = await User.findOneAndUpdate(
      { _id: req.user._id, points: { $gte: reward.pointsRequired } },
      { $inc: { points: -reward.pointsRequired } },
      { new: true }
    );
    if (!user) {
      return res.status(400).json({ success: false, message: 'Điểm không đủ.' });
    }
    await PointTransaction.create({
      user: user._id,
      type: 'redeemed',
      amount: -reward.pointsRequired,
      description: `Đổi quà: ${reward.name}`,
      rewardId: reward.id,
      balanceAfter: user.points,
    });
    res.json({
      success: true,
      message: `Đổi ${reward.pointsRequired} điểm thành công.`,
      data: { points: user.points },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
