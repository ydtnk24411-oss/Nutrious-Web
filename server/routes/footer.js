const router = require('express').Router();
const FooterConfig = require('../models/FooterConfig');
const NewsletterSubscriber = require('../models/NewsletterSubscriber');

// GET /api/footer — Lấy cấu hình footer, thông tin liên hệ và các chính sách từ MongoDB
router.get('/', async (req, res, next) => {
  try {
    const config = await FooterConfig.findOne({ key: 'main' });
    res.json({ success: true, data: config });
  } catch (err) {
    next(err);
  }
});

// POST /api/footer/newsletter — Đăng ký nhận bản tin email lưu vào MongoDB
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
        message: 'Email này đã được đăng ký nhận bản tin Xanh Lá!',
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

