const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config({ path: path.join(__dirname, '.env') });

const NEW_HERO_SLIDES = [
  {
    title: 'Đi chợ thông minh - Nông sản tươi sạch VietGAP giao nhanh 2 giờ',
    subtitle: 'Nguồn rau củ hữu cơ tươi mới mỗi ngày, an toàn trọn vẹn bữa cơm nhà.',
    eyebrow: 'TƯƠI SẠCH MỖI NGÀY - GIAO NHANH 2H',
    cta: 'Mua sắm ngay',
    link: '/online-ordering',
    image: '/images/banners/banner-fresh-vegetables.jpg',
    active: true,
    sortOrder: 1,
  },
  {
    title: 'Cá hồi Na Uy & hải sản tươi sống cao cấp giao chuẩn lạnh',
    subtitle: 'Cá hồi tươi nhập khẩu, cá thu cá chim biển ướp lạnh giữ nguyên vị ngọt đậm.',
    eyebrow: 'HẢI SẢN TƯƠI SỐNG - GIAO NHANH 2H',
    cta: 'Xem ưu đãi',
    link: '/online-ordering',
    image: '/images/banners/banner-seafood-salmon.jpg',
    active: true,
    sortOrder: 2,
  },
  {
    title: 'Tôm sú, cá biển tươi sống ướp đá sạch bảo quản lạnh',
    subtitle: 'Hải sản tươi sống ướp đá lạnh giao ngay, chuẩn vị tươi ngon tự nhiên.',
    eyebrow: 'HẢI SẢN ƯỚP ĐÁ TƯƠI SẠCH',
    cta: 'Đặt hàng ngay',
    link: '/online-ordering',
    image: '/images/banners/banner-seafood-ice.jpg',
    active: true,
    sortOrder: 3,
  },
  {
    title: 'Cá hồi áp chảo cùng rau củ thanh mát - Dinh dưỡng đủ chất',
    subtitle: 'Thực đơn lành mạnh mỗi ngày, cân bằng dinh dưỡng cùng chuyên gia.',
    eyebrow: 'BỮA ĂN DINH DƯỠNG LÀNH MẠNH',
    cta: 'Xem thực đơn',
    link: '/nutrition',
    image: '/images/banners/banner-salmon-dish.jpg',
    active: true,
    sortOrder: 4,
  },
  {
    title: 'Trái cây nhiệt đới ngọt lành - Mọng nước giàu vitamin',
    subtitle: 'Khám phá dâu tây Đà Lạt, kiwi, chuối, xoài ngọt mát tự nhiên.',
    eyebrow: 'TRÁI CÂY TƯƠI NGỌT LÀNH',
    cta: 'Khám phá ngay',
    link: '/promotions',
    image: '/images/banners/banner-fresh-fruits.jpg',
    active: true,
    sortOrder: 5,
  },
  {
    title: 'Gia vị thảo mộc thiên nhiên - Trọn vẹn vị cơm mẹ nấu',
    subtitle: 'Thìa gỗ gia vị tự nhiên: quế, tiêu, hoa hồi, hạt ngò thơm lừng.',
    eyebrow: 'GIA VỊ THẢO MỘC TỰ NHIÊN',
    cta: 'Xem nguyên liệu',
    link: '/cook-with-what-you-have',
    image: '/images/banners/banner-spices-spoons.jpg',
    active: true,
    sortOrder: 6,
  },
  {
    title: 'Nước mắm Nam Ô truyền thống - Hương vị biển mẹ trăm năm',
    subtitle: 'Ủ chượp thủ công từ cá cơm than và muối hạt tinh khiết.',
    eyebrow: 'NƯỚC MẮM TRUYỀN THỐNG NAM Ô',
    cta: 'Mua ngay',
    link: '/category/all-products',
    image: '/images/banners/banner-nam-o-sauce.jpg',
    active: true,
    sortOrder: 7,
  },
  {
    title: 'Bộ sưu tập gia vị thượng hạng cho gian bếp gia đình',
    subtitle: 'Bột ớt, nghệ, tiêu sọ, thảo mộc nguyên chất chuẩn an toàn vệ sinh.',
    eyebrow: 'GIA VỊ NẤU NƯỚNG THƯỢNG HẠNG',
    cta: 'Khám phá ngay',
    link: '/category/all-products',
    image: '/images/banners/banner-spices-bowls.jpg',
    active: true,
    sortOrder: 8,
  },
];

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('Missing MONGODB_URI in .env');
    process.exit(1);
  }
  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(uri);
  console.log('Connected.');

  const BannerConfig = require('./models/BannerConfig');
  const BannerMedia = require('./models/BannerMedia');

  // Xóa các file media banner cũ (9.9 và Hội viên) để không ai tải lại
  const oldMediaIds = [
    '6afe009e20f0b5e73e86e586',
    '6afe00b520f0b5e73e86e5fe',
    '6afe111137cea1a386b98ff0',
  ];
  const deleteRes = await BannerMedia.deleteMany({
    _id: { $in: oldMediaIds.map(id => new mongoose.Types.ObjectId(id)) },
  });
  console.log('Deleted old legacy BannerMedia count:', deleteRes.deletedCount);

  // Cập nhật BannerConfig
  const cfg = await BannerConfig.findOne();
  if (cfg) {
    cfg.heroSlides = NEW_HERO_SLIDES;
    cfg.updatedBy = 'Lead Frontend Sync';
    await cfg.save();
    console.log('Updated existing BannerConfig successfully with 8 slides.');
  } else {
    await BannerConfig.create({
      heroSlides: NEW_HERO_SLIDES,
      promoPopup: {
        title: 'Ưu đãi Đặc biệt Dịp Lễ & Mùa Vụ Nông Sản',
        description: 'Nhập mã EVG20K để nhận ngay ưu đãi 20.000₫ cho đơn hàng rau củ quả tươi sạch từ 150.000₫.',
        image: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=800&q=80',
        badge: 'ƯU ĐÃI ĐỘC QUYỀN',
        voucherCode: 'EVG20K',
        buttonText: 'Lưu mã & Mua sắm',
        buttonLink: '/vouchers',
        enabled: true,
      },
      updatedBy: 'Lead Frontend Sync',
    });
    console.log('Created new BannerConfig with 8 slides.');
  }

  const updatedCfg = await BannerConfig.findOne();
  console.log('Current heroSlides count in DB:', updatedCfg.heroSlides.length);
  for (const s of updatedCfg.heroSlides) {
    console.log(`- [${s.sortOrder}] ${s.title} -> ${s.image}`);
  }

  await mongoose.disconnect();
  console.log('Disconnected cleanly.');
  process.exit(0);
}

run().catch(err => {
  console.error('Sync failed:', err);
  process.exit(1);
});
