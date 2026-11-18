const express = require('express');
const router = express.Router();
const BannerConfig = require('../models/BannerConfig');
const { protect, staffOnly, authorizeRoles } = require('../middleware/auth');

const DEFAULT_SLIDES = [
  {
    title: 'Đi chợ thông minh - Nông sản tươi sạch giao nhanh 2 giờ.',
    subtitle: 'Thực phẩm tươi VietGAP, rau củ hữu cơ và hàng tiêu dùng thiết yếu cho cả gia đình.',
    eyebrow: 'TƯƠI SẠCH MỖI NGÀY - GIAO NHANH 2H',
    cta: 'Mua sắm ngay',
    link: '/online-ordering',
    image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1600&q=90',
    active: true,
    sortOrder: 1,
  },
  {
    title: 'Thực phẩm tươi sạch mỗi ngày - An tâm cho cả gia đình.',
    subtitle: 'Khám phá rau củ hữu cơ, trái cây đặc sản và nguyên liệu tươi ngon chuẩn chất lượng.',
    eyebrow: 'CHUẨN NGUỒN GỐC - VÌ SỨC KHỎE GIA ĐÌNH',
    cta: 'Khám phá gian hàng',
    link: '/online-ordering',
    image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=1600&q=90',
    active: true,
    sortOrder: 2,
  },
  {
    title: 'Săn deal giá tốt - Mua sắm tiết kiệm cùng Evergreen Mart.',
    subtitle: 'Đừng bỏ lỡ Flash Sale hôm nay, mã giảm giá độc quyền và điểm thưởng tích lũy mỗi đơn hàng.',
    eyebrow: 'SĂN DEAL HÔM NAY - NHẬN ƯU ĐÃI TỐT',
    cta: 'Xem ưu đãi',
    link: '/promotions',
    image: 'https://images.unsplash.com/photo-1543083477-4f785aeafaa9?auto=format&fit=crop&w=1600&q=90',
    active: true,
    sortOrder: 3,
  },
];

const DEFAULT_POPUP = {
  title: 'Ưu đãi Đặc biệt Dịp Lễ & Mùa Vụ Nông Sản',
  description: 'Nhập mã EVG20K để nhận ngay ưu đãi 20.000₫ cho đơn hàng rau củ quả tươi sạch từ 150.000₫.',
  image: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=800&q=80',
  badge: 'ƯU ĐÃI ĐỘC QUYỀN',
  voucherCode: 'EVG20K',
  buttonText: 'Lưu mã & Mua sắm',
  buttonLink: '/vouchers',
  enabled: true,
  startDate: null,
  endDate: null,
};

async function getOrCreateConfig() {
  let cfg = await BannerConfig.findOne();
  if (!cfg) {
    cfg = await BannerConfig.create({
      heroSlides: DEFAULT_SLIDES,
      promoPopup: DEFAULT_POPUP,
      updatedBy: 'system',
    });
  }
  return cfg;
}

// GET /api/banners (Công khai - cả web storefront và admin đều đọc được)
router.get('/', async (req, res, next) => {
  try {
    const cfg = await getOrCreateConfig();
    res.json({
      success: true,
      data: cfg,
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/banners (Marketing & Admin cập nhật Hero slides hoặc Popup)
router.put('/', protect, staffOnly, authorizeRoles('Manager', 'Admin', 'Marketing'), async (req, res, next) => {
  try {
    const { heroSlides, promoPopup } = req.body;
    let cfg = await getOrCreateConfig();

    if (Array.isArray(heroSlides)) {
      cfg.heroSlides = heroSlides;
    }
    if (promoPopup && typeof promoPopup === 'object') {
      cfg.promoPopup = { ...cfg.promoPopup.toObject(), ...promoPopup };
    }
    cfg.updatedBy = req.user?.name || req.user?.email || 'marketing';
    cfg.updatedAt = new Date();

    await cfg.save();

    res.json({
      success: true,
      message: 'Đã cập nhật Banner & Pop-up khuyến mãi thành công.',
      data: cfg,
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/banners/toggle-popup (Bật/tắt nhanh pop-up)
router.patch('/toggle-popup', protect, staffOnly, authorizeRoles('Manager', 'Admin', 'Marketing'), async (req, res, next) => {
  try {
    let cfg = await getOrCreateConfig();
    cfg.promoPopup.enabled = !cfg.promoPopup.enabled;
    cfg.updatedBy = req.user?.name || 'marketing';
    await cfg.save();

    res.json({
      success: true,
      message: `Đã ${cfg.promoPopup.enabled ? 'kích hoạt' : 'tắt'} Pop-up khuyến mãi.`,
      enabled: cfg.promoPopup.enabled,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
