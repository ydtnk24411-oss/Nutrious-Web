const router = require('express').Router();
const jwt    = require('jsonwebtoken');
const { body } = require('express-validator');
const User   = require('../models/User');
const { validate }  = require('../middleware/validate');
const { protect }   = require('../middleware/auth');

const sign = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET || 'xanhla_secret', {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

// POST /api/auth/register
router.post(
  '/register',
  [
    body('name').notEmpty().withMessage('Tên không được để trống.'),
    body('email').isEmail().withMessage('Email không hợp lệ.'),
    body('password').isLength({ min: 6 }).withMessage('Mật khẩu tối thiểu 6 ký tự.'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { name, email, password, phone } = req.body;
      const exists = await User.findOne({ email });
      if (exists) return res.status(409).json({ success: false, message: 'Email đã tồn tại.' });

      const user  = await User.create({ name, email, password, phone });
      const token = sign(user._id);
      res.status(201).json({
        success: true,
        token,
        user: { _id: user._id, name: user.name, email: user.email, role: user.role },
      });
    } catch (err) { next(err); }
  }
);

// POST /api/auth/login
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Email không hợp lệ.'),
    body('password').notEmpty().withMessage('Mật khẩu không được để trống.'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { email, password } = req.body;
      const user = await User.findOne({ email }).select('+password');
      if (!user || !(await user.comparePassword(password))) {
        return res.status(401).json({ success: false, message: 'Email hoặc mật khẩu không đúng.' });
      }
      if (!user.isActive) {
        return res.status(403).json({ success: false, message: 'Tài khoản đã bị vô hiệu hoá.' });
      }
      const token = sign(user._id);
      res.json({
        success: true,
        token,
        user: { _id: user._id, name: user.name, email: user.email, role: user.role },
      });
    } catch (err) { next(err); }
  }
);

// GET /api/auth/me
router.get('/me', protect, (req, res) =>
  res.json({ success: true, user: req.user })
);

module.exports = router;
