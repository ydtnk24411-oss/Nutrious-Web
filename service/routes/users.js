const router = require('express').Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const Employee = require('../models/Employee');
const Order = require('../models/Order');
const bcrypt = require('bcryptjs');
const { protect, adminOnly, staffOnly } = require('../middleware/auth');
const { logAction } = require('../utils/auditLogger');

const INLINE_AVATAR_MARKER = '__INLINE_AVATAR__';

// Return a marker for oversized inline base64 avatars so list queries stay small and fast
const USER_LIST_SELECT = {
  _id: 1,
  name: 1,
  email: 1,
  phone: 1,
  role: 1,
  isActive: 1,
  employeeCode: 1,
  assignedStore: 1,
  storeName: 1,
  createdAt: 1,
  updatedAt: 1,
  points: 1,
  tier: 1,
  totalSpent: 1,
  avatar: {
    $cond: [
      {
        $and: [
          { $eq: [{ $type: '$avatar' }, 'string'] },
          { $gt: [{ $strLenCP: '$avatar' }, 0] },
        ],
      },
      {
        $cond: [
          { $lte: [{ $strLenCP: '$avatar' }, 1000] },
          '$avatar',
          INLINE_AVATAR_MARKER,
        ],
      },
      {
        $cond: [
          {
            $and: [
              { $eq: [{ $type: '$googleAvatar' }, 'string'] },
              { $lte: [{ $strLenCP: '$googleAvatar' }, 1000] },
            ],
          },
          '$googleAvatar',
          '',
        ],
      },
    ],
  },
};

function getPublicBaseUrl(req) {
  const forwardedProto = String(req.get('x-forwarded-proto') || '').split(',')[0].trim();
  const protocol = forwardedProto || req.protocol || 'http';
  const host = req.get('x-forwarded-host') || req.get('host');
  return host ? `${protocol}://${host}` : '';
}

function attachAvatarUrls(req, users) {
  const baseUrl = getPublicBaseUrl(req);
  return users.map((user) => {
    if (user.avatar !== INLINE_AVATAR_MARKER) return user;
    const version = new Date(user.updatedAt || user.createdAt || 0).getTime();
    return {
      ...user,
      avatar: `${baseUrl}/api/users/${user._id}/avatar?v=${version}`,
    };
  });
}

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
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .select(USER_LIST_SELECT)
        .lean(),
      User.countDocuments(filter),
    ]);
    res.json({ success: true, total, page: Number(page), data: attachAvatarUrls(req, users) });
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
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .select(USER_LIST_SELECT)
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

    res.json({ success: true, total, page: Number(page), data: attachAvatarUrls(req, usersWithStats) });
  } catch (err) { next(err); }
});

// POST /api/users/staff - create new staff account
router.post('/staff', protect, adminOnly, async (req, res, next) => {
  try {
    const { name, email, password, role = 'support', phone, assignedStore, storeName, department } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập tên, email và mật khẩu' });
    }
    if (password.trim().length < 6) {
      return res.status(400).json({ success: false, message: 'Mật khẩu phải từ 6 ký tự trở lên' });
    }

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Email này đã được sử dụng' });
    }

    const empCode = req.body.employeeCode || `NV-${Math.floor(1000 + Math.random() * 9000)}`;

    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      role,
      phone: phone || '',
      employeeCode: empCode,
      assignedStore: assignedStore || 'store-thuduc',
      storeName: storeName || '',
      assignedStoreIds: assignedStore ? [assignedStore] : ['store-thuduc'],
      isActive: true,
    });

    // Đồng bộ sang bảng Employee
    let dept = department || 'Vận hành siêu thị';
    const r = (role || '').toLowerCase();
    if (r === 'admin') dept = 'Ban Giám Đốc';
    else if (r === 'manager') dept = 'Quản lý chi nhánh';
    else if (r === 'warehouse') dept = 'Kho vận & Tiếp nhận';
    else if (r === 'sales') dept = 'Kinh doanh & Bán hàng';
    else if (r === 'support') dept = 'Chăm sóc khách hàng';
    else if (r === 'marketing') dept = 'Marketing & Khuyến mại';

    await Employee.findOneAndUpdate(
      { userId: user._id },
      {
        $set: {
          employeeCode: empCode,
          userId: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone || '',
          role: user.role,
          department: dept,
          assignedStore: user.assignedStore || 'all',
          assignedStoreIds: user.assignedStoreIds || ['all'],
          storeName: user.storeName || '',
          isActive: true,
        },
      },
      { upsert: true }
    );

    const userObj = user.toObject();
    delete userObj.password;

    logAction(req, {
      action: 'STAFF_CREATE',
      category: 'STAFF',
      targetType: 'User',
      targetId: user._id,
      details: `Tạo tài khoản nhân viên mới: ${user.name} (${user.email}), Mã [${empCode}], vai trò [${user.role}], Chi nhánh [${user.assignedStore}]`,
    });

    res.status(201).json({ success: true, data: userObj });
  } catch (err) { next(err); }
});

// GET /api/users/:id/avatar - serve decoded avatar image without bloating list responses
router.get('/:id/avatar', async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).end();
    }
    const user = await User.findById(req.params.id).select('avatar googleAvatar').lean();
    const raw = (typeof user?.avatar === 'string' && user.avatar) || user?.googleAvatar || '';
    if (!raw) {
      return res.status(404).end();
    }
    if (/^(https?:\/\/|\/)/i.test(raw)) {
      return res.redirect(raw);
    }
    const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s.exec(raw);
    if (!match) {
      return res.status(404).end();
    }
    const mimeType = match[1].toLowerCase();
    const buffer = Buffer.from(match[2].replace(/\s+/g, ''), 'base64');
    res.set({
      'Content-Type': mimeType,
      'Cache-Control': 'public, max-age=86400',
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'X-Content-Type-Options': 'nosniff',
      ...(mimeType === 'image/svg+xml' ? { 'Content-Security-Policy': "default-src 'none'; sandbox" } : {}),
    });
    return res.send(buffer);
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
    const { role, isActive, name, phone, password, assignedStore, storeName, department } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });

    // Bảo vệ an toàn: Quản trị viên không thể tự khóa tài khoản hoặc tự hạ quyền của chính mình
    if (String(user._id) === String(req.user?._id)) {
      if (isActive === false) {
        return res.status(400).json({ success: false, message: 'Bạn không thể tự khóa tài khoản của chính mình!' });
      }
      if (role && String(role).toLowerCase() !== 'admin') {
        return res.status(400).json({ success: false, message: 'Bạn không thể tự hạ quyền Quản trị viên của chính mình!' });
      }
    }

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

    // Đồng bộ sang bảng Employee
    let dept = department;
    if (!dept) {
      const r = (user.role || '').toLowerCase();
      if (r === 'admin') dept = 'Ban Giám Đốc';
      else if (r === 'manager') dept = 'Quản lý chi nhánh';
      else if (r === 'warehouse') dept = 'Kho vận & Tiếp nhận';
      else if (r === 'sales') dept = 'Kinh doanh & Bán hàng';
      else if (r === 'support') dept = 'Chăm sóc khách hàng';
      else if (r === 'marketing') dept = 'Marketing & Khuyến mại';
      else dept = 'Vận hành siêu thị';
    }

    await Employee.findOneAndUpdate(
      { userId: user._id },
      {
        $set: {
          name: user.name,
          email: user.email,
          phone: user.phone || '',
          role: user.role,
          department: dept,
          assignedStore: user.assignedStore || 'all',
          assignedStoreIds: user.assignedStoreIds || ['all'],
          storeName: user.storeName || '',
          isActive: user.isActive,
        },
      },
      { upsert: true }
    );

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
    if (String(req.params.id) === String(req.user?._id)) {
      return res.status(400).json({ success: false, message: 'Bạn không thể tự xóa tài khoản của chính mình!' });
    }

    const [user] = await Promise.all([
      User.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true }),
      Employee.findOneAndUpdate({ userId: req.params.id }, { isActive: false }),
    ]);

    logAction(req, {
      action: 'STAFF_DEACTIVATE',
      category: 'STAFF',
      targetType: 'User',
      targetId: req.params.id,
      details: `Vô hiệu hóa tài khoản nhân sự: ${user?.name || req.params.id}`,
    });

    res.json({ success: true, message: 'Đã vô hiệu hoá tài khoản.' });
  } catch (err) { next(err); }
});

module.exports = router;
