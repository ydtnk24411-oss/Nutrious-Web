const router = require('express').Router();
const User   = require('../models/User');
const Order  = require('../models/Order');
const { protect, adminOnly } = require('../middleware/auth');

// GET /api/users — admin
router.get('/', protect, adminOnly, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, role } = req.query;
    const filter = {};
    if (role)   filter.role = role;
    if (search) filter.$or = [
      { name:  { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
    const skip = (Number(page) - 1) * Number(limit);
    const [users, total] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      User.countDocuments(filter),
    ]);
    res.json({ success: true, total, page: Number(page), data: users });
  } catch (err) { next(err); }
});

// GET /api/users/purchase-stats — get customer purchase statistics
router.get('/purchase-stats', protect, adminOnly, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, role } = req.query;
    const filter = {};
    if (role) filter.role = role;
    if (search) filter.$or = [
      { name:  { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
    const skip = (Number(page) - 1) * Number(limit);

    // Get users with pagination
    const [users, total] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      User.countDocuments(filter),
    ]);

    // For each user, calculate purchase stats from orders
    const usersWithStats = await Promise.all(
      users.map(async (user) => {
        const orderStats = await Order.aggregate([
          { $match: { user: user._id, status: 'delivered' } },
          {
            $group: {
              _id: '$user',
              totalSpent: { $sum: '$total' },
              orderCount: { $sum: 1 },
            },
          },
          {
            $project: {
              totalSpent: 1,
              orderCount: 1,
            },
          },
        ]);

        const lastOrder = await Order.findOne({ user: user._id, status: 'delivered' })
          .sort({ createdAt: -1 })
          .select('createdAt');

        return {
          ...user.toObject(),
          totalSpent: orderStats[0]?.totalSpent || 0,
          orderCount: orderStats[0]?.orderCount || 0,
          lastPurchaseDate: lastOrder?.createdAt || null,
        };
      })
    );

    res.json({ success: true, total, page: Number(page), data: usersWithStats });
  } catch (err) { next(err); }
});

// GET /api/users/:id — admin
router.get('/:id', protect, adminOnly, async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
});

// PUT /api/users/:id — admin (update role / isActive)
router.put('/:id', protect, adminOnly, async (req, res, next) => {
  try {
    const { role, isActive, name, phone } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role, isActive, name, phone },
      { new: true, runValidators: true }
    );
    if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
});

// DELETE /api/users/:id — admin (soft delete)
router.delete('/:id', protect, adminOnly, async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ success: true, message: 'Đã vô hiệu hoá tài khoản.' });
  } catch (err) { next(err); }
});

module.exports = router;
