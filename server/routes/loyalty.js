const router = require('express').Router();
const User = require('../models/User');
const { protect } = require('../middleware/auth');

// GET /api/loyalty/my - Get user loyalty info
router.get('/my', protect, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('points tier totalSpent');
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
    }
    // Calculate next tier
    const tierThresholds = {
      bronze: 0,
      silver: 500000,
      gold: 2000000,
      platinum: 5000000,
    };
    const currentThreshold = tierThresholds[user.tier];
    const nextTier = Object.keys(tierThresholds).find(key => tierThresholds[key] > currentThreshold);
    const nextThreshold = nextTier ? tierThresholds[nextTier] : null;
    const progress = nextThreshold ? ((user.totalSpent - currentThreshold) / (nextThreshold - currentThreshold)) * 100 : 100;
    res.json({
      success: true,
      data: {
        points: user.points,
        tier: user.tier,
        totalSpent: user.totalSpent,
        nextTier,
        nextThreshold,
        progress: Math.min(100, Math.max(0, progress)),
      },
    });
  } catch (err) { next(err); }
});

// POST /api/loyalty/redeem - Redeem points for reward
router.post('/redeem', protect, async (req, res, next) => {
  try {
    const { points, rewardName } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
    }
    if (user.points < points) {
      return res.status(400).json({ success: false, message: 'Điểm không đủ.' });
    }
    if (points <= 0) {
      return res.status(400).json({ success: false, message: 'Số điểm không hợp lệ.' });
    }
    user.points -= points;
    await user.save();
    res.json({ success: true, message: `Đổi ${points} điểm thành công.`, data: { points: user.points } });
  } catch (err) { next(err); }
});

module.exports = router;
