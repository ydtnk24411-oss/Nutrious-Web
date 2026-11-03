const jwt  = require('jsonwebtoken');
const User = require('../models/User');

// ── Token helpers (single source of truth for sign + verify) ────────────
const getSecret = () => process.env.JWT_SECRET || 'xanhla_secret';
const getExpiry = () => process.env.JWT_EXPIRES_IN || process.env.JWT_EXPIRE || '7d';

// Token mang id + role của đúng tài khoản đã đăng nhập
const signToken = (user) =>
  jwt.sign({ id: String(user._id), role: user.role }, getSecret(), {
    expiresIn: getExpiry(),
  });

const getBearerToken = (req) => {
  const auth = req.headers.authorization;
  return auth && auth.startsWith('Bearer ') ? auth.split(' ')[1] : null;
};

// Xác thực token → trả về user (không có password) hoặc null nếu không hợp lệ
const resolveUser = async (token) => {
  const decoded = jwt.verify(token, getSecret());
  const user = await User.findById(decoded.id).select('-password');
  return user;
};

// Bắt buộc đăng nhập – gắn req.user
const protect = async (req, res, next) => {
  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({ success: false, message: 'Không có token xác thực.' });
  }
  try {
    const user = await resolveUser(token);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Người dùng không tồn tại.' });
    }
    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Tài khoản đã bị vô hiệu hóa.' });
    }
    req.user = user;
    next();
  } catch (err) {
    next(err); // JsonWebTokenError / TokenExpiredError → errorHandler trả 401
  }
};

// Không bắt buộc đăng nhập (khách vãng lai vẫn đi tiếp).
const optionalAuth = async (req, res, next) => {
  const token = getBearerToken(req);
  if (!token) return next();
  try {
    const user = await resolveUser(token);
    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'Phiên đăng nhập không hợp lệ.' });
    }
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};

// Admin only
const adminOnly = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Chỉ admin mới có quyền truy cập.' });
  }
  next();
};

// Staff or Admin
const staffOnly = (req, res, next) => {
  if (!req.user || req.user.role === 'customer') {
    return res.status(403).json({ success: false, message: 'Yêu cầu quyền quản trị hoặc nhân viên.' });
  }
  next();
};

// Role-based access control
const hasRole = (...roles) => (req, res, next) => {
  if (!req.user || (!roles.includes(req.user.role) && req.user.role !== 'admin')) {
    return res.status(403).json({ success: false, message: 'Bạn không có quyền thực hiện thao tác này.' });
  }
  next();
};

module.exports = { protect, optionalAuth, adminOnly, staffOnly, hasRole, signToken };
