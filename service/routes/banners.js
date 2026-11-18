const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const BannerConfig = require('../models/BannerConfig');
const BannerMedia = require('../models/BannerMedia');
const { protect, staffOnly, authorizeRoles } = require('../middleware/auth');

const ALLOWED_IMAGE_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
  'image/avif',
]);
const MAX_BANNER_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB

const DEFAULT_SLIDES = [
  {
    title: 'Đi chợ thông minh - Nông sản tươi sạch giao nhanh 2 giờ.',
    subtitle: 'Thực phẩm tươi VietGAP, rau củ hữu cơ và hàng tiêu dùng thiết yếu cho cả gia đình.',
    eyebrow: 'TƯƠI SẠCH MỖI NGÀY - GIAO NHANH 2H',
    cta: 'Mua sắm ngay',
    link: '/online-ordering',
    image: '/images/banners/banner1.jpg',
    active: true,
    sortOrder: 1,
  },
  {
    title: 'Thực phẩm tươi sạch mỗi ngày - An tâm cho cả gia đình.',
    subtitle: 'Khám phá rau củ hữu cơ, trái cây đặc sản và nguyên liệu tươi ngon chuẩn chất lượng.',
    eyebrow: 'CHUẨN NGUỒN GỐC - VÌ SỨC KHỎE GIA ĐÌNH',
    cta: 'Khám phá ưu đãi',
    link: '/promotions',
    image: '/images/banners/banner6.png',
    active: true,
    sortOrder: 2,
  },
  {
    title: 'Săn deal giá tốt - Gợi ý nấu ăn cùng Evergreen Mart.',
    subtitle: 'Đừng bỏ lỡ nguyên liệu tươi ngon, mã giảm giá độc quyền và công thức chuẩn vị.',
    eyebrow: 'NẤU GÌ HÔM NAY - GIAO NHANH 2H',
    cta: 'Khám phá ngay',
    link: '/cook-with-what-you-have',
    image: '/images/banners/banner8.png',
    active: true,
    sortOrder: 3,
  },
  {
    title: 'Thực đơn cân bằng mỗi ngày cùng nông sản hữu cơ.',
    subtitle: 'Chọn nhanh nguyên liệu tươi cho bữa cơm dinh dưỡng gia đình.',
    eyebrow: 'DINH DƯỠNG THÔNG MINH',
    cta: 'Khám phá ngay',
    link: '/cook-with-what-you-have',
    image: '/images/banners/banner9.png',
    active: true,
    sortOrder: 4,
  },
  {
    title: 'Siêu thị nông sản tươi sạch giao tận tay.',
    subtitle: 'Thu hoạch trong ngày, giao nhanh theo khung giờ linh hoạt.',
    eyebrow: 'CHUẨN VIETGAP & ORGANIC',
    cta: 'Đặt hàng ngay',
    link: '/cook-with-what-you-have',
    image: '/images/banners/banner4.png',
    active: true,
    sortOrder: 5,
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

// GET /api/banners/media/:id - Phục vụ ảnh banner lưu trực tiếp trong MongoDB
router.get('/media/:id', async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy ảnh banner.' });
    }
    const media = await BannerMedia.findById(req.params.id);
    if (!media || !media.data) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy ảnh banner.' });
    }
    res.set({
      'Content-Type': media.mimeType,
      'Content-Length': String(media.data.length),
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Cross-Origin-Resource-Policy': 'cross-origin',
    });
    return res.send(media.data);
  } catch (err) {
    next(err);
  }
});

// POST /api/banners/upload - Tải ảnh banner từ máy và lưu nhị phân vào MongoDB
router.post('/upload', protect, staffOnly, authorizeRoles('Manager', 'Admin', 'Marketing'), async (req, res, next) => {
  try {
    const { dataUrl, filename } = req.body || {};
    if (typeof dataUrl !== 'string' || !dataUrl.trim()) {
      return res.status(400).json({ success: false, message: 'Thiếu dữ liệu ảnh tải lên.' });
    }

    const match = dataUrl.trim().match(/^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/i);
    if (!match) {
      return res.status(400).json({
        success: false,
        message: 'Định dạng ảnh không hợp lệ. Vui lòng chọn tệp PNG, JPG, WEBP, GIF hoặc AVIF.',
      });
    }

    const rawMime = match[1].toLowerCase();
    if (!ALLOWED_IMAGE_MIMES.has(rawMime)) {
      return res.status(400).json({
        success: false,
        message: 'Chỉ hỗ trợ ảnh PNG, JPG, WEBP, GIF hoặc AVIF.',
      });
    }
    const mimeType = rawMime === 'image/jpg' ? 'image/jpeg' : rawMime;
    const buffer = Buffer.from(match[2].replace(/\s+/g, ''), 'base64');

    if (!buffer.length || buffer.length > MAX_BANNER_IMAGE_BYTES) {
      return res.status(400).json({
        success: false,
        message: 'Dung lượng ảnh vượt quá giới hạn tối đa 5MB.',
      });
    }

    const media = await BannerMedia.create({
      filename: String(filename || 'banner-image').slice(0, 120),
      mimeType,
      size: buffer.length,
      data: buffer,
      uploadedBy: req.user?.name || req.user?.email || 'marketing',
    });

    return res.status(201).json({
      success: true,
      message: 'Đã lưu ảnh banner vào MongoDB thành công.',
      data: {
        id: String(media._id),
        url: `/api/banners/media/${media._id}`,
        filename: media.filename,
        mimeType: media.mimeType,
        size: media.size,
      },
    });
  } catch (err) {
    next(err);
  }
});

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
