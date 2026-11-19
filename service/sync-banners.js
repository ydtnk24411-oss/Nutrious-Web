const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config({ path: path.join(__dirname, '.env') });

const NEW_HERO_SLIDES = [
  {
    title: 'Rau củ thuần khiết thu hoạch sớm mai',
    subtitle: 'Nguồn nông sản hữu cơ VietGAP tươi mới mỗi ngày, trọn vẹn vị lành nguyên bản cho bữa cơm gia đình.',
    eyebrow: 'NÔNG SẢN HỮU CƠ ĐÀ LẠT',
    cta: 'Khám phá ngay',
    link: '/online-ordering',
    image: '/images/banners/banner-fresh-vegetables.jpg',
    active: true,
    sortOrder: 1,
  },
  {
    title: 'Cá hồi Na Uy tươi rói chuẩn vị biển',
    subtitle: 'Phi lê cá hồi thượng hạng giữ lạnh 0-2°C, ngọt mềm từng thớ thịt béo ngậy giàu dưỡng chất.',
    eyebrow: 'HẢI SẢN CAO CẤP NHẬP KHẨU',
    cta: 'Xem hải sản',
    link: '/online-ordering',
    image: '/images/banners/banner-seafood-salmon.jpg',
    active: true,
    sortOrder: 2,
  },
  {
    title: 'Tôm sú & cá biển tươi sống ướp đá',
    subtitle: 'Hải sản tươi sống ướp đá tự nhiên cập bến sớm, giữ trọn độ giòn ngọt thanh lành từ biển mẹ.',
    eyebrow: 'ĐÁNH BẮT TRONG NGÀY - ƯỚP ĐÁ LẠNH',
    cta: 'Đặt hàng ngay',
    link: '/online-ordering',
    image: '/images/banners/banner-seafood-ice.jpg',
    active: true,
    sortOrder: 3,
  },
  {
    title: 'Bữa ăn cân bằng nâng niu sức khỏe',
    subtitle: 'Cá hồi áp chảo thanh vị cùng rau củ hữu cơ, tính toán calorie và vi chất thanh sạch chuẩn khoa học.',
    eyebrow: 'ẨM THỰC DINH DƯỠNG LÀNH MẠNH',
    cta: 'Xem thực đơn',
    link: '/nutrition',
    image: '/images/banners/banner-salmon-dish.jpg',
    active: true,
    sortOrder: 4,
  },
  {
    title: 'Hương sắc thiên nhiên ngọt lành mỗi ngày',
    subtitle: 'Dâu tây Đà Lạt, kiwi, chuối, nho mọng nước chín cây, thanh mát bổ sung vitamin tự nhiên.',
    eyebrow: 'VƯỜN TRÁI CÂY NHIỆT ĐỚI TƯƠI MỌNG',
    cta: 'Chọn trái cây',
    link: '/promotions',
    image: '/images/banners/banner-fresh-fruits.jpg',
    active: true,
    sortOrder: 5,
  },
  {
    title: 'Tinh hoa thảo mộc đượm vị cơm nhà',
    subtitle: 'Tiêu rừng, quế chi, hoa hồi 100% tự nhiên đánh thức hương vị cơm mẹ nấu ấm áp đậm đà.',
    eyebrow: 'GIA VỊ THẢO MỘC THIÊN NHIÊN',
    cta: 'Xem gia vị',
    link: '/cook-with-what-you-have',
    image: '/images/banners/banner-spices-spoons.jpg',
    active: true,
    sortOrder: 6,
  },
  {
    title: 'Nước mắm Nam Ô truyền thống đượm tình',
    subtitle: 'Ủ chượp thủ công từ cá cơm than vịnh Đà Nẵng và muối hạt tinh khiết, lắng đọng từng giọt ngọc biển.',
    eyebrow: 'ĐẶC SẢN LÀNG NGHỀ TRĂM NĂM',
    cta: 'Mua đặc sản',
    link: '/category/all-products',
    image: '/images/banners/banner-nam-o-sauce.jpg',
    active: true,
    sortOrder: 7,
  },
  {
    title: 'Gia vị thuần khiết cho bếp Việt an tâm',
    subtitle: 'Nghệ vàng, ớt khô, tiêu sọ xay nguyên chất, bảo đảm an toàn tuyệt đối không phụ gia bảo quản.',
    eyebrow: 'BỘ SƯU TẬP GIA VỊ THƯỢNG HẠNG',
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
