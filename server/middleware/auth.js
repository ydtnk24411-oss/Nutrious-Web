const jwt  = require('jsonwebtoken');
const User = require('../models/User');

// Verify JWT — attaches req.user
const protect = async (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Không có token xác thực.' });
  }
  try {
    const token   = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'xanhla_secret');
    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Người dùng không tồn tại.' });
    }
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

module.exports = { protect, adminOnly };
