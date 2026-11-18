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
  if (auth && auth.startsWith('Bearer ')) return auth.split(' ')[1];
  if (req.query && req.query.token) return String(req.query.token).trim();
  return null;
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
    if (user && user.isActive) {
      req.user = user;
    }
  } catch (_) {
    // Token không hợp lệ hoặc hết hạn -> tiếp tục như khách vãng lai
  }
  next();
};

// Admin only: Chỉ Super Admin cấp hệ thống mới có quyền truy cập
const adminOnly = (req, res, next) => {
  const userRole = (req.user?.role || '').toLowerCase();
  if (userRole !== 'admin') {
    return res.status(403).json({ success: false, message: 'Chỉ Quản trị viên cấp cao (Admin) mới có quyền truy cập.' });
  }
  next();
};

// Staff or Admin
const staffOnly = (req, res, next) => {
  const staffRoles = ['admin', 'manager', 'sales', 'warehouse', 'marketing', 'support', 'content'];
  const userRole = (req.user?.role || '').toLowerCase();
  if (!req.user || !staffRoles.includes(userRole)) {
    return res.status(403).json({ success: false, message: 'Yêu cầu quyền quản trị hoặc nhân viên.' });
  }
  next();
};

// Role-based access control
const authorizeRoles = (...roles) => (req, res, next) => {
  const normalizedAllowed = roles.map(r => String(r).toLowerCase());
  const userRole = String(req.user?.role || req.session?.employee?.role || '').toLowerCase();

  // Admin có quyền tối thượng
  if (userRole === 'admin') {
    return next();
  }

  if (!userRole || !normalizedAllowed.includes(userRole)) {
    return res.status(403).json({
      success: false,
      message: `Bạn không có quyền thực hiện thao tác này. Yêu cầu một trong các quyền: ${roles.join(', ')}.`,
    });
  }
  next();
};

// Helper: Lấy storeId bị giới hạn theo quyền người dùng (Quản lý kho/Admin quản lý toàn chuỗi)
const getScopedStoreId = (req) => {
  const user = req.user;
  if (!user) return null;
  const role = (user.role || '').toLowerCase();
  if (role === 'manager') {
    // Cửa hàng trưởng (Store Manager) GẮN CHẶT phạm vi quản lý tại chi nhánh được phân công
    return user.assignedStore || (Array.isArray(user.assignedStoreIds) ? user.assignedStoreIds[0] : null) || 'store-q1';
  }
  if (['admin', 'warehouse', 'sales', 'marketing', 'support', 'cskh'].includes(role)) {
    // Admin toàn quyền; Kho, Sales, Marketing có thể tra cứu theo từng kho hoặc toàn hệ thống
    return req.query?.storeId || req.query?.warehouseId || null;
  }
  const assigned = user.assignedStore;
  if (assigned && assigned !== 'all' && assigned !== 'ALL' && assigned !== 'default') {
    return assigned;
  }
  if (Array.isArray(user.assignedStoreIds) && user.assignedStoreIds.length > 0) {
    const first = user.assignedStoreIds[0];
    if (first && first !== 'ALL' && first !== 'all') return first;
  }
  return null;
};

// Middleware kiểm tra quyền theo đúng Chi nhánh (Backend Store-level Access Control)
// Hỗ trợ cả 2 cách gọi:
// 1. router.put('/:id', verifyStoreAccess('id'), ...) - Dạng factory
// 2. router.post('/adjust', verifyStoreAccess, ...) - Dạng direct middleware
const verifyStoreAccess = (paramNameOrReq, maybeRes, maybeNext) => {
  // Trường hợp gọi dạng middleware trực tiếp: verifyStoreAccess(req, res, next)
  if (paramNameOrReq && typeof paramNameOrReq === 'object' && paramNameOrReq.headers) {
    const req = paramNameOrReq;
    const res = maybeRes;
    const next = maybeNext;
    return checkStoreAccess(req, res, next, 'default');
  }

  // Trường hợp gọi dạng factory: verifyStoreAccess('id') hoặc verifyStoreAccess()
  const paramField = typeof paramNameOrReq === 'string' ? paramNameOrReq : 'id';
  return (req, res, next) => {
    checkStoreAccess(req, res, next, paramField);
  };
};

function checkStoreAccess(req, res, next, paramField) {
  const targetStoreId =
    (paramField && req.params?.[paramField]) ||
    req.body?.storeId ||
    req.params?.storeId ||
    req.query?.storeId ||
    'default';

  const user = req.user;
  if (!user) {
    return res.status(401).json({ success: false, message: 'Chưa xác thực người dùng.' });
  }

  const role = String(user.role || '').toLowerCase();
  // Quản trị viên, Quản lý kho, Quản lý chuỗi có quyền trên toàn bộ các kho
  if (['admin', 'warehouse', 'manager'].includes(role)) {
    return next();
  }

  const assigned = Array.isArray(user.assignedStoreIds) && user.assignedStoreIds.length > 0
    ? user.assignedStoreIds
    : (user.assignedStore ? [user.assignedStore] : ['default']);

  if (assigned.includes('ALL') || assigned.includes('all')) {
    return next();
  }

  // Quản lý cửa hàng (Store Manager) chỉ được thao tác trên storeId được phân công
  if (!assigned.includes(targetStoreId)) {
    return res.status(403).json({
      success: false,
      message: `Bạn chỉ có quyền quản lý chi nhánh [${assigned.join(', ')}]. Không có quyền thao tác trên kho [${targetStoreId}].`,
    });
  }

  next();
}

const hasRole = authorizeRoles;

module.exports = {
  protect,
  optionalAuth,
  adminOnly,
  staffOnly,
  hasRole,
  authorizeRoles,
  verifyStoreAccess,
  getScopedStoreId,
  signToken,
};
