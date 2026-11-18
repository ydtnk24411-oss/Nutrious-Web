const router = require('express').Router();
const User = require('../models/User');
const Order = require('../models/Order');
const bcrypt = require('bcryptjs');
const { protect, adminOnly, staffOnly } = require('../middleware/auth');
const { logAction } = require('../utils/auditLogger');

// GET /api/users - admin/staff list
router.get('/', protect, staffOnly, async (req, res, next) => {
  try {
    const { page = 1, limit = 50, search, role } = req.query;
    const filter = {};
    if (role === 'staff') {
      filter.role = { $in: ['admin', 'manager', 'sales', 'warehouse', 'support', 'content', 'marketing'] };
    } else if (role && role !== 'all') {
      filter.role = role;
    }

    // Quản lý cửa hàng (Manager) chỉ được xem khách hàng hoặc nhân viên thuộc quyền, không được xem Admin / Manager khác
    if (req.user?.role === 'manager') {
      if (!role || role === 'all') {
        filter.role = { $nin: ['admin', 'manager', 'Admin', 'Manager'] };
      }
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }
    const skip = (Number(page) - 1) * Number(limit);
    const [users, total] = await Promise.all([
      User.find(filter)
        .sort({ _id: -1 })
        .skip(skip)
        .limit(Number(limit))
        .select('_id name email phone role isActive avatar employeeCode assignedStore storeName createdAt points tier totalSpent')
        .lean(),
      User.countDocuments(filter),
    ]);
    res.json({ success: true, total, page: Number(page), data: users });
  } catch (err) { next(err); }
});

// GET /api/users/purchase-stats - get customer purchase statistics (mặc định chỉ lọc khách hàng)
router.get('/purchase-stats', protect, staffOnly, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, role } = req.query;
    const filter = {};
    if (role && role !== 'all') {
      filter.role = role;
    } else {
      filter.role = 'customer';
    }
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }
    const skip = (Number(page) - 1) * Number(limit);

    const [users, total] = await Promise.all([
      User.find(filter)
        .sort({ _id: -1 })
        .skip(skip)
        .limit(Number(limit))
        .select('_id name email phone role isActive avatar employeeCode assignedStore storeName createdAt points tier totalSpent')
        .lean(),
      User.countDocuments(filter),
    ]);

    const userIds = users.map((u) => u._id);
    const statMap = new Map();

    if (userIds.length > 0) {
      const orderStats = await Order.aggregate([
        { $match: { user: { $in: userIds }, status: { $ne: 'cancelled' } } },
        {
          $group: {
            _id: '$user',
            totalSpent: { $sum: '$total' },
            orderCount: { $sum: 1 },
            lastPurchaseDate: { $max: '$createdAt' },
          },
        },
      ]);

      orderStats.forEach((s) => {
        statMap.set(String(s._id), s);
      });
    }

    const usersWithStats = users.map((user) => {
      const s = statMap.get(String(user._id));
      return {
        ...user,
        totalSpent: s?.totalSpent || 0,
        orderCount: s?.orderCount || 0,
        lastPurchaseDate: s?.lastPurchaseDate || null,
      };
    });

    res.json({ success: true, total, page: Number(page), data: usersWithStats });
  } catch (err) { next(err); }
});

// POST /api/users/staff - create new staff account
router.post('/staff', protect, adminOnly, async (req, res, next) => {
  try {
    const { name, email, password, role = 'support', phone, assignedStore, storeName } = req.body;
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
      assignedStore: assignedStore || 'store-thuduc',
      storeName: storeName || '',
      assignedStoreIds: assignedStore ? [assignedStore] : ['store-thuduc'],
      isActive: true,
    });

    const userObj = user.toObject();
    delete userObj.password;

    logAction(req, {
      action: 'STAFF_CREATE',
      category: 'STAFF',
      targetType: 'User',
      targetId: user._id,
      details: `Tạo tài khoản nhân viên mới: ${user.name} (${user.email}) với vai trò [${user.role}], Chi nhánh [${user.assignedStore}]`,
    });

    res.status(201).json({ success: true, data: userObj });
  } catch (err) { next(err); }
});

// GET /api/users/:id - admin
router.get('/:id', protect, staffOnly, async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
});

// PUT /api/users/:id - admin (update role / isActive / profile)
router.put('/:id', protect, adminOnly, async (req, res, next) => {
  try {
    const { role, isActive, name, phone, password, assignedStore, storeName } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });

    if (role !== undefined) user.role = role;
    if (isActive !== undefined) user.isActive = isActive;
    if (name) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (assignedStore !== undefined) {
      user.assignedStore = assignedStore;
      user.assignedStoreIds = [assignedStore];
    }
    if (storeName !== undefined) user.storeName = storeName;
    if (password && password.trim().length >= 6) {
      user.password = password.trim();
    }

    await user.save();
    const userObj = user.toObject();
    delete userObj.password;

    logAction(req, {
      action: 'STAFF_UPDATE',
      category: 'STAFF',
      targetType: 'User',
      targetId: user._id,
      details: `Cập nhật thông tin nhân sự [${user.name}]: Vai trò=${user.role}, Chi nhánh=${user.assignedStore}, Trạng thái=${user.isActive ? 'Hoạt động' : 'Đã khóa'}${password ? ', Đổi mật khẩu mới' : ''}`,
    });

    res.json({ success: true, data: userObj });
  } catch (err) { next(err); }
});

// DELETE /api/users/:id - admin (soft delete)
router.delete('/:id', protect, adminOnly, async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ success: true, message: 'Đã vô hiệu hoá tài khoản.' });
  } catch (err) { next(err); }
});

module.exports = router;
