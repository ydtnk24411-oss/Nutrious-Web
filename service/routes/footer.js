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

function sanitizeText(str) {
  if (!str || typeof str !== 'string') return str;
  return str.replace(/Xanh Lá/gi, 'Evergreen Mart').replace(/1900\s*6789/g, '1800 6999');
}

const FALLBACK_ABOUT_LINKS = [
  { label: 'Giới thiệu về Evergreen Mart', policyKey: 'about' },
  { label: 'Nông trại & Vùng trồng hữu cơ', route: '/online-ordering' },
  { label: 'Tiêu chuẩn chất lượng VietGAP', policyKey: 'shipping' },
  { label: 'Cẩm nang dinh dưỡng thông minh', route: '/nutrition' },
  { label: 'Liên hệ & Hệ thống phân phối', policyKey: 'contact' },
];

const FALLBACK_UTILITY_LINKS = [
  { label: '🥗 Dinh dưỡng thông minh', route: '/nutrition' },
  { label: '🍳 Nấu gì với đồ sẵn có?', route: '/cook-with-what-you-have' },
  { label: '📦 Theo dõi đơn hàng', route: '/tracker-page' },
  { label: '🎟️ Ví Voucher của tôi', route: '/vouchers' },
  { label: '⭐ Điểm thưởng & Hạng thành viên', route: '/loyalty' },
];

const FALLBACK_POLICY_LINKS = [
  { label: 'Chính sách giao hàng & Đồng kiểm', policyKey: 'shipping', icon: 'truck' },
  { label: 'Chính sách đổi trả & Hoàn tiền', policyKey: 'returns', icon: 'refresh' },
  { label: 'Chính sách bảo mật thông tin', policyKey: 'privacy', icon: 'shield' },
  { label: 'Điều khoản sử dụng dịch vụ', policyKey: 'terms', icon: 'doc' },
  { label: 'Câu hỏi thường gặp (FAQ)', policyKey: 'faq', icon: 'help' },
  { label: 'Hướng dẫn đặt hàng & Thanh toán', policyKey: 'help', icon: 'info' },
];

const FALLBACK_SOCIAL_LINKS = [
  { platform: 'facebook', label: 'Facebook Evergreen Mart', url: 'https://facebook.com' },
  { platform: 'instagram', label: 'Instagram Evergreen Mart', url: 'https://instagram.com' },
  { platform: 'youtube', label: 'YouTube Evergreen Mart', url: 'https://youtube.com' },
  { platform: 'zalo', label: 'Zalo OA Evergreen Mart', url: 'https://zalo.me' },
];

// GET /api/footer — Lấy cấu hình footer, thông tin liên hệ và các chính sách từ MongoDB
router.get('/', async (req, res, next) => {
  try {
    let doc = await FooterConfig.findOne({ key: 'main' }).lean();
    if (!doc) {
      doc = { key: 'main' };
    }

    doc.brandName = 'Evergreen Mart';
    doc.brandDesc = sanitizeText(doc.brandDesc) || 'Tự hào mang nông sản Việt đạt chuẩn VietGAP, GlobalGAP và Organic từ các nông trại xanh đến tận bàn ăn gia đình bạn mỗi ngày.';
    doc.newsletterTitle = sanitizeText(doc.newsletterTitle) || 'Bản tin dinh dưỡng & Ưu đãi Evergreen Mart';
    doc.newsletterDesc = sanitizeText(doc.newsletterDesc) || 'Đăng ký email để nhận ngay voucher giảm 20%, gợi ý thực đơn dinh dưỡng mỗi tuần và ưu đãi Flash Sale nông sản thu hoạch trong ngày.';
    doc.copyrightText = sanitizeText(doc.copyrightText) || '© 2026 Evergreen Mart — Nông Nghiệp Hữu Cơ & Dinh Dưỡng Thông Minh. Bảo lưu mọi quyền.';

    doc.contactInfo = {
      hotline: '1800 6999 (07:00 – 21:00)',
      email: 'chamsoc@evergreenmart.vn',
      address: doc.contactInfo?.address || 'Khu phố 6, Phường Linh Trung, TP. Thủ Đức, TP. Hồ Chí Minh',
    };

    const cleanedUtility = filterRemovedNavLinks(doc.utilityLinks);
    doc.utilityLinks = cleanedUtility.length ? cleanedUtility.map(l => ({ ...l, label: sanitizeText(l.label) })) : FALLBACK_UTILITY_LINKS;

    const cleanedAbout = filterRemovedNavLinks(doc.aboutLinks);
    doc.aboutLinks = cleanedAbout.length ? cleanedAbout.map(l => ({ ...l, label: sanitizeText(l.label) })) : FALLBACK_ABOUT_LINKS;

    doc.policyLinks = Array.isArray(doc.policyLinks) && doc.policyLinks.length
      ? doc.policyLinks.map(l => ({ ...l, label: sanitizeText(l.label) }))
      : FALLBACK_POLICY_LINKS;

    doc.socialLinks = Array.isArray(doc.socialLinks) && doc.socialLinks.length
      ? doc.socialLinks.map(s => ({ ...s, label: sanitizeText(s.label) }))
      : FALLBACK_SOCIAL_LINKS;

    if (!Array.isArray(doc.paymentMethods) || !doc.paymentMethods.length) {
      doc.paymentMethods = ['COD', 'VietQR', 'MoMo', 'VNPay', 'ZaloPay', 'Visa/Master'];
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
