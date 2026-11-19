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
    image: '/images/banners/banner-fresh-vegetables.jpg',
    active: true,
    sortOrder: 1,
  },
  {
    title: 'Hải sản cá hồi tươi sống cao cấp chuẩn tươi sạch.',
    subtitle: 'Khám phá cá hồi phi lê, tôm cá tươi ngon giao chuẩn lạnh 2h.',
    eyebrow: 'HẢI SẢN TƯƠI SỐNG - GIAO NHANH 2H',
    cta: 'Khám phá ưu đãi',
    link: '/online-ordering',
    image: '/images/banners/banner-seafood-salmon.jpg',
    active: true,
    sortOrder: 2,
  },
  {
    title: 'Trái cây nhiệt đới ngọt lành mỗi ngày.',
    subtitle: 'Thưởng thức trái cây nhập khẩu ngọt lành, dứa, kiwi, nho, chuối.',
    eyebrow: 'TRÁI CÂY TƯƠI NGON',
    cta: 'Khám phá ngay',
    link: '/promotions',
    image: '/images/banners/banner-fresh-fruits.jpg',
    active: true,
    sortOrder: 3,
  },
  {
    title: 'Gia vị thảo mộc thiên nhiên cho bữa cơm trọn vị.',
    subtitle: 'Bộ sưu tập gia vị thảo mộc tự nhiên thơm ngon đậm đà.',
    eyebrow: 'GIA VỊ THẢO MỘC',
    cta: 'Khám phá ngay',
    link: '/cook-with-what-you-have',
    image: '/images/banners/banner-spices-spoons.jpg',
    active: true,
    sortOrder: 4,
  },
  {
    title: 'Nước mắm Nam Ô truyền thống nồng đượm vị biển mẹ.',
    subtitle: 'Ủ chượp thủ công từ cá cơm than và muối hạt tinh khiết.',
    eyebrow: 'NƯỚC MẮM TRUYỀN THỐNG',
    cta: 'Mua ngay',
    link: '/category/all-products',
    image: '/images/banners/banner-nam-o-sauce.jpg',
    active: true,
    sortOrder: 5,
  },
  {
    title: 'Tôm cá tươi ngon ướp đá giao nhanh 2h.',
    subtitle: 'Bảo quản tươi sống đạt chuẩn vệ sinh an toàn thực phẩm.',
    eyebrow: 'HẢI SẢN TƯƠI SẠCH',
    cta: 'Xem ngay',
    link: '/online-ordering',
    image: '/images/banners/banner-seafood-ice.jpg',
    active: true,
    sortOrder: 6,
  },
  {
    title: 'Món ngon dinh dưỡng cho bữa cơm gia đình.',
    subtitle: 'Cá hồi áp chảo cùng rau củ thanh mát đủ chất.',
    eyebrow: 'BỮA CƠM DINH DƯỠNG',
    cta: 'Lên thực đơn',
    link: '/nutrition',
    image: '/images/banners/banner-salmon-dish.jpg',
    active: true,
    sortOrder: 7,
  },
  {
    title: 'Tinh hoa gia vị ẩm thực Việt.',
    subtitle: 'Gia vị chuẩn vị cho mọi món ngon gia đình.',
    eyebrow: 'GIA VỊ THƯỢNG HẠNG',
    cta: 'Khám phá',
    link: '/category/all-products',
    image: '/images/banners/banner-spices-bowls.jpg',
    active: true,
    sortOrder: 8,
  }
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

const LEGACY_MEDIA_IDS = new Set([
  '6afe009e20f0b5e73e86e586',
  '6afe00b520f0b5e73e86e5fe',
  '6afe111137cea1a386b98ff0',
]);

async function getOrCreateConfig() {
  let cfg = await BannerConfig.findOne();
  if (!cfg) {
    cfg = await BannerConfig.create({
      heroSlides: DEFAULT_SLIDES,
      promoPopup: DEFAULT_POPUP,
      updatedBy: 'system',
    });
  } else {
    const hasLegacy = (cfg.heroSlides || []).some(s =>
      Array.from(LEGACY_MEDIA_IDS).some(id => String(s?.image || '').includes(id)) ||
      ['9-9', 'hoi-vien', 'thuc-pham-sach'].some(k => String(s?.image || '').toLowerCase().includes(k))
    );
    if (hasLegacy || !cfg.heroSlides || cfg.heroSlides.length < 4) {
      cfg.heroSlides = DEFAULT_SLIDES;
      cfg.updatedBy = 'Auto-Sanitized Fresh Produce';
      await cfg.save();
    }
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
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
      'Surrogate-Control': 'no-store',
    });
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
