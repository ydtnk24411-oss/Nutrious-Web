const router = require('express').Router();
const { body } = require('express-validator');
const User   = require('../models/User');
const { validate }  = require('../middleware/validate');
const { protect, signToken } = require('../middleware/auth');

// Dữ liệu user trả về cho client – giống nhau ở register / login / me
const publicUser = (u) => ({
  _id: u._id, name: u.name, email: u.email, role: u.role,
  firstName: u.firstName || '', lastName: u.lastName || '', title: u.title || '',
  avatar: u.avatar || '', phone: u.phone || '',
  points: u.points || 0, tier: u.tier || 'bronze', totalSpent: u.totalSpent || 0,
  addresses: u.addresses || [],
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
      const { name, password, phone } = req.body;
      const email = String(req.body.email).trim().toLowerCase();

      const exists = await User.findOne({ email });
      if (exists) {
        return res.status(409).json({ success: false, message: 'Email đã tồn tại.' });
      }

      const user  = await User.create({ name, email, password, phone });

      const token = signToken(user);
      res.status(201).json({
        success: true,
        token,
        user: publicUser(user),
        data: publicUser(user),
      });
    } catch (err) {
      next(err);
    }
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
      const { password } = req.body;
      const email = String(req.body.email).trim().toLowerCase();
      const user = await User.findOne({ email }).select('+password');
      if (!user || !(await user.comparePassword(password))) {
        return res.status(401).json({ success: false, message: 'Email hoặc mật khẩu không đúng.' });
      }
      if (!user.isActive) {
        return res.status(403).json({ success: false, message: 'Tài khoản đã bị vô hiệu hoá.' });
      }
      const token = signToken(user);
      res.json({
        success: true,
        token,
        user: publicUser(user),
      });
    } catch (err) { next(err); }
  }
);

// GET /api/auth/me
router.get('/me', protect, (req, res) =>
  res.json({ success: true, user: req.user })
);

module.exports = router;
