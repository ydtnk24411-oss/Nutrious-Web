const router = require('express').Router();
const { body } = require('express-validator');
const User = require('../models/User');
const OtpVerification = require('../models/OtpVerification');
const { validate } = require('../middleware/validate');
const { protect, signToken } = require('../middleware/auth');

// Chuẩn hóa và kiểm tra số điện thoại Việt Nam
function normalizeVietnamesePhone(raw) {
  if (!raw) return '';
  let cleaned = String(raw).trim().replace(/[\s\-.()]/g, '');
  if (cleaned.startsWith('+84')) {
    cleaned = '0' + cleaned.slice(3);
  } else if (cleaned.startsWith('84') && cleaned.length >= 11) {
    cleaned = '0' + cleaned.slice(2);
  }
  return cleaned;
}

function isValidVietnamesePhone(phone) {
  const normalized = normalizeVietnamesePhone(phone);
  // Định dạng số di động Việt Nam 10 chữ số: 03x, 05x, 07x, 08x, 09x
  return /^(0)(3|5|7|8|9)[0-9]{8}$/.test(normalized);
}

// Kiểm tra môi trường demo/dev có cho phép OTP mặc định 123456
function isDemoOtpAllowed() {
  if (process.env.ALLOW_DEMO_OTP === 'false') return false;
  return process.env.NODE_ENV !== 'production' || process.env.ALLOW_DEMO_OTP === 'true';
}

function generateOtpCode() {
  if (isDemoOtpAllowed()) {
    return '123456';
  }
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Định dạng dữ liệu user trả về an toàn cho client
const publicUser = (u) => ({
  _id: u._id,
  name: u.name,
  email: u.email || '',
  phone: u.phone || '',
  role: u.role || 'customer',
  firstName: u.firstName || '',
  lastName: u.lastName || '',
  title: u.title || '',
  avatar: u.avatar || '',
  points: u.points || 0,
  tier: u.tier || 'bronze',
  totalSpent: u.totalSpent || 0,
  addresses: u.addresses || [],
  authProvider: u.authProvider || 'local',
  isGoogleLinked: !!u.googleId,
  googleEmail: u.googleEmail || '',
  googleLinkedAt: u.googleLinkedAt || null,
  googleName: u.googleName || '',
  googleAvatar: u.googleAvatar || '',
});

// GET /api/auth/config - Trả về cấu hình client (Google Client ID, môi trường OTP)
router.get('/config', (req, res) => {
  res.json({
    success: true,
    googleClientId: process.env.GOOGLE_CLIENT_ID || '188871008521-46hp48f411gfkh501b0g6rvvj6g5n31n.apps.googleusercontent.com',
    demoOtpActive: isDemoOtpAllowed(),
  });
});

// ============================================================================
// 1. LUỒNG ĐĂNG KÝ BẰNG SỐ ĐIỆN THOẠI (Phone-first Registration)
// ============================================================================

// POST /api/auth/register/request-otp
// Bước 1: Nhập thông tin & Yêu cầu gửi mã OTP xác minh số điện thoại
router.post(
  '/register/request-otp',
  [
    body('name').trim().notEmpty().withMessage('Họ và tên không được để trống.'),
    body('phone').trim().notEmpty().withMessage('Số điện thoại không được để trống.'),
    body('password').isLength({ min: 6 }).withMessage('Mật khẩu phải có tối thiểu 6 ký tự.'),
    body('confirmPassword').custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Mật khẩu xác nhận không khớp.');
      }
      return true;
    }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { name, phone, password } = req.body;
      const normalizedPhone = normalizeVietnamesePhone(phone);

      if (!isValidVietnamesePhone(normalizedPhone)) {
        return res.status(400).json({
          success: false,
          message: 'Số điện thoại không đúng định dạng di động Việt Nam (gồm 10 số, bắt đầu bằng 03, 05, 07, 08, 09).',
        });
      }

      // Kiểm tra số điện thoại đã tồn tại trong MongoDB chưa
      const existingUser = await User.findOne({ phone: normalizedPhone });
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'Số điện thoại này đã được đăng ký tài khoản EvergreenMart. Vui lòng đăng nhập.',
        });
      }

      // Tạo mã OTP (123456 trong dev/demo hoặc mã ngẫu nhiên 6 số)
      const otpCode = generateOtpCode();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 phút hiệu lực

      // Xóa các OTP chờ đăng ký cũ của số này
      await OtpVerification.deleteMany({ phone: normalizedPhone, type: 'register' });

      // Lưu bản ghi OTP (chưa tạo tài khoản User trước khi xác minh)
      await OtpVerification.create({
        phone: normalizedPhone,
        code: otpCode,
        type: 'register',
        registrationData: {
          name: name.trim(),
          password,
        },
        attempts: 0,
        maxAttempts: 5,
        expiresAt,
        isUsed: false,
      });

      return res.status(200).json({
        success: true,
        message: 'Mã xác minh OTP đã được tạo thành công.',
        phone: normalizedPhone,
        expiresInSeconds: 300,
        demoOtp: isDemoOtpAllowed() ? '123456' : undefined,
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/auth/register/verify-otp
// Bước 2 & 3: Xác minh OTP -> Tạo tài khoản người dùng -> Tự động đăng nhập
router.post(
  '/register/verify-otp',
  [
    body('phone').trim().notEmpty().withMessage('Số điện thoại không được để trống.'),
    body('otp').trim().isLength({ min: 6, max: 6 }).withMessage('Mã OTP gồm 6 chữ số.'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { phone, otp } = req.body;
      const normalizedPhone = normalizeVietnamesePhone(phone);

      const otpRecord = await OtpVerification.findOne({
        phone: normalizedPhone,
        type: 'register',
        isUsed: false,
      }).sort({ createdAt: -1 });

      if (!otpRecord) {
        return res.status(400).json({
          success: false,
          message: 'Mã OTP không tồn tại hoặc đã được sử dụng. Vui lòng gửi lại mã OTP mới.',
        });
      }

      // Kiểm tra hết hạn
      if (new Date() > new Date(otpRecord.expiresAt)) {
        return res.status(400).json({
          success: false,
          message: 'Mã OTP đã hết thời hạn 5 phút. Vui lòng bấm "Gửi lại mã".',
        });
      }

      // Kiểm tra số lần thử tối đa
      if (otpRecord.attempts >= otpRecord.maxAttempts) {
        return res.status(429).json({
          success: false,
          message: 'Bạn đã nhập sai mã OTP quá 5 lần. Vui lòng yêu cầu mã xác minh mới.',
        });
      }

      // Kiểm tra mã OTP
      if (otpRecord.code !== otp.trim()) {
        otpRecord.attempts += 1;
        await otpRecord.save();
        const remaining = otpRecord.maxAttempts - otpRecord.attempts;
        return res.status(400).json({
          success: false,
          message: `Mã OTP không chính xác. Bạn còn ${remaining} lần thử lại.`,
        });
      }

      // OTP HỢP LỆ: Đánh dấu đã dùng
      otpRecord.isUsed = true;
      await otpRecord.save();

      // Kiểm tra lại tính duy nhất của số điện thoại trước khi lưu
      const doubleCheck = await User.findOne({ phone: normalizedPhone });
      if (doubleCheck) {
        return res.status(409).json({
          success: false,
          message: 'Số điện thoại này đã được tạo tài khoản trước đó.',
        });
      }

      // Tạo tài khoản mới - Mật khẩu được hash tự động qua User schema pre-save
      const newUser = await User.create({
        name: otpRecord.registrationData.name,
        phone: normalizedPhone,
        password: otpRecord.registrationData.password,
        authProvider: 'local',
        role: 'customer',
        isActive: true,
      });

      // Tự động cấp token phiên đăng nhập
      const token = signToken(newUser);

      return res.status(201).json({
        success: true,
        message: 'Đăng ký tài khoản thành công! Chào mừng bạn đến với EvergreenMart.',
        token,
        user: publicUser(newUser),
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/auth/register/resend-otp
// Gửi lại mã OTP xác minh đăng ký
router.post(
  '/register/resend-otp',
  [body('phone').trim().notEmpty().withMessage('Số điện thoại không được để trống.')],
  validate,
  async (req, res, next) => {
    try {
      const normalizedPhone = normalizeVietnamesePhone(req.body.phone);

      const existingRecord = await OtpVerification.findOne({
        phone: normalizedPhone,
        type: 'register',
      }).sort({ createdAt: -1 });

      if (!existingRecord) {
        return res.status(400).json({
          success: false,
          message: 'Không tìm thấy thông tin đăng ký cho số điện thoại này. Vui lòng nhập lại thông tin.',
        });
      }

      const otpCode = generateOtpCode();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

      // Cập nhật hoặc tạo mới
      await OtpVerification.deleteMany({ phone: normalizedPhone, type: 'register' });
      await OtpVerification.create({
        phone: normalizedPhone,
        code: otpCode,
        type: 'register',
        registrationData: existingRecord.registrationData,
        attempts: 0,
        maxAttempts: 5,
        expiresAt,
        isUsed: false,
      });

      return res.status(200).json({
        success: true,
        message: 'Đã gửi lại mã OTP mới.',
        phone: normalizedPhone,
        expiresInSeconds: 300,
        demoOtp: isDemoOtpAllowed() ? '123456' : undefined,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ============================================================================
// 2. LUỒNG ĐĂNG NHẬP BẰNG SỐ ĐIỆN THOẠI (Phone-first Login)
// ============================================================================

// POST /api/auth/login
// Mặc định đăng nhập bằng Số điện thoại + Mật khẩu (vẫn hỗ trợ Email cho tài khoản cũ)
router.post(
  '/login',
  [
    body('identifier').optional().trim(),
    body('phone').optional().trim(),
    body('email').optional().trim(),
    body('password').notEmpty().withMessage('Mật khẩu không được để trống.'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { password } = req.body;
      const rawInput = (req.body.identifier || req.body.phone || req.body.email || '').trim();

      if (!rawInput) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng nhập số điện thoại hoặc email để đăng nhập.',
        });
      }

      const normalizedPhone = normalizeVietnamesePhone(rawInput);
      const emailInput = rawInput.toLowerCase();

      // Tìm kiếm theo số điện thoại đã chuẩn hóa hoặc theo email
      const user = await User.findOne({
        $or: [
          ...(isValidVietnamesePhone(normalizedPhone) ? [{ phone: normalizedPhone }] : []),
          { phone: rawInput },
          { email: emailInput },
        ],
      }).select('+password');

      if (!user || !(await user.comparePassword(password))) {
        return res.status(401).json({
          success: false,
          message: 'Số điện thoại hoặc mật khẩu không chính xác.',
        });
      }

      if (!user.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Tài khoản của bạn đã bị vô hiệu hoá. Vui lòng liên hệ hỗ trợ EvergreenMart.',
        });
      }

      const token = signToken(user);
      return res.json({
        success: true,
        message: 'Đăng nhập thành công!',
        token,
        user: publicUser(user),
      });
    } catch (err) {
      next(err);
    }
  }
);

// ============================================================================
// 3. LIÊN KẾT VÀ ĐĂNG NHẬP GOOGLE (Google Account Linking)
// ============================================================================

// Helper xác thực token Google ở phía backend
async function verifyGoogleToken(tokenData) {
  const { credential, idToken, token, accessToken } = tokenData;
  const tokenToVerify = credential || idToken || token;

  if (tokenToVerify) {
    const googleRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(tokenToVerify)}`
    );
    if (!googleRes.ok) {
      const errText = await googleRes.text();
      throw new Error(`Xác thực Google ID Token không thành công: ${errText}`);
    }
    const payload = await googleRes.json();
    return {
      sub: payload.sub,
      email: String(payload.email || '').trim().toLowerCase(),
      name: payload.name || '',
      picture: payload.picture || '',
    };
  }

  if (accessToken) {
    const googleRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!googleRes.ok) {
      const errText = await googleRes.text();
      throw new Error(`Xác thực Google Access Token không thành công: ${errText}`);
    }
    const payload = await googleRes.json();
    return {
      sub: payload.sub,
      email: String(payload.email || '').trim().toLowerCase(),
      name: payload.name || '',
      picture: payload.picture || '',
    };
  }

  throw new Error('Dữ liệu xác thực Google không hợp lệ hoặc bị thiếu.');
}

// POST /api/auth/google
// ĐĂNG NHẬP BẰNG GOOGLE (Chỉ cho phép nếu Google ID đã được liên kết từ trước)
router.post('/google', async (req, res, next) => {
  try {
    let googleUser;
    try {
      googleUser = await verifyGoogleToken(req.body);
    } catch (verifyErr) {
      return res.status(401).json({
        success: false,
        message: 'Xác thực tài khoản Google với máy chủ thất bại. Vui lòng thử lại.',
      });
    }

    if (!googleUser.sub) {
      return res.status(400).json({
        success: false,
        message: 'Không tìm thấy định danh Google ID hợp lệ.',
      });
    }

    // QUY TẮC CỐT LÕI: Chỉ cho phép đăng nhập nếu Google ID đã được người dùng liên kết trước đó
    const user = await User.findOne({ googleId: googleUser.sub });

    if (!user) {
      // TUYỆT ĐỐI KHÔNG TỰ ĐỘNG TẠO TÀI KHOẢN MỚI
      // TUYỆT ĐỐI KHÔNG TỰ ĐỘNG GỘP TÀI KHOẢN THEO EMAIL
      return res.status(404).json({
        success: false,
        code: 'GOOGLE_NOT_LINKED',
        message: 'Tài khoản Google này chưa được liên kết với EvergreenMart. Vui lòng đăng nhập bằng số điện thoại để liên kết tài khoản.',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Tài khoản của bạn đã bị vô hiệu hoá. Vui lòng liên hệ hỗ trợ EvergreenMart.',
      });
    }

    const token = signToken(user);
    return res.json({
      success: true,
      message: 'Đăng nhập Google thành công!',
      token,
      user: publicUser(user),
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/google/link
// LIÊN KẾT TÀI KHOẢN GOOGLE VÀO TÀI KHOẢN HIỆN TẠI (Yêu cầu đã đăng nhập)
router.post('/google/link', protect, async (req, res, next) => {
  try {
    let googleUser;
    try {
      googleUser = await verifyGoogleToken(req.body);
    } catch (verifyErr) {
      return res.status(401).json({
        success: false,
        message: 'Xác thực Google thất bại. Vui lòng thử lại.',
      });
    }

    // Kiểm tra xem Google ID hoặc Google Email này đã được liên kết với tài khoản EvergreenMart khác chưa
    const existingConflict = await User.findOne({
      _id: { $ne: req.user._id },
      $or: [
        { googleId: googleUser.sub },
        ...(googleUser.email ? [{ googleEmail: googleUser.email }] : []),
      ],
    });

    if (existingConflict) {
      return res.status(409).json({
        success: false,
        message: 'Tài khoản Google này đã được liên kết với một tài khoản EvergreenMart khác.',
      });
    }

    // Lưu thông tin liên kết vào tài khoản EvergreenMart hiện tại
    const currentUser = await User.findById(req.user._id);
    if (!currentUser) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng hiện tại.' });
    }

    currentUser.googleId = googleUser.sub;
    currentUser.googleEmail = googleUser.email || '';
    currentUser.googleLinkedAt = new Date();
    currentUser.googleName = googleUser.name || '';
    currentUser.googleAvatar = googleUser.picture || '';

    // Cập nhật avatar nếu người dùng chưa có ảnh đại diện
    if (!currentUser.avatar && googleUser.picture) {
      currentUser.avatar = googleUser.picture;
    }

    await currentUser.save();

    return res.json({
      success: true,
      message: 'Đã liên kết tài khoản Google thành công!',
      user: publicUser(currentUser),
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/google/unlink
// HỦY LIÊN KẾT TÀI KHOẢN GOOGLE (Yêu cầu mật khẩu để xác minh danh tính)
router.post(
  '/google/unlink',
  protect,
  [body('password').notEmpty().withMessage('Vui lòng nhập mật khẩu để xác nhận hủy liên kết.')],
  validate,
  async (req, res, next) => {
    try {
      const { password } = req.body;
      const currentUser = await User.findById(req.user._id).select('+password');

      if (!currentUser) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
      }

      if (!currentUser.googleId) {
        return res.status(400).json({
          success: false,
          message: 'Tài khoản này hiện chưa liên kết với Google.',
        });
      }

      // Kiểm tra mật khẩu danh tính
      const isMatch = await currentUser.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Mật khẩu xác nhận không chính xác.',
        });
      }

      // Xóa thông tin liên kết Google (Giữ nguyên toàn bộ dữ liệu tài khoản, lịch sử đơn hàng, địa chỉ)
      currentUser.googleId = '';
      currentUser.googleEmail = '';
      currentUser.googleLinkedAt = null;
      currentUser.googleName = '';
      currentUser.googleAvatar = '';

      await currentUser.save();

      return res.json({
        success: true,
        message: 'Đã hủy liên kết tài khoản Google thành công.',
        user: publicUser(currentUser),
      });
    } catch (err) {
      next(err);
    }
  }
);

// ============================================================================
// 4. LUỒNG ĐỔI SỐ ĐIỆN THOẠI (Change Phone Number)
// ============================================================================

// POST /api/auth/phone/change/request
// Yêu cầu đổi số điện thoại: Xác minh mật khẩu hiện tại -> Gửi OTP đến số điện thoại MỚI
router.post(
  '/phone/change/request',
  protect,
  [
    body('newPhone').trim().notEmpty().withMessage('Số điện thoại mới không được để trống.'),
    body('password').notEmpty().withMessage('Vui lòng nhập mật khẩu tài khoản để xác nhận.'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { newPhone, password } = req.body;
      const normalizedNewPhone = normalizeVietnamesePhone(newPhone);

      if (!isValidVietnamesePhone(normalizedNewPhone)) {
        return res.status(400).json({
          success: false,
          message: 'Số điện thoại mới không đúng định dạng di động Việt Nam.',
        });
      }

      const currentUser = await User.findById(req.user._id).select('+password');
      if (!currentUser) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản.' });
      }

      // Xác minh mật khẩu danh tính người dùng
      const isMatch = await currentUser.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Mật khẩu xác nhận không chính xác.',
        });
      }

      // Nếu số mới trùng với số hiện tại
      if (currentUser.phone && currentUser.phone === normalizedNewPhone) {
        return res.status(400).json({
          success: false,
          message: 'Số điện thoại mới trùng với số điện thoại hiện tại của bạn.',
        });
      }

      // Kiểm tra số điện thoại mới đã thuộc tài khoản khác hay chưa
      const exists = await User.findOne({
        phone: normalizedNewPhone,
        _id: { $ne: currentUser._id },
      });
      if (exists) {
        return res.status(409).json({
          success: false,
          message: 'Số điện thoại này đã được sử dụng bởi một tài khoản EvergreenMart khác.',
        });
      }

      // Tạo mã OTP gửi tới số mới
      const otpCode = generateOtpCode();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

      await OtpVerification.deleteMany({
        phone: normalizedNewPhone,
        type: 'change_phone',
      });

      await OtpVerification.create({
        phone: normalizedNewPhone,
        code: otpCode,
        type: 'change_phone',
        registrationData: {
          userId: String(currentUser._id),
        },
        attempts: 0,
        maxAttempts: 5,
        expiresAt,
        isUsed: false,
      });

      return res.status(200).json({
        success: true,
        message: 'Mã xác minh OTP đã được gửi đến số điện thoại mới của bạn.',
        newPhone: normalizedNewPhone,
        expiresInSeconds: 300,
        demoOtp: isDemoOtpAllowed() ? '123456' : undefined,
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/auth/phone/change/verify
// Xác minh OTP số mới -> Cập nhật số điện thoại trên tài khoản hiện tại
router.post(
  '/phone/change/verify',
  protect,
  [
    body('newPhone').trim().notEmpty().withMessage('Số điện thoại mới không được để trống.'),
    body('otp').trim().isLength({ min: 6, max: 6 }).withMessage('Mã OTP gồm 6 chữ số.'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { newPhone, otp } = req.body;
      const normalizedNewPhone = normalizeVietnamesePhone(newPhone);

      const otpRecord = await OtpVerification.findOne({
        phone: normalizedNewPhone,
        type: 'change_phone',
        'registrationData.userId': String(req.user._id),
        isUsed: false,
      }).sort({ createdAt: -1 });

      if (!otpRecord) {
        return res.status(400).json({
          success: false,
          message: 'Mã OTP không tồn tại hoặc đã được sử dụng. Vui lòng yêu cầu lại.',
        });
      }

      if (new Date() > new Date(otpRecord.expiresAt)) {
        return res.status(400).json({
          success: false,
          message: 'Mã OTP đã hết thời hạn 5 phút. Vui lòng yêu cầu mã mới.',
        });
      }

      if (otpRecord.attempts >= otpRecord.maxAttempts) {
        return res.status(429).json({
          success: false,
          message: 'Bạn đã nhập sai mã OTP quá 5 lần. Vui lòng thao tác lại.',
        });
      }

      if (otpRecord.code !== otp.trim()) {
        otpRecord.attempts += 1;
        await otpRecord.save();
        const remaining = otpRecord.maxAttempts - otpRecord.attempts;
        return res.status(400).json({
          success: false,
          message: `Mã OTP không chính xác. Bạn còn ${remaining} lần thử lại.`,
        });
      }

      // OTP HỢP LỆ
      otpRecord.isUsed = true;
      await otpRecord.save();

      // Kiểm tra lại tính duy nhất
      const conflict = await User.findOne({
        phone: normalizedNewPhone,
        _id: { $ne: req.user._id },
      });
      if (conflict) {
        return res.status(409).json({
          success: false,
          message: 'Số điện thoại này đã được sử dụng bởi một tài khoản khác.',
        });
      }

      // Cập nhật số điện thoại trên tài khoản hiện tại
      // GIỮ NGUYÊN TOÀN BỘ dữ liệu cá nhân, lịch sử đơn hàng, địa chỉ, Google ID!
      const currentUser = await User.findById(req.user._id);
      currentUser.phone = normalizedNewPhone;
      await currentUser.save();

      return res.json({
        success: true,
        message: 'Đổi số điện thoại thành công! Số điện thoại mới đã được cập nhật.',
        user: publicUser(currentUser),
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/auth/me
router.get('/me', protect, (req, res) => {
  res.json({ success: true, user: publicUser(req.user) });
});

module.exports = router;
