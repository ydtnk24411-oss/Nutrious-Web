const jwt  = require('jsonwebtoken');
const User = require('../models/User');

// Verify JWT — attaches req.user
const protect = async (req, res, next) => {
  const auth = req.headers.authorization;
  console.log('Auth middleware - Authorization header:', auth ? 'Present' : 'Missing');

  if (!auth || !auth.startsWith('Bearer ')) {
    console.log('Auth failed: No valid token');
    return res.status(401).json({ success: false, message: 'Không có token xác thực.' });
  }
  try {
    const token   = auth.split(' ')[1];
    console.log('Token length:', token.length);
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'xanhla_secret');
    console.log('Token decoded, user ID:', decoded.id);
    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user) {
      console.log('Auth failed: User not found');
      return res.status(401).json({ success: false, message: 'Người dùng không tồn tại.' });
    }
    console.log('Auth success for user:', req.user.email);
    next();
  } catch (err) {
    console.error('Auth error:', err);
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
