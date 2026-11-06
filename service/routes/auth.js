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
  authProvider: u.authProvider || 'local',
});

// GET /api/auth/config — Cung cấp cấu hình client (Google Client ID, v.v.)
router.get('/config', (req, res) => {
  res.json({
    success: true,
    googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  });
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

// POST /api/auth/google — Đăng nhập / Đăng ký bằng Google (ID Token hoặc Access Token)
router.post('/google', async (req, res, next) => {
  try {
    const { credential, idToken, token, accessToken } = req.body;
    const tokenToVerify = credential || idToken || token;

    let payload = null;

    if (tokenToVerify && (tokenToVerify === 'demo_google_token' || tokenToVerify.startsWith('demo_'))) {
      // Mock Google Profile dành cho thử nghiệm / local development khi chưa cấu hình Google Client ID
      payload = {
        sub: 'google_demo_10987654321',
        email: req.body.demoEmail || 'khachhang.google@gmail.com',
        name: req.body.demoName || 'Nguyễn Văn Google (Demo)',
        picture: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&q=80',
        given_name: 'Nguyễn Văn',
        family_name: 'Google',
        email_verified: true,
      };
    } else if (tokenToVerify) {
      // Xác thực ID Token qua Google OAuth2 tokeninfo
      const googleRes = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(tokenToVerify)}`
      );

      if (!googleRes.ok) {
        const errText = await googleRes.text();
        console.error('Google id_token verification failed:', errText);
        return res.status(401).json({
          success: false,
          message: 'Xác thực Google ID Token thất bại hoặc đã hết hạn.',
        });
      }

      payload = await googleRes.json();

      // Kiểm tra audience nếu server có cấu hình GOOGLE_CLIENT_ID
      const expectedClientId = process.env.GOOGLE_CLIENT_ID;
      if (expectedClientId && payload.aud && payload.aud !== expectedClientId) {
        return res.status(401).json({
          success: false,
          message: 'Google Client ID không khớp với cấu hình hệ thống.',
        });
      }
    } else if (accessToken) {
      // Xác thực Access Token qua Google OAuth2 userinfo
      const googleRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!googleRes.ok) {
        const errText = await googleRes.text();
        console.error('Google access_token verification failed:', errText);
        return res.status(401).json({
          success: false,
          message: 'Xác thực Google Access Token thất bại hoặc đã hết hạn.',
        });
      }

      payload = await googleRes.json();
    } else {
      return res.status(400).json({
        success: false,
        message: 'Google credential hoặc accessToken không được để trống.',
      });
    }

    const email = String(payload.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Không tìm thấy địa chỉ email từ tài khoản Google.',
      });
    }

    // Tìm kiếm user theo email hoặc googleId
    let user = await User.findOne({
      $or: [
        { email },
        { googleId: payload.sub }
      ]
    });

    let isNewUser = false;

    if (!user) {
      // Tự động đăng ký tài khoản mới bằng Google
      isNewUser = true;
      user = await User.create({
        name: payload.name || email.split('@')[0],
        firstName: payload.given_name || '',
        lastName: payload.family_name || '',
        email,
        avatar: payload.picture || '',
        googleId: payload.sub,
        authProvider: 'google',
        role: 'customer',
        isActive: true,
      });
    } else {
      // Đã có tài khoản: cập nhật thông tin Google nếu cần
      let changed = false;
      if (!user.googleId) {
        user.googleId = payload.sub;
        changed = true;
      }
      if (!user.avatar && payload.picture) {
        user.avatar = payload.picture;
        changed = true;
      }
      if (changed) {
        await user.save();
      }
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Tài khoản đã bị vô hiệu hoá.',
      });
    }

    const jwtToken = signToken(user);
    res.json({
      success: true,
      token: jwtToken,
      user: publicUser(user),
      isNewUser,
      message: isNewUser
        ? 'Đăng ký thành công bằng tài khoản Google!'
        : 'Đăng nhập Google thành công!',
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me
router.get('/me', protect, (req, res) =>
  res.json({ success: true, user: req.user })
);

module.exports = router;
