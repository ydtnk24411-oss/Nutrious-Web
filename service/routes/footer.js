const router = require('express').Router();
const FooterConfig = require('../models/FooterConfig');
const NewsletterSubscriber = require('../models/NewsletterSubscriber');

function filterRemovedNavLinks(links) {
  if (!Array.isArray(links)) return [];
  const blockedRoutes = /^\/(event-list|event-details|book-online|service-page)(\/|$)/i;
  const blockedLabels = /(sự kiện|đặt lịch|lớp học nấu ăn)/i;
  return links.filter((l) => {
    const route = String(l?.route || '').trim();
    const label = String(l?.label || '').trim();
    if (route && blockedRoutes.test(route)) return false;
    if (label && blockedLabels.test(label) && !l?.policyKey) return false;
    return true;
  });
}

// GET /api/footer — Lấy cấu hình footer, thông tin liên hệ và các chính sách từ MongoDB
router.get('/', async (req, res, next) => {
  try {
    const doc = await FooterConfig.findOne({ key: 'main' }).lean();
    if (doc) {
      doc.brandName = 'Evergreen Mart';
      doc.serviceLinks = filterRemovedNavLinks(doc.serviceLinks);
      doc.utilityLinks = filterRemovedNavLinks(doc.utilityLinks);
      doc.aboutLinks = filterRemovedNavLinks(doc.aboutLinks);
      doc.policyLinks = filterRemovedNavLinks(doc.policyLinks);
    }
    res.json({ success: true, data: doc });
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

