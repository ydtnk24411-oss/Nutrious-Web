const mongoose = require('mongoose');

const HeroSlideSchema = new mongoose.Schema({
  id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  eyebrow: { type: String, default: 'TƯƠI SẠCH MỖI NGÀY - GIAO NHANH 2H' },
  cta: { type: String, default: 'Mua sắm ngay' },
  link: { type: String, default: '/online-ordering' },
  image: { type: String, required: true },
  active: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 },
});

const PromoPopupSchema = new mongoose.Schema({
  title: { type: String, default: 'Đại tiệc Ưu đãi Nông sản Xanh' },
  description: { type: String, default: 'Nhận ngay mã giảm giá 15% cho đơn hàng rau củ quả tươi sạch hôm nay.' },
  image: { type: String, default: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80' },
  badge: { type: String, default: 'KHUYẾN MÃI ĐẶC BIỆT' },
  voucherCode: { type: String, default: 'EVG20K' },
  buttonText: { type: String, default: 'Khám phá ưu đãi ngay' },
  buttonLink: { type: String, default: '/vouchers' },
  enabled: { type: Boolean, default: true },
  startDate: { type: Date, default: null },
  endDate: { type: Date, default: null },
});

const BannerConfigSchema = new mongoose.Schema({
  heroSlides: [HeroSlideSchema],
  promoPopup: PromoPopupSchema,
  updatedBy: { type: String, default: 'marketing' },
}, { timestamps: true });

module.exports = mongoose.model('BannerConfig', BannerConfigSchema);
