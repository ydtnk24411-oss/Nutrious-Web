const router = require('express').Router();
const User = require('../models/User');
const Order = require('../models/Order');
const bcrypt = require('bcryptjs');
const { protect, adminOnly, staffOnly } = require('../middleware/auth');

// GET /api/users — admin/staff list
router.get('/', protect, staffOnly, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, role } = req.query;
    const filter = {};
    if (role && role !== 'all') filter.role = role;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }
    const skip = (Number(page) - 1) * Number(limit);
    const [users, total] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      User.countDocuments(filter),
    ]);
    res.json({ success: true, total, page: Number(page), data: users });
  } catch (err) { next(err); }
});

// GET /api/users/purchase-stats — get customer purchase statistics
router.get('/purchase-stats', protect, staffOnly, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, role } = req.query;
    const filter = {};
    if (role && role !== 'all') filter.role = role;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }
    const skip = (Number(page) - 1) * Number(limit);

    const [users, total] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      User.countDocuments(filter),
    ]);

    const usersWithStats = await Promise.all(
      users.map(async (user) => {
        const orderStats = await Order.aggregate([
          { $match: { user: user._id, status: { $ne: 'cancelled' } } },
          {
            $group: {
              _id: '$user',
              totalSpent: { $sum: '$total' },
              orderCount: { $sum: 1 },
            },
          },
        ]);

        const lastOrder = await Order.findOne({ user: user._id, status: { $ne: 'cancelled' } })
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

// POST /api/users/staff — create new staff account
router.post('/staff', protect, adminOnly, async (req, res, next) => {
  try {
    const { name, email, password, role = 'support', phone } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập tên, email và mật khẩu' });
    }

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Email này đã được sử dụng' });
    }

    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      role,
      phone: phone || '',
      isActive: true,
    });

    const userObj = user.toObject();
    delete userObj.password;

    res.status(201).json({ success: true, data: userObj });
  } catch (err) { next(err); }
});

// GET /api/users/:id — admin
router.get('/:id', protect, staffOnly, async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
});

// PUT /api/users/:id — admin (update role / isActive / profile)
router.put('/:id', protect, adminOnly, async (req, res, next) => {
  try {
    const { role, isActive, name, phone, password } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });

    if (role !== undefined) user.role = role;
    if (isActive !== undefined) user.isActive = isActive;
    if (name) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (password && password.trim().length >= 6) {
      user.password = password.trim();
    }

    await user.save();
    const userObj = user.toObject();
    delete userObj.password;

    res.json({ success: true, data: userObj });
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
