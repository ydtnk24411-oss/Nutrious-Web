const router = require('express').Router();
const NewsletterSubscriber = require('../models/NewsletterSubscriber');
const footerConfigData = require('../data/footer-config.json');

// GET /api/footer - Lay cau hinh chan trang tinh (khong truy van CSDL)
router.get('/', (req, res) => {
  res.json({
    success: true,
    data: footerConfigData,
  });
});

// POST /api/footer/newsletter - Dang ky nhan ban tin email
router.post('/newsletter', async (req, res, next) => {
  try {
    const rawEmail = String(req.body.email || '').trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!rawEmail || !emailRegex.test(rawEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập địa chỉ email hợp lệ.',
      });
    }

    const existing = await NewsletterSubscriber.findOne({ email: rawEmail });
    if (existing) {
      return res.json({
        success: true,
        message: 'Email này đã được đăng ký nhận bản tin Evergreen Mart!',
        data: existing,
      });
    }

    const subscriber = await NewsletterSubscriber.create({ email: rawEmail });
    res.status(201).json({
      success: true,
      message: 'Đã đăng ký nhận bản tin thành công!',
      data: subscriber,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
