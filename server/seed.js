require('dotenv').config();
const mongoose = require('mongoose');
const Product  = require('./models/Product');
const User     = require('./models/User');
const Event    = require('./models/Event');
const Service  = require('./models/Service');
const Category = require('./models/Category');
const Voucher  = require('./models/Voucher');
const Order    = require('./models/Order');

const wix = (a) => `https://static.wixstatic.com/media/${a}`;
const uns = (id) => `https://images.unsplash.com/photo-${id}?w=600&q=80`;

// ── Helpers ──────────────────────────────────────────────────────────────────
const mkProd = (o) => ({
  container:   'Bulk',
  cutType:     'Whole Leaves',
  cutting:     'Sliced',
  packSize:    'Single Pack',
  packaging:   'Twin Pack',
  preparation: 'Raw',
  ripeness:    'Ready to Eat',
  sizeGroup:   'Medium',
  thickness:   '1 Inch',
  type:        'Fresh',
  isActive:    true,
  ...o,
});

// ── Categories ────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { name: 'Rau củ',                    slug: '/category/vegetables', image: wix('0d1a41_b6a77851ff264d8aae6380a742234d2d~mv2.jpg'), order: 1 },
  { name: 'Trái cây',                  slug: '/category/fruits',     image: wix('0d1a41_788df897f4c54cd0adaf4afa3d6aa776~mv2.jpg'), order: 2 },
  { name: 'Thịt',                      slug: '/category/meat',       image: wix('0d1a41_2332e64cf86d42289c7ef555cfcd805e~mv2.jpg'), order: 3 },
  { name: 'Cá & Hải sản',              slug: '/category/seafood',    image: wix('0d1a41_075fbe21f1464e70b72b4e06eb27c9c8~mv2.jpg'), order: 4 },
  { name: 'Sữa & Thực phẩm mát',       slug: '/category/dairy',      image: uns('1563636619-e9143da7973b'),                         order: 5 },
  { name: 'Thức uống',                 slug: '/category/beverages',  image: uns('1544145945-f90425340c7e'),                         order: 6 },
  { name: 'Bánh & Đồ ăn vặt',          slug: '/category/bakery',     image: uns('1499636136210-6f4ee915583e'),                      order: 7 },
  { name: 'Gia vị & Thực phẩm khô',    slug: '/category/pantry',     image: uns('1532336414038-cf19250c5757'),                      order: 8 },
  

];

// ═══════════════════════════════════════════════════════════════════════════════
// ── VEGETABLES (Rau củ)  ──────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
const PRODUCTS_VEGETABLES = [
  // ---------- Rau xanh ----------
  mkProd({ name: 'Rau Muống Tươi',          slug: 'rau-muong-tuoi',          price: '8.000đ',  priceNumber: 8000,   category: 'Vegetables', categoryVi: 'Rau xanh',   image: uns('1540420773420-3366772f4999'), description: 'Rau muống tươi hái buổi sáng, thích hợp xào tỏi hoặc luộc, giàu sắt và vitamin C.',                       quantity: '1 Bó',   weight: '300g', stock: 120 }),
  mkProd({ name: 'Cải Thìa Baby',            slug: 'cai-thia-baby',           price: '14.000đ', priceNumber: 14000,  category: 'Vegetables', categoryVi: 'Rau xanh',   image: uns('1587411768638-ec71f8e33b78'), description: 'Cải thìa baby non mềm, vị ngọt nhẹ, thích hợp xào, nấu canh hoặc làm salad.',                              quantity: '1 Gói',  weight: '250g', stock: 85 }),
  mkProd({ name: 'Rau Cải Ngọt',             slug: 'rau-cai-ngot',            price: '10.000đ', priceNumber: 10000,  category: 'Vegetables', categoryVi: 'Rau xanh',   image: uns('1576045057032-026b06c5b5d6'), description: 'Cải ngọt non giòn, vị ngọt dịu tự nhiên, thích hợp luộc, xào hoặc nấu canh.',                               quantity: '1 Bó',   weight: '300g', stock: 100 }),
  mkProd({ name: 'Rau Mồng Tơi',             slug: 'rau-mong-toi',            price: '9.000đ',  priceNumber: 9000,   category: 'Vegetables', categoryVi: 'Rau xanh',   image: uns('1512621776951-a57141f001a6'), description: 'Mồng tơi tươi mát, giàu chất nhầy tốt cho tiêu hóa, xào tỏi hoặc nấu canh chua.',                         quantity: '1 Bó',   weight: '250g', stock: 95 }),
  mkProd({ name: 'Cải Xanh Đà Lạt',          slug: 'cai-xanh-da-lat',         price: '12.000đ', priceNumber: 12000,  category: 'Vegetables', categoryVi: 'Rau xanh',   image: uns('1584270354949-c26b0d5b1f62'), description: 'Cải xanh Đà Lạt lá to giòn, vị đắng nhẹ đặc trưng, trồng hữu cơ không thuốc trừ sâu.',                    quantity: '1 Gói',  weight: '350g', stock: 80 }),
  // ---------- Củ, quả đất ----------
  mkProd({ name: 'Cà Rốt Baby Đà Lạt',       slug: 'ca-rot-baby-da-lat',      price: '22.000đ', priceNumber: 22000,  category: 'Vegetables', categoryVi: 'Củ quả',     image: uns('1447175008436-a35e25417040'), description: 'Cà rốt baby Đà Lạt ngọt tự nhiên, giàu beta-caroten, ăn sống giòn hoặc hầm soup.',                          quantity: '500g',   weight: '500g', stock: 90 }),
  mkProd({ name: 'Khoai Lang Mật Vĩnh Long',  slug: 'khoai-lang-mat-vinh-long',price: '18.000đ', priceNumber: 18000,  category: 'Vegetables', categoryVi: 'Củ quả',     image: uns('1596123068616-a01f2f3a9b24'), description: 'Khoai lang mật Vĩnh Long ngọt bùi, ruột vàng cam, hấp, nướng hay làm bánh đều tuyệt.',                     quantity: '1 Kg',   weight: '1000g', stock: 90 }),
  mkProd({ name: 'Củ Cải Trắng Tươi',         slug: 'cu-cai-trang-tuoi',       price: '15.000đ', priceNumber: 15000,  category: 'Vegetables', categoryVi: 'Củ quả',     image: uns('1570586776745-8e2245a15b79'), description: 'Củ cải trắng giòn, vị cay nhẹ, hầm xương, muối chua hay xào đều ngon.',                                    quantity: '1 Kg',   weight: '1000g', stock: 75 }),
  mkProd({ name: 'Ngô Ngọt Non Tây Ninh',     slug: 'ngo-ngot-non-tay-ninh',   price: '12.000đ', priceNumber: 12000,  category: 'Vegetables', categoryVi: 'Củ quả',     image: uns('1551754655-cd27e38d2076'),    description: 'Ngô non ngọt giòn Tây Ninh, giàu tinh bột và khoáng chất, hấp, nướng hoặc nấu canh.',                     quantity: '2 Trái', weight: '400g', stock: 100 }),
  mkProd({ name: 'Cà Chua Bi Đà Lạt',         slug: 'ca-chua-bi-da-lat',       price: '28.000đ', priceNumber: 28000,  category: 'Vegetables', categoryVi: 'Củ quả',     image: uns('1546793665-c807762997cc'),    description: 'Cà chua bi Đà Lạt ngọt đậm, nhiều nước, ăn sống salad hoặc làm sốt pasta thơm ngon.',                    quantity: '500g',   weight: '500g', stock: 70 }),
  mkProd({ name: 'Ớt Chuông 3 Màu',           slug: 'ot-chuong-3-mau',         price: '35.000đ', priceNumber: 35000,  category: 'Vegetables', categoryVi: 'Củ quả',     image: uns('1563565375-f3fdfdbefa83'),    description: 'Bộ ớt chuông đỏ-vàng-xanh giòn ngọt, giàu vitamin C, xào thập cẩm hay ăn sống đều đẹp.',                 quantity: '3 Trái', weight: '350g', stock: 65 }),
  mkProd({ name: 'Đậu Bắp Tươi Miền Tây',     slug: 'dau-bap-tuoi-mien-tay',   price: '16.000đ', priceNumber: 16000,  category: 'Vegetables', categoryVi: 'Củ quả',     image: uns('1613840024249-62ae4577d8e8'), description: 'Đậu bắp tươi miền Tây giòn, giàu chất nhầy tốt cho tiêu hóa, luộc, xào hoặc hầm.',                        quantity: '400g',   weight: '400g', stock: 70 }),
  // ---------- Nấm ----------
  mkProd({ name: 'Nấm Đông Cô Đà Lạt',        slug: 'nam-dong-co-da-lat',      price: '38.000đ', priceNumber: 38000,  category: 'Vegetables', categoryVi: 'Nấm',        image: uns('1586190848861-99aa4a171e90'), description: 'Nấm đông cô Đà Lạt tươi thơm đậm, giàu protein và khoáng chất, xào, hầm, nấu canh.',                       quantity: '200g',   weight: '200g', stock: 55 }),
  mkProd({ name: 'Nấm Kim Châm Tươi',          slug: 'nam-kim-cham-tuoi',       price: '18.000đ', priceNumber: 18000,  category: 'Vegetables', categoryVi: 'Nấm',        image: uns('1604577882580-8b3f898e81ae'), description: 'Nấm kim châm trắng mềm, thơm dịu, nhúng lẩu, xào bơ tỏi hoặc nấu canh đều ngon.',                         quantity: '200g',   weight: '200g', stock: 80 }),
  mkProd({ name: 'Nấm Rơm Tươi',               slug: 'nam-rom-tuoi',            price: '25.000đ', priceNumber: 25000,  category: 'Vegetables', categoryVi: 'Nấm',        image: uns('1510009346899-029ce81afc6e'), description: 'Nấm rơm tươi hái sáng sớm, vị ngọt thơm đặc trưng, kho tương, xào hoặc nấu canh chua.',                   quantity: '300g',   weight: '300g', stock: 60 }),
  // ---------- Gia vị tươi ----------
  mkProd({ name: 'Tỏi Tươi Lý Sơn',           slug: 'toi-tuoi-ly-son',         price: '32.000đ', priceNumber: 32000,  category: 'Vegetables', categoryVi: 'Gia vị tươi',image: uns('1615485500834-bc10199bc727'), description: 'Tỏi Lý Sơn nổi tiếng thơm nồng, củ nhỏ cánh mỏng, kháng khuẩn tự nhiên, gia vị số 1 ẩm thực Việt.',       quantity: '200g',   weight: '200g', stock: 95 }),
  mkProd({ name: 'Gừng Tươi Hưng Yên',         slug: 'gung-tuoi-hung-yen',      price: '20.000đ', priceNumber: 20000,  category: 'Vegetables', categoryVi: 'Gia vị tươi',image: uns('1615485500834-bc10199bc727'), description: 'Gừng tươi Hưng Yên cay nồng, giàu gingerol, làm ấm bụng, khử tanh và ướp thịt cá.',                       quantity: '300g',   weight: '300g', stock: 85 }),
  mkProd({ name: 'Sả Tươi Bến Tre',            slug: 'sa-tuoi-ben-tre',         price: '10.000đ', priceNumber: 10000,  category: 'Vegetables', categoryVi: 'Gia vị tươi',image: uns('1597690723046-4ba3c37a32ee'), description: 'Sả tươi Bến Tre thơm đặc trưng, nguyên liệu không thể thiếu trong gà lá chanh, bò lúc lắc, lẩu Thái.',    quantity: '1 Bó',   weight: '250g', stock: 80 }),
  mkProd({ name: 'Hành Lá Tươi',               slug: 'hanh-la-tuoi',            price: '8.000đ',  priceNumber: 8000,   category: 'Vegetables', categoryVi: 'Gia vị tươi',image: uns('1558864669-3937ca9f9192'),    description: 'Hành lá xanh tươi, thơm nhẹ, rắc lên mọi món ăn Việt từ phở, bún, cháo đến canh.',                         quantity: '1 Bó',   weight: '150g', stock: 110 }),
];

// ═══════════════════════════════════════════════════════════════════════════════
// ── FRUITS (Trái cây)  ────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
const PRODUCTS_FRUITS = [
  // ---------- Trái cây Việt Nam đặc sản ----------
  mkProd({ name: 'Xoài Cát Hòa Lộc',          slug: 'xoai-cat-hoa-loc',        price: '55.000đ', priceNumber: 55000,  category: 'Fruits', categoryVi: 'Đặc sản Việt', image: uns('1553279768-865429fa0078'),    description: 'Xoài cát Hòa Lộc thơm dịu, thịt vàng mịn không xơ, đặc sản nức tiếng miền Tây, ngọt ngất ngây.', quantity: '2 Trái', weight: '700g',  stock: 40, options: [{ name: 'Độ chín', values: ['Chín vừa', 'Chín kỹ'] }] }),
  mkProd({ name: 'Thanh Long Ruột Đỏ Bình Thuận', slug: 'thanh-long-ruot-do',   price: '32.000đ', priceNumber: 32000,  category: 'Fruits', categoryVi: 'Đặc sản Việt', image: uns('1527325678964-54921661f888'),  description: 'Thanh long ruột đỏ Bình Thuận, ngọt vừa, giàu chất chống oxy hóa, đẹp mắt trong tráng miệng.', quantity: '2 Trái', weight: '600g',  stock: 60 }),
  mkProd({ name: 'Cam Sành Vĩnh Long',          slug: 'cam-sanh-vinh-long',      price: '35.000đ', priceNumber: 35000,  category: 'Fruits', categoryVi: 'Đặc sản Việt', image: uns('1547514701-42782101795e'),    description: 'Cam sành Vĩnh Long vỏ xanh múi đỏ, ngọt đậm và nhiều nước, đặc sản miền Tây Nam Bộ.',         quantity: '1 Kg',   weight: '1000g', stock: 70, options: [{ name: 'Kích cỡ', values: ['Nhỡ', 'To'] }] }),
  mkProd({ name: 'Dâu Tây Đà Lạt',              slug: 'dau-tay-da-lat',          price: '42.000đ', priceNumber: 42000,  category: 'Fruits', categoryVi: 'Đặc sản Việt', image: uns('1464965911861-746a04b4bca6'),  description: 'Dâu tây Đà Lạt đỏ mọng, ngọt chua tự nhiên, hái buổi sáng đảm bảo độ tươi ngon nhất.',        quantity: '300g',   weight: '300g',  stock: 50, options: [{ name: 'Loại', values: ['Thường', 'Premium'] }] }),
  mkProd({ name: 'Bưởi Da Xanh Bến Tre',        slug: 'buoi-da-xanh-ben-tre',    price: '48.000đ', priceNumber: 48000,  category: 'Fruits', categoryVi: 'Đặc sản Việt', image: uns('1611080626919-7cf5a9dbab12'),  description: 'Bưởi da xanh Bến Tre múi hồng đỏ, ngọt thanh, ít hạt, giàu vitamin C.',                        quantity: '1 Trái', weight: '1200g', stock: 35 }),
  mkProd({ name: 'Nhãn Lồng Hưng Yên',          slug: 'nhan-long-hung-yen',      price: '38.000đ', priceNumber: 38000,  category: 'Fruits', categoryVi: 'Đặc sản Việt', image: uns('1519996409144-56c88c35ba26'),  description: 'Nhãn lồng Hưng Yên cùi dày, ngọt đậm, hạt nhỏ, hương thơm đặc trưng khó trộn lẫn.',           quantity: '500g',   weight: '500g',  stock: 55 }),
  mkProd({ name: 'Dứa Queen Đà Lạt',            slug: 'dua-queen-da-lat',        price: '28.000đ', priceNumber: 28000,  category: 'Fruits', categoryVi: 'Đặc sản Việt', image: uns('1550258987-190a2d41a8ba'),    description: 'Dứa Queen ngọt lịm, ít mắt, thơm đặc trưng vùng cao Đà Lạt, tươi giòn và nhiều nước.',        quantity: '1 Trái', weight: '900g',  stock: 45 }),
  mkProd({ name: 'Dưa Hấu Hội An',              slug: 'dua-hau-hoi-an',          price: '30.000đ', priceNumber: 30000,  category: 'Fruits', categoryVi: 'Đặc sản Việt', image: uns('1563114773-84221bd62daa'),    description: 'Dưa hấu Hội An ruột đỏ tươi, giòn ngọt mát, giải nhiệt tốt nhất mùa hè.',                    quantity: '1/4 Trái',weight: '1500g', stock: 45 }),
  mkProd({ name: 'Sầu Riêng Ri6 Cai Lậy',       slug: 'sau-rieng-ri6-cai-lay',   price: '85.000đ', priceNumber: 85000,  category: 'Fruits', categoryVi: 'Đặc sản Việt', image: uns('1609780262-ac0fa2e47a08'),    description: 'Sầu riêng Ri6 Cai Lậy múi vàng kem béo ngậy, thơm lừng, không xơ, đặc sản số 1 miền Tây.',   quantity: '1 Kg',   weight: '1000g', stock: 25, options: [{ name: 'Loại', values: ['Nguyên hạt', 'Đã tách múi'] }] }),
  mkProd({ name: 'Vải Thiều Lục Ngạn',           slug: 'vai-thieu-luc-ngan',      price: '45.000đ', priceNumber: 45000,  category: 'Fruits', categoryVi: 'Đặc sản Việt', image: uns('1519996409144-56c88c35ba26'),  description: 'Vải thiều Lục Ngạn – Bắc Giang cùi giòn dày, ngọt thanh, đỏ mọng đặc sản mùa hè miền Bắc.',  quantity: '500g',   weight: '500g',  stock: 40 }),
  mkProd({ name: 'Măng Cụt Bình Dương',          slug: 'mang-cut-binh-duong',     price: '52.000đ', priceNumber: 52000,  category: 'Fruits', categoryVi: 'Đặc sản Việt', image: uns('1556909211-54d3640fcb8b'),    description: 'Măng cụt Bình Dương – "nữ hoàng trái cây", múi trắng ngọt chua thanh, vỏ tím sẫm dày.',       quantity: '500g',   weight: '500g',  stock: 30 }),
  mkProd({ name: 'Chôm Chôm Bến Tre',            slug: 'chom-chom-ben-tre',       price: '28.000đ', priceNumber: 28000,  category: 'Fruits', categoryVi: 'Đặc sản Việt', image: uns('1519996409144-56c88c35ba26'),  description: 'Chôm chôm Bến Tre lông đỏ, múi trắng giòn ngọt, thơm nhẹ, hái tươi từ vườn miền Tây.',        quantity: '500g',   weight: '500g',  stock: 50 }),
  // ---------- Trái cây nhập / phổ biến ----------
  mkProd({ name: 'Táo Fuji Nhật Bản',            slug: 'tao-fuji-nhat-ban',       price: '55.000đ', priceNumber: 55000,  category: 'Fruits', categoryVi: 'Nhập khẩu',    image: uns('1560806887-8d801c6168ea'),    description: 'Táo Fuji Nhật Bản giòn ngọt đậm, vỏ đỏ tươi, nhập khẩu chính ngạch, kiểm tra VSATTP.',      quantity: '4 Quả',  weight: '700g',  stock: 45, options: [{ name: 'Kích cỡ', values: ['Nhỡ', 'To'] }] }),
  mkProd({ name: 'Nho Đen Không Hạt Mỹ',         slug: 'nho-den-khong-hat-my',    price: '65.000đ', priceNumber: 65000,  category: 'Fruits', categoryVi: 'Nhập khẩu',    image: uns('1474804540968-e7b5a1b38f79'),  description: 'Nho đen không hạt nhập khẩu từ Mỹ, cùi dày giòn ngọt, ăn trực tiếp hoặc dùng làm sinh tố.', quantity: '500g',   weight: '500g',  stock: 35 }),
];

// ═══════════════════════════════════════════════════════════════════════════════
// ── MEAT (Thịt)  ──────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
const PRODUCTS_MEAT = [
  // ---------- Heo ----------
  mkProd({ name: 'Thịt Ba Chỉ Heo CP',          slug: 'thit-ba-chi-heo-cp',      price: '92.000đ', priceNumber: 92000,  category: 'Meat', categoryVi: 'Heo', image: uns('1558030006-450675393462'), description: 'Thịt ba chỉ heo CP tươi, tỷ lệ nạc mỡ cân đối 6:4, thích hợp kho tàu, quay hoặc luộc chấm mắm.', quantity: '500g', weight: '500g', stock: 45, options: [{ name: 'Độ dày', values: ['Lát mỏng', 'Lát dày'] }] }),
  mkProd({ name: 'Thịt Nạc Vai Heo Sạch',        slug: 'thit-nac-vai-heo-sach',   price: '80.000đ', priceNumber: 80000,  category: 'Meat', categoryVi: 'Heo', image: uns('1607623814075-e51df1bdc82f'), description: 'Thịt nạc vai heo sạch – không kháng sinh, thịt hồng tươi, làm nhân bánh, xào hay nấu bún.',       quantity: '500g', weight: '500g', stock: 55 }),
  mkProd({ name: 'Sườn Non Heo Tươi',             slug: 'suon-non-heo-tuoi',       price: '115.000đ',priceNumber: 115000, category: 'Meat', categoryVi: 'Heo', image: uns('1558030006-450675393462'), description: 'Sườn non heo tươi nhiều thịt, ít xương vụn, nướng BBQ, chiên giòn hay kho tiêu đều thơm ngon.', quantity: '500g', weight: '500g', stock: 40 }),
  mkProd({ name: 'Giò Lụa Hương Việt 200g',       slug: 'gio-lua-huong-viet',      price: '48.000đ', priceNumber: 48000,  category: 'Meat', categoryVi: 'Heo', image: uns('1567620905732-2d1ec7ab7445'), description: 'Giò lụa Hương Việt dai mịn, vị đậm thơm đặc trưng, làm từ thịt heo tươi không phụ gia độc hại.', quantity: '200g', weight: '200g', stock: 50 }),
  mkProd({ name: 'Xúc Xích Đức Việt Heo',         slug: 'xuc-xich-duc-viet-heo',   price: '52.000đ', priceNumber: 52000,  category: 'Meat', categoryVi: 'Heo', image: uns('1555041469-a586c61ea9bc'), description: 'Xúc xích Đức Việt – thương hiệu Việt Nam uy tín, dai giòn, thơm khói tự nhiên, tiện chiên bữa sáng.', quantity: '200g', weight: '200g', stock: 60 }),
  mkProd({ name: 'Gan Heo Tươi',                  slug: 'gan-heo-tuoi',            price: '55.000đ', priceNumber: 55000,  category: 'Meat', categoryVi: 'Heo', image: uns('1504674900247-0877df9cc836'), description: 'Gan heo tươi sạch, giàu sắt và vitamin A, thích hợp xào hành tỏi hoặc làm pate truyền thống.',   quantity: '300g', weight: '300g', stock: 40 }),
  // ---------- Bò ----------
  mkProd({ name: 'Thịt Bò Bắp Mỹ Nhập Khẩu',    slug: 'thit-bo-bap-my-nhap',     price: '185.000đ',priceNumber: 185000, category: 'Meat', categoryVi: 'Bò', image: uns('1546833999-b9f581a1996d'), description: 'Bắp bò Mỹ nhập khẩu vân gân đẹp, hầm nhừ thịt mềm ngọt, thích hợp nấu bún bò, phở hoặc kho.', quantity: '500g', weight: '500g', stock: 25, options: [{ name: 'Chế biến', values: ['Nguyên miếng', 'Thái lát'] }] }),
  mkProd({ name: 'Bò Thăn Nội Tươi',              slug: 'bo-than-noi-tuoi',         price: '160.000đ',priceNumber: 160000, category: 'Meat', categoryVi: 'Bò', image: uns('1546833999-b9f581a1996d'), description: 'Bò thăn nội tươi thịt đỏ hồng, thớ mịn, nướng lửa than, xào lăn hoặc nhúng lẩu.',             quantity: '300g', weight: '300g', stock: 35 }),
  mkProd({ name: 'Bò Viên Phúc Long 500g',        slug: 'bo-vien-phuc-long',        price: '68.000đ', priceNumber: 68000,  category: 'Meat', categoryVi: 'Bò', image: uns('1519708227418-c8fd9a32b7a2'), description: 'Bò viên Phúc Long – thương hiệu VN nổi tiếng, dai giòn, thơm đậm, nhúng lẩu, nấu bún bò.',    quantity: '500g', weight: '500g', stock: 65 }),
  // ---------- Gà ----------
  mkProd({ name: 'Gà Ta Thả Vườn Nguyên Con',     slug: 'ga-ta-tha-vuon',          price: '150.000đ',priceNumber: 150000, category: 'Meat', categoryVi: 'Gà', image: uns('1518492104633-130d0cc84637'), description: 'Gà ta thả vườn nguyên con, thịt vàng chắc thơm, phù hợp luộc, hấp gừng sả hoặc nướng muối ớt.', quantity: '1 Con (khoảng 1.2kg)', weight: '1200g', stock: 30 }),
  mkProd({ name: 'Đùi Gà Công Nghiệp C.P',        slug: 'dui-ga-cong-nghiep-cp',   price: '72.000đ', priceNumber: 72000,  category: 'Meat', categoryVi: 'Gà', image: uns('1501200898405-f2284e1f15ab'), description: 'Đùi gà CP tươi nhiều thịt, da vàng đẹp, chiên giòn, nướng BBQ hoặc om sả ớt đều thơm ngon.',   quantity: '500g', weight: '500g', stock: 55 }),
  mkProd({ name: 'Cánh Gà Giữa Tươi',             slug: 'canh-ga-giua-tuoi',       price: '65.000đ', priceNumber: 65000,  category: 'Meat', categoryVi: 'Gà', image: uns('1501200898405-f2284e1f15ab'), description: 'Cánh gà giữa tươi, da giòn sau khi chiên hoặc nướng, ướp tương mật ong cực hấp dẫn.',          quantity: '500g', weight: '500g', stock: 60 }),
  // ---------- Vịt / Bò ngoại ----------
  mkProd({ name: 'Lườn Vịt Xiêm Tươi',            slug: 'luon-vit-xiem-tuoi',      price: '75.000đ', priceNumber: 75000,  category: 'Meat', categoryVi: 'Vịt', image: uns('1518492104633-130d0cc84637'), description: 'Lườn vịt xiêm tươi thịt đỏ chắc, ít mỡ, nấu lẩu, chiên sả ớt hoặc kho gừng đều ngon.',       quantity: '500g', weight: '500g', stock: 35 }),
  mkProd({ name: 'Thịt Cừu Úc Nhập Khẩu',         slug: 'thit-cuu-uc-nhap',        price: '210.000đ',priceNumber: 210000, category: 'Meat', categoryVi: 'Nhập khẩu', image: uns('1546833999-b9f581a1996d'), description: 'Thịt cừu Úc nhập khẩu thơm đặc trưng, mềm ngọt, nướng rack of lamb hoặc xào rosemary.', quantity: '300g', weight: '300g', stock: 20 }),
];

// ═══════════════════════════════════════════════════════════════════════════════
// ── SEAFOOD (Cá & Hải sản)  ───────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
const PRODUCTS_SEAFOOD = [
  // ---------- Tôm ----------
  mkProd({ name: 'Tôm Sú Tươi Sống Cà Mau',      slug: 'tom-su-tuoi-song-ca-mau', price: '195.000đ',priceNumber: 195000, category: 'Seafood', categoryVi: 'Tôm', image: uns('1565680018434-b513d5e5fd47'), description: 'Tôm sú Cà Mau tươi sống size 20-25 con/kg, thịt chắc ngọt, hấp, nướng, rang muối hay làm lẩu.',    quantity: '500g', weight: '500g', stock: 30, options: [{ name: 'Size', values: ['20-25 con/kg', '15-20 con/kg'] }] }),
  mkProd({ name: 'Tôm Thẻ Chân Trắng Sạch',      slug: 'tom-the-chan-trang-sach',  price: '140.000đ',priceNumber: 140000, category: 'Seafood', categoryVi: 'Tôm', image: uns('1625938144755-652e08e359b7'), description: 'Tôm thẻ chân trắng nuôi sạch – ao kiểm soát kháng sinh, thịt chắc trắng, hấp, luộc, rang muối.',  quantity: '500g', weight: '500g', stock: 40 }),
  mkProd({ name: 'Tôm Hùm Bông Nha Trang',        slug: 'tom-hum-bong-nha-trang',  price: '780.000đ',priceNumber: 780000, category: 'Seafood', categoryVi: 'Tôm', image: uns('1565680018434-b513d5e5fd47'), description: 'Tôm hùm bông Nha Trang tươi sống, thịt trắng ngọt béo, hấp bia, nướng phô mai hay làm sashimi.',  quantity: '1 Con (khoảng 500g)', weight: '500g', stock: 10 }),
  // ---------- Cá ----------
  mkProd({ name: 'Cá Hồi Na Uy Fillet Tươi',      slug: 'ca-hoi-na-uy-fillet',     price: '260.000đ',priceNumber: 260000, category: 'Seafood', categoryVi: 'Cá', image: uns('1510130387422-82bed34b37e9'), description: 'Cá hồi Na Uy fillet tươi nhập khẩu, thịt hồng đậm, giàu omega-3, áp chảo, nướng hoặc ăn sashimi.', quantity: '300g', weight: '300g', stock: 25, options: [{ name: 'Phần', values: ['Phần lưng', 'Phần bụng'] }] }),
  mkProd({ name: 'Cá Basa Fillet Đồng Tháp',      slug: 'ca-basa-fillet-dong-thap', price: '72.000đ', priceNumber: 72000,  category: 'Seafood', categoryVi: 'Cá', image: uns('1510130387422-82bed34b37e9'), description: 'Cá basa fillet Đồng Tháp thịt trắng mịn không xương, dễ chế biến, kho, chiên, nấu canh chua.',    quantity: '500g', weight: '500g', stock: 40 }),
  mkProd({ name: 'Cá Chẽm Fillet Tươi',            slug: 'ca-chem-fillet-tuoi',     price: '110.000đ',priceNumber: 110000, category: 'Seafood', categoryVi: 'Cá', image: uns('1519708227418-c8fd9a32b7a2'), description: 'Cá chẽm fillet thịt trắng dày ngọt, chiên giòn, hấp gừng hoặc nướng lá chuối đều xuất sắc.',     quantity: '500g', weight: '500g', stock: 35 }),
  mkProd({ name: 'Cá Thu Đại Dương Khúc',          slug: 'ca-thu-dai-duong-khuc',   price: '145.000đ',priceNumber: 145000, category: 'Seafood', categoryVi: 'Cá', image: uns('1578662996442-48f60103fc96'), description: 'Cá thu đại dương thịt đỏ hồng chắc, giàu omega-3, chiên sả hay kho mặn nước dừa đều thơm ngon.',  quantity: '500g', weight: '500g', stock: 30 }),
  mkProd({ name: 'Cá Diêu Hồng Ao Sạch',           slug: 'ca-dieu-hong-ao-sach',   price: '72.000đ', priceNumber: 72000,  category: 'Seafood', categoryVi: 'Cá', image: uns('1615141982883-c7ad0e69fd62'), description: 'Cá diêu hồng nuôi ao sạch Đồng Tháp, thịt trắng ngọt, hấp gừng sả hoặc chiên giòn cuốn bánh tráng.', quantity: '1 Con (khoảng 600g)', weight: '600g', stock: 40 }),
  mkProd({ name: 'Cá Lóc Tươi Miền Tây',           slug: 'ca-loc-tuoi-mien-tay',   price: '88.000đ', priceNumber: 88000,  category: 'Seafood', categoryVi: 'Cá', image: uns('1519708227418-c8fd9a32b7a2'), description: 'Cá lóc đồng miền Tây tươi sống, thịt trắng ngọt ít xương, nướng mọi, nấu canh chua hoặc kho tiêu.', quantity: '1 Con (khoảng 500g)', weight: '500g', stock: 35 }),
  // ---------- Mực & Bạch tuộc ----------
  mkProd({ name: 'Mực Ống Tươi Phan Thiết',        slug: 'muc-ong-tuoi-phan-thiet', price: '120.000đ',priceNumber: 120000, category: 'Seafood', categoryVi: 'Mực', image: uns('1604594849809-dfedbc827105'), description: 'Mực ống Phan Thiết tươi thịt trắng giòn, vị ngọt tự nhiên, xào, chiên, nướng đều thơm ngon.',     quantity: '500g', weight: '500g', stock: 35, options: [{ name: 'Sơ chế', values: ['Nguyên con', 'Đã làm sạch'] }] }),
  mkProd({ name: 'Bạch Tuộc Mini Tươi',             slug: 'bach-tuoc-mini-tuoi',    price: '95.000đ', priceNumber: 95000,  category: 'Seafood', categoryVi: 'Mực', image: uns('1559734840-f9509ee5677f'), description: 'Bạch tuộc mini tươi giòn ngọt, nướng mỡ hành, xào sả ớt hay nhúng lẩu đều xuất sắc.',          quantity: '400g', weight: '400g', stock: 30 }),
  // ---------- Cua, Ghẹ, Nghêu, Hàu ----------
  mkProd({ name: 'Cua Biển Cà Mau Tươi Sống',      slug: 'cua-bien-ca-mau-tuoi',   price: '240.000đ',priceNumber: 240000, category: 'Seafood', categoryVi: 'Cua & Ghẹ', image: uns('1550367363-02bb7dbb445d'), description: 'Cua biển Cà Mau tươi sống gạch đầy, thịt chắc ngọt, hấp bia, rang me hoặc nấu cháo.',          quantity: '1 Con (khoảng 600g)', weight: '600g', stock: 20 }),
  mkProd({ name: 'Ghẹ Xanh Tươi Vũng Tàu',         slug: 'ghe-xanh-tuoi-vung-tau', price: '165.000đ',priceNumber: 165000, category: 'Seafood', categoryVi: 'Cua & Ghẹ', image: uns('1550367363-02bb7dbb445d'), description: 'Ghẹ xanh Vũng Tàu tươi sống thịt ngọt, rang sả ớt, hấp gừng hoặc làm bún ghẹ miền Trung.',     quantity: '500g', weight: '500g', stock: 25 }),
  mkProd({ name: 'Nghêu Biển Tươi Bến Tre',         slug: 'ngheu-bien-tuoi-ben-tre', price: '55.000đ', priceNumber: 55000,  category: 'Seafood', categoryVi: 'Nhuyễn thể', image: uns('1553659971-f01207815431'), description: 'Nghêu biển Bến Tre tươi sống, thịt béo ngọt, hấp sả gừng, rang muối sả ớt hay nấu canh chua.',  quantity: '500g', weight: '500g', stock: 45 }),
  mkProd({ name: 'Hàu Tươi Vũng Tàu',               slug: 'hau-tuoi-vung-tau',      price: '68.000đ', priceNumber: 68000,  category: 'Seafood', categoryVi: 'Nhuyễn thể', image: uns('1569718212165-3a8278d5f624'), description: 'Hàu tươi Vũng Tàu vỏ dày, thịt béo ngọt, nướng mỡ hành phô mai hoặc ăn sống với chanh ớt.',   quantity: '500g (khoảng 10 con)', weight: '500g', stock: 30 }),
  mkProd({ name: 'Sò Huyết Tươi',                   slug: 'so-huyet-tuoi',          price: '58.000đ', priceNumber: 58000,  category: 'Seafood', categoryVi: 'Nhuyễn thể', image: uns('1553659971-f01207815431'), description: 'Sò huyết tươi thịt đỏ mọng, giàu sắt, xào lăn, nhúng lẩu hay ăn kèm bánh tráng đều ngon.',     quantity: '500g', weight: '500g', stock: 40 }),
];

// ═══════════════════════════════════════════════════════════════════════════════
// ── DAIRY – Sữa & Thực phẩm mát  ─────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
const PRODUCTS_DAIRY = [
  // ---------- Sữa tươi ----------
  mkProd({ name: 'Sữa Tươi Tiệt Trùng TH True Milk 1L',    slug: 'sua-tuoi-tiet-trung-th-1l',       price: '38.000đ', priceNumber: 38000,  category: 'Dairy', categoryVi: 'Sữa tươi',      image: uns('1563636619-e9143da7973b'), description: 'Sữa tươi TH True Milk không đường tiệt trùng, nguyên chất 100% từ trang trại chuẩn quốc tế, bảo quản 6 tháng.',                quantity: '1 Hộp',      weight: '1000ml', stock: 80 }),
  mkProd({ name: 'Sữa Tươi Vinamilk 100% Có Đường 1L',      slug: 'sua-tuoi-vinamilk-co-duong-1l',   price: '35.000đ', priceNumber: 35000,  category: 'Dairy', categoryVi: 'Sữa tươi',      image: uns('1563636619-e9143da7973b'), description: 'Sữa tươi Vinamilk 100% có đường, hương vị thơm ngon quen thuộc, bổ sung canxi và vitamin D3.',                                    quantity: '1 Hộp',      weight: '1000ml', stock: 90 }),
  mkProd({ name: 'Sữa Chua Uống Vinamilk Probi 65ml x6',    slug: 'sua-chua-uong-vinamilk-probi',    price: '32.000đ', priceNumber: 32000,  category: 'Dairy', categoryVi: 'Sữa chua',      image: uns('1488477583-0958585028-0e'), description: 'Sữa chua uống Vinamilk Probi men vi sinh sống, tốt cho hệ tiêu hóa, vị chua ngọt dễ uống.',                                      quantity: '6 Hộp',      weight: '390ml',  stock: 70 }),
  mkProd({ name: 'Sữa Chua Ăn TH True Yogurt 100g x4',      slug: 'sua-chua-an-th-true-yogurt',      price: '28.000đ', priceNumber: 28000,  category: 'Dairy', categoryVi: 'Sữa chua',      image: uns('1488477583-0958585028-0e'), description: 'Sữa chua ăn TH True Yogurt không đường, men vi sinh sống, mịn béo tự nhiên.',                                                     quantity: '4 Hũ',       weight: '400g',   stock: 65 }),
  mkProd({ name: 'Phô Mai Con Bò Cười 8 Miếng',             slug: 'pho-mai-con-bo-cuoi-8-mieng',     price: '52.000đ', priceNumber: 52000,  category: 'Dairy', categoryVi: 'Phô mai',       image: uns('1452195100-fe69bfc3cb6e'), description: 'Phô mai con bò cười nhập khẩu Pháp, creamy, bổ sung canxi, tiện dùng cho trẻ em và làm sandwich.',                                quantity: '8 Miếng',    weight: '120g',   stock: 60 }),
  mkProd({ name: 'Phô Mai Mozzarella Anchor 250g',           slug: 'pho-mai-mozzarella-anchor',       price: '85.000đ', priceNumber: 85000,  category: 'Dairy', categoryVi: 'Phô mai',       image: uns('1452195100-fe69bfc3cb6e'), description: 'Phô mai mozzarella Anchor New Zealand, kéo sợi đẹp khi nướng, dùng cho pizza, bánh mì nướng.',                                  quantity: '1 Gói',      weight: '250g',   stock: 40 }),
  // ---------- Trứng ----------
  mkProd({ name: 'Trứng Gà Ta Sạch Vườn Quê 10 Quả',        slug: 'trung-ga-ta-sach-vuon-que',       price: '45.000đ', priceNumber: 45000,  category: 'Dairy', categoryVi: 'Trứng',         image: uns('1582722007-0908a24b9be0'), description: 'Trứng gà ta nuôi sạch, lòng đỏ vàng đậm, không tăng trưởng, phù hợp trẻ em và người lớn tuổi.',                                  quantity: '10 Quả',     weight: '600g',   stock: 75 }),
  mkProd({ name: 'Trứng Gà Công Nghiệp Ba Huân 10 Quả',      slug: 'trung-ga-ba-huan-10',             price: '32.000đ', priceNumber: 32000,  category: 'Dairy', categoryVi: 'Trứng',         image: uns('1582722007-0908a24b9be0'), description: 'Trứng gà Ba Huân – thương hiệu VN uy tín, sạch khuẩn salmonella, được kiểm định chất lượng nghiêm ngặt.',                         quantity: '10 Quả',     weight: '600g',   stock: 100 }),
  mkProd({ name: 'Trứng Vịt Muối Sẵn 4 Quả',                slug: 'trung-vit-muoi-san',              price: '28.000đ', priceNumber: 28000,  category: 'Dairy', categoryVi: 'Trứng',         image: uns('1582722007-0908a24b9be0'), description: 'Trứng vịt muối đã qua sơ chế, lòng đỏ chảy dầu đặc trưng, ăn kèm cháo trắng hay làm bánh.',                                     quantity: '4 Quả',      weight: '300g',   stock: 55 }),
  // ---------- Bơ / kem ----------
  mkProd({ name: 'Bơ Lạt Tường An 200g',                    slug: 'bo-lat-tuong-an-200g',            price: '42.000đ', priceNumber: 42000,  category: 'Dairy', categoryVi: 'Bơ & kem',      image: uns('1628191510-d9bf1f8b966c'), description: 'Bơ lạt Tường An – thương hiệu Việt Nam, mềm mịn, thơm ngậy dùng cho bánh, xào và phết bánh mì.',                                  quantity: '1 Hộp',      weight: '200g',   stock: 50 }),
  mkProd({ name: 'Kem Tươi Whipping Cream Anchor 250ml',     slug: 'kem-tuoi-whipping-anchor',        price: '65.000đ', priceNumber: 65000,  category: 'Dairy', categoryVi: 'Bơ & kem',      image: uns('1628191510-d9bf1f8b966c'), description: 'Whipping cream Anchor 35% béo, đánh bông tốt, dùng trang trí bánh kem và làm sốt kem.',                                          quantity: '1 Hộp',      weight: '250ml',  stock: 35 }),
  mkProd({ name: 'Sữa Đặc Có Đường Ông Thọ 380g',           slug: 'sua-dac-ong-tho-380g',            price: '22.000đ', priceNumber: 22000,  category: 'Dairy', categoryVi: 'Sữa chế biến',  image: uns('1563636619-e9143da7973b'), description: 'Sữa đặc Ông Thọ – thương hiệu kinh điển của Vinamilk, ngọt béo đậm đà, pha cà phê, làm bánh hay ăn kèm bánh mì.',              quantity: '1 Lon',      weight: '380g',   stock: 85 }),
];

// ═══════════════════════════════════════════════════════════════════════════════
// ── BEVERAGES – Thức uống  ────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
const PRODUCTS_BEVERAGES = [
  // ---------- Nước trái cây ----------
  mkProd({ name: 'Nước Cam Ép Vfresh 1L',                    slug: 'nuoc-cam-ep-vfresh-1l',           price: '32.000đ', priceNumber: 32000,  category: 'Beverages', categoryVi: 'Nước trái cây', image: uns('1600271535-b5a69c7f5c2d'), description: 'Nước cam ép Vfresh (Vinamilk) 100% từ cam tự nhiên, không màu chất bảo quản, nhiều vitamin C.',                                    quantity: '1 Hộp',      weight: '1000ml', stock: 80 }),
  mkProd({ name: 'Nước Ép Táo Welchs 296ml',                 slug: 'nuoc-ep-tao-welchs',              price: '28.000đ', priceNumber: 28000,  category: 'Beverages', categoryVi: 'Nước trái cây', image: uns('1600271535-b5a69c7f5c2d'), description: 'Nước ép táo Welchs nguyên chất 100%, vị ngọt tự nhiên, nhập khẩu Mỹ, không thêm đường.',                                         quantity: '1 Chai',     weight: '296ml',  stock: 60 }),
  mkProd({ name: 'Trà Xanh Không Độ C2 500ml',               slug: 'tra-xanh-khong-do-c2',            price: '12.000đ', priceNumber: 12000,  category: 'Beverages', categoryVi: 'Trà & cà phê', image: uns('1544145945-f90425340c7e'), description: 'Trà xanh C2 hương chanh mát lạnh, ít calo, thương hiệu Tân Hiệp Phát Việt Nam, giải khát nhanh.',                                  quantity: '1 Chai',     weight: '500ml',  stock: 120 }),
  mkProd({ name: 'Cà Phê Sữa Đá Highlands 250ml',            slug: 'ca-phe-sua-da-highlands',         price: '22.000đ', priceNumber: 22000,  category: 'Beverages', categoryVi: 'Trà & cà phê', image: uns('1509042023-f6fc48d40a2e'), description: 'Cà phê sữa đá Highlands Coffee đóng chai, hương thơm đặc trưng cà phê Việt, tiện uống mọi lúc mọi nơi.',                      quantity: '1 Chai',     weight: '250ml',  stock: 90 }),
  // ---------- Nước khoáng / có ga ----------
  mkProd({ name: 'Nước Khoáng Lavie 500ml x24',              slug: 'nuoc-khoang-lavie-500ml-24',      price: '92.000đ', priceNumber: 92000,  category: 'Beverages', categoryVi: 'Nước khoáng',  image: uns('1548438294-ee8a8eb34816'), description: 'Nước khoáng thiên nhiên LaVie nguồn gốc Đak Long – Lâm Đồng, đóng thùng 24 chai tiết kiệm.',                                     quantity: '24 Chai',    weight: '12000ml',stock: 50 }),
  mkProd({ name: 'Nước Suối Aquafina 500ml x24',             slug: 'nuoc-suoi-aquafina-500ml-24',     price: '80.000đ', priceNumber: 80000,  category: 'Beverages', categoryVi: 'Nước khoáng',  image: uns('1548438294-ee8a8eb34816'), description: 'Nước tinh khiết Aquafina lọc 7 giai đoạn, vị thanh khiết, thùng 24 chai tiện lợi cho gia đình.',                                  quantity: '24 Chai',    weight: '12000ml',stock: 55 }),
  mkProd({ name: 'Bia Saigon Special 330ml x24',             slug: 'bia-saigon-special-24',           price: '285.000đ',priceNumber: 285000, category: 'Beverages', categoryVi: 'Bia & rượu',   image: uns('1535958327-64a2d5bb8b73'), description: 'Bia Saigon Special – thương hiệu bia Việt Nam nổi tiếng nhất, vị đậm đà sảng khoái, thùng 24 lon.',                               quantity: '24 Lon',     weight: '7920ml', stock: 40 }),
  mkProd({ name: 'Bia Tiger Bạc 330ml x24',                  slug: 'bia-tiger-bac-24',                price: '295.000đ',priceNumber: 295000, category: 'Beverages', categoryVi: 'Bia & rượu',   image: uns('1535958327-64a2d5bb8b73'), description: 'Bia Tiger bạc sản xuất tại Việt Nam, vị nhẹ mát dịu, phù hợp mọi bữa tiệc.',                                                      quantity: '24 Lon',     weight: '7920ml', stock: 35 }),
  // ---------- Nước ngọt / sữa đậu ----------
  mkProd({ name: 'Sữa Đậu Nành Fami Nguyên Chất 200ml x10', slug: 'sua-dau-nanh-fami-nguyen-chat',   price: '42.000đ', priceNumber: 42000,  category: 'Beverages', categoryVi: 'Sữa hạt',      image: uns('1563636619-e9143da7973b'), description: 'Sữa đậu nành Fami nguyên chất – thương hiệu VN Vinasoy, giàu protein thực vật, không đường thêm.',                               quantity: '10 Hộp',     weight: '2000ml', stock: 70 }),
  mkProd({ name: 'Sữa Hạnh Nhân Nestlé Almond 180ml x12',   slug: 'sua-hanh-nhan-nestle-almond',     price: '115.000đ',priceNumber: 115000, category: 'Beverages', categoryVi: 'Sữa hạt',      image: uns('1563636619-e9143da7973b'), description: 'Sữa hạnh nhân Nestlé ít calo, không lactose, hương vị thơm dịu, phù hợp người ăn chay.',                                         quantity: '12 Hộp',     weight: '2160ml', stock: 45 }),
  mkProd({ name: 'Nước Tăng Lực Sting Dâu 330ml',           slug: 'nuoc-tang-luc-sting-dau',         price: '10.000đ', priceNumber: 10000,  category: 'Beverages', categoryVi: 'Nước tăng lực',image: uns('1535958327-64a2d5bb8b73'), description: 'Nước tăng lực Sting dâu đỏ – hương vị quen thuộc, bổ sung vitamin B6, B12 giúp tỉnh táo tức thì.',                            quantity: '1 Lon',      weight: '330ml',  stock: 100 }),
  mkProd({ name: 'Trà Kombucha Yuzu Lên Men 480ml',          slug: 'tra-kombucha-yuzu-gts',           price: '65.000đ', priceNumber: 65000,  category: 'Beverages', categoryVi: 'Trà & cà phê', image: uns('1544145945-f90425340c7e'), description: 'Trà kombucha hữu cơ vị yuzu, lên men tự nhiên, giàu probiotic và enzyme có lợi cho tiêu hóa.',                                   quantity: '1 Chai',     weight: '480ml',  stock: 30 }),
];

// ═══════════════════════════════════════════════════════════════════════════════
// ── BAKERY – Bánh & Đồ ăn vặt  ───────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
const PRODUCTS_BAKERY = [
  // ---------- Bánh mì / bơ ----------
  mkProd({ name: 'Bánh Mì Sandwich ABC Loại Dày',            slug: 'banh-mi-sandwich-abc',            price: '28.000đ', priceNumber: 28000,  category: 'Bakery', categoryVi: 'Bánh mì',       image: uns('1509440159596-0280db3ae2d1'), description: 'Bánh mì sandwich ABC Kinh Đô dày mềm, vỏ nâu vàng, lát to phù hợp làm toast sáng và sandwich.',                                   quantity: '1 Túi',      weight: '450g',   stock: 60 }),
  mkProd({ name: 'Bánh Mì Hoa Cúc Brioche Pháp',            slug: 'banh-mi-brioche-phap',            price: '45.000đ', priceNumber: 45000,  category: 'Bakery', categoryVi: 'Bánh mì',       image: uns('1509440159596-0280db3ae2d1'), description: 'Bánh mì hoa cúc brioche mềm bơ thơm, nhập khẩu Pháp, dùng kẹp chả lụa, trứng hay ăn không đều ngon.',                           quantity: '6 Cái',      weight: '300g',   stock: 45 }),
  // ---------- Bánh snack Việt Nam ----------
  mkProd({ name: 'Bánh Custas Kem Trứng Kinh Đô 6 Cái',     slug: 'banh-custas-kem-trung-kinh-do',   price: '22.000đ', priceNumber: 22000,  category: 'Bakery', categoryVi: 'Bánh ngọt',     image: uns('1499636136210-6f4ee915583e'), description: 'Bánh custas kem trứng Kinh Đô – thương hiệu bánh kẹo hàng đầu Việt Nam, vỏ xốp thơm nhân kem béo.',                              quantity: '6 Cái',      weight: '132g',   stock: 90 }),
  mkProd({ name: 'Bánh Chocopie Orion 6 Cái',                slug: 'banh-chocopie-orion-6',           price: '32.000đ', priceNumber: 32000,  category: 'Bakery', categoryVi: 'Bánh ngọt',     image: uns('1499636136210-6f4ee915583e'), description: 'Bánh Chocopie Orion sản xuất tại Việt Nam, lớp socola bao ngoài, nhân marshmallow mềm ngọt.',                                      quantity: '6 Cái',      weight: '168g',   stock: 85 }),
  mkProd({ name: 'Bánh Gạo Việt San San Rong Biển 150g',     slug: 'banh-gao-viet-rong-bien-150g',   price: '18.000đ', priceNumber: 18000,  category: 'Bakery', categoryVi: 'Bánh ngọt',     image: uns('1499636136210-6f4ee915583e'), description: 'Bánh gạo vị rong biển giòn tan, ít calo, phù hợp ăn vặt lành mạnh, dành cho trẻ em và người lớn.',                               quantity: '1 Túi',      weight: '150g',   stock: 100 }),
  mkProd({ name: 'Bánh Quy Cosy Bơ Sữa 378g',               slug: 'banh-quy-cosy-bo-sua',            price: '38.000đ', priceNumber: 38000,  category: 'Bakery', categoryVi: 'Bánh ngọt',     image: uns('1499636136210-6f4ee915583e'), description: 'Bánh quy bơ sữa Cosy – thương hiệu Kinh Đô, giòn thơm, đóng gói bảo quản tốt, phù hợp tiếp khách.',                              quantity: '1 Hộp',      weight: '378g',   stock: 70 }),
  // ---------- Kẹo / chocolate ----------
  mkProd({ name: 'Kẹo Dừa Bến Tre Thanh Hương Nguyên Chất', slug: 'keo-dua-ben-tre-thanh-huong',     price: '25.000đ', priceNumber: 25000,  category: 'Bakery', categoryVi: 'Kẹo & mứt',     image: uns('1556909211-54d3640fcb8b'), description: 'Kẹo dừa Bến Tre – đặc sản Việt Nam, làm từ dừa tươi nguyên chất, dai ngọt thơm béo.',                                              quantity: '200g',       weight: '200g',   stock: 75 }),
  mkProd({ name: 'Mứt Gừng Dẻo Handmade 200g',              slug: 'mut-gung-deo-handmade',           price: '35.000đ', priceNumber: 35000,  category: 'Bakery', categoryVi: 'Kẹo & mứt',     image: uns('1556909211-54d3640fcb8b'), description: 'Mứt gừng dẻo handmade vị cay ngọt đặc trưng, không phẩm màu, phù hợp ngày Tết và tiêu hóa.',                                     quantity: '200g',       weight: '200g',   stock: 50 }),
  mkProd({ name: 'Chocolate Đen 70% Marou Bến Tre 80g',      slug: 'chocolate-den-marou-ben-tre',     price: '85.000đ', priceNumber: 85000,  category: 'Bakery', categoryVi: 'Kẹo & mứt',     image: uns('1548907593-d9e6d5a0'), description: 'Chocolate Marou – thương hiệu chocolate bean-to-bar Việt Nam, cacao Bến Tre 70%, đắng sâu thanh thoát.',                          quantity: '1 Thanh',    weight: '80g',    stock: 40 }),
  // ---------- Chips / snack mặn ----------
  mkProd({ name: 'Bim Bim Tôm Oishi 40g',                    slug: 'bim-bim-tom-oishi-40g',           price: '8.000đ',  priceNumber: 8000,   category: 'Bakery', categoryVi: 'Snack & chips',  image: uns('1621939457-ef843da1fb1d'), description: 'Bim bim tôm Oishi giòn xốp, hương tôm đặc trưng, snack phổ biến nhất Việt Nam cho mọi lứa tuổi.',                                  quantity: '1 Gói',      weight: '40g',    stock: 150 }),
  mkProd({ name: 'Bánh Phồng Tôm Sa Giang 200g',             slug: 'banh-phong-tom-sa-giang',         price: '22.000đ', priceNumber: 22000,  category: 'Bakery', categoryVi: 'Snack & chips',  image: uns('1621939457-ef843da1fb1d'), description: 'Bánh phồng tôm Sa Giang – đặc sản Đồng Tháp, chiên phồng to giòn vàng, hương tôm ngọt tự nhiên.',                                 quantity: '1 Gói',      weight: '200g',   stock: 80 }),
  mkProd({ name: 'Hạt Điều Rang Muối Long An 200g',          slug: 'hat-dieu-rang-muoi-long-an',      price: '55.000đ', priceNumber: 55000,  category: 'Bakery', categoryVi: 'Snack & chips',  image: uns('1621939457-ef843da1fb1d'), description: 'Hạt điều rang muối Long An – đặc sản Việt Nam, hạt to đều thơm bùi, giàu chất béo lành mạnh.',                                    quantity: '200g',       weight: '200g',   stock: 55 }),
];

// ═══════════════════════════════════════════════════════════════════════════════
// ── PANTRY – Gia vị & Thực phẩm khô  ─────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
const PRODUCTS_PANTRY = [
  // ---------- Gia vị chế biến ----------
  mkProd({ name: 'Nước Mắm Phú Quốc Khải Hoàn 500ml',       slug: 'nuoc-mam-phu-quoc-khai-hoan',     price: '52.000đ', priceNumber: 52000,  category: 'Pantry', categoryVi: 'Gia vị',        image: uns('1532336414038-cf19250c5757'), description: 'Nước mắm truyền thống Phú Quốc 40 độ đạm, ủ thùng gỗ 12 tháng, vị đậm ngọt tự nhiên.',                                          quantity: '1 Chai',     weight: '500ml',  stock: 70 }),
  mkProd({ name: 'Nước Tương Maggi Đậm Đặc 700ml',           slug: 'nuoc-tuong-maggi-dam-dac',        price: '28.000đ', priceNumber: 28000,  category: 'Pantry', categoryVi: 'Gia vị',        image: uns('1532336414038-cf19250c5757'), description: 'Nước tương đen Maggi đậm đặc, sản xuất tại Việt Nam, ướp thịt, nấu kho hay chấm trực tiếp.',                                    quantity: '1 Chai',     weight: '700ml',  stock: 80 }),
  mkProd({ name: 'Hạt Nêm Knorr Thịt Thăn Xương Ống 400g',  slug: 'hat-nem-knorr-400g',              price: '42.000đ', priceNumber: 42000,  category: 'Pantry', categoryVi: 'Gia vị',        image: uns('1532336414038-cf19250c5757'), description: 'Hạt nêm Knorr từ thịt thăn và xương ống bò, vị ngọt tự nhiên, nêm canh, xào, kho đều đậm đà.',                                   quantity: '1 Gói',      weight: '400g',   stock: 90 }),
  mkProd({ name: 'Nước Mắm Nam Ngư Đặc Biệt 650ml',         slug: 'nuoc-mam-nam-ngu-650ml',          price: '25.000đ', priceNumber: 25000,  category: 'Pantry', categoryVi: 'Gia vị',        image: uns('1532336414038-cf19250c5757'), description: 'Nước mắm Nam Ngư phổ biến nhất Việt Nam, vị vừa, dễ pha chế nước chấm bún, phở hay chả.',                                        quantity: '1 Chai',     weight: '650ml',  stock: 100 }),
  mkProd({ name: 'Dầu Ăn Neptune 2L',                        slug: 'dau-an-neptune-2l',               price: '78.000đ', priceNumber: 78000,  category: 'Pantry', categoryVi: 'Dầu ăn',        image: uns('1532336414038-cf19250c5757'), description: 'Dầu thực vật Neptune giàu omega-6, bền nhiệt cao, phù hợp chiên, xào mọi loại thức ăn.',                                          quantity: '1 Chai',     weight: '2000ml', stock: 60 }),
  mkProd({ name: 'Dầu Oliu Extra Virgin Bertolli 500ml',     slug: 'dau-oliu-bertolli-500ml',         price: '195.000đ',priceNumber: 195000, category: 'Pantry', categoryVi: 'Dầu ăn',        image: uns('1532336414038-cf19250c5757'), description: 'Dầu oliu extra virgin Bertolli Ý ép lạnh, giàu chất béo tốt, dùng trộn salad, sốt pasta.',                                         quantity: '1 Chai',     weight: '500ml',  stock: 35 }),
  // ---------- Thực phẩm khô ----------
  mkProd({ name: 'Gạo ST25 Cần Thơ 5Kg Túi Hút Chân Không',slug: 'gao-st25-can-tho-5kg',             price: '145.000đ',priceNumber: 145000, category: 'Pantry', categoryVi: 'Gạo & ngũ cốc', image: uns('1606208-0c0b8c5d5e2d'), description: 'Gạo ST25 Cần Thơ – gạo ngon nhất thế giới 2019, hạt dài thơm mềm dẻo, cơm ngon từng bữa.',                                       quantity: '5 Kg',       weight: '5000g',  stock: 50 }),
  mkProd({ name: 'Bún Khô Bích Chi 400g',                    slug: 'bun-kho-bich-chi-400g',           price: '18.000đ', priceNumber: 18000,  category: 'Pantry', categoryVi: 'Mì, bún, miến', image: uns('1551248429-3197e4ef4020'), description: 'Bún khô Bích Chi – thương hiệu VN, sợi trắng mềm mướt sau khi nấu, làm bún bò Huế, bún riêu.',                                  quantity: '1 Gói',      weight: '400g',   stock: 85 }),
  mkProd({ name: 'Mì Hảo Hảo Tôm Chua Cay Gói 75g',         slug: 'mi-hao-hao-tom-chua-cay',         price: '5.000đ',  priceNumber: 5000,   category: 'Pantry', categoryVi: 'Mì, bún, miến', image: uns('1551248429-3197e4ef4020'), description: 'Mì Hảo Hảo – mì gói số 1 Việt Nam, hương tôm chua cay đặc trưng, tiện nhanh cho bữa ăn bận rộn.',                              quantity: '1 Gói',      weight: '75g',    stock: 200 }),
  mkProd({ name: 'Tương Ớt Chinsu 520g',                     slug: 'tuong-ot-chinsu-520g',            price: '28.000đ', priceNumber: 28000,  category: 'Pantry', categoryVi: 'Gia vị',        image: uns('1532336414038-cf19250c5757'), description: 'Tương ớt Chinsu – thương hiệu Masan Việt Nam, cay vừa thơm ngọt, chấm bánh tráng, khoai tây chiên hay pha gia vị.', quantity: '1 Chai',     weight: '520g',   stock: 95 }),
  mkProd({ name: 'Muối Tôm Tây Ninh 100g',                   slug: 'muoi-tom-tay-ninh-100g',          price: '15.000đ', priceNumber: 15000,  category: 'Pantry', categoryVi: 'Gia vị',        image: uns('1532336414038-cf19250c5757'), description: 'Muối tôm Tây Ninh đặc sản, màu đỏ đẹp, vị mặn ngọt cay đặc trưng, chấm trái cây chua hay xoài xanh.',                              quantity: '1 Túi',      weight: '100g',   stock: 80 }),
];

// ═══════════════════════════════════════════════════════════════════════════════
// ── PERSONAL – Chăm sóc cá nhân  ─────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
const PRODUCTS_PERSONAL = [
  // ---------- Sữa tắm ----------
  mkProd({ name: 'Sữa Tắm Dưỡng Thể Lifebuoy Sạch Khuẩn 850g', slug: 'sua-tam-lifebuoy-sach-khuan',  price: '88.000đ', priceNumber: 88000,  category: 'Personal', categoryVi: 'Tắm gội',      image: uns('1608248543803-ba4f8c70ae0b'), description: 'Sữa tắm Lifebuoy kháng khuẩn 99.9%, hương thơm tươi mát, sản xuất tại Việt Nam, da sạch mịn.',                                    quantity: '1 Chai',     weight: '850g',   stock: 60 }),
  mkProd({ name: 'Sữa Tắm Romano Classic 380g',                  slug: 'sua-tam-romano-classic',       price: '52.000đ', priceNumber: 52000,  category: 'Personal', categoryVi: 'Tắm gội',      image: uns('1608248543803-ba4f8c70ae0b'), description: 'Sữa tắm Romano hương gỗ lịch lãm – thương hiệu quen thuộc của người Việt, da sạch tươi mát.',                                      quantity: '1 Chai',     weight: '380g',   stock: 70 }),
  mkProd({ name: 'Dầu Gội Clear Men Cool Sport 650g',             slug: 'dau-goi-clear-men-cool-sport', price: '95.000đ', priceNumber: 95000,  category: 'Personal', categoryVi: 'Tắm gội',      image: uns('1608248543803-ba4f8c70ae0b'), description: 'Dầu gội Clear Men ngăn gàu 100%, hương bạc hà mát lạnh, sạch dầu suốt 24h, sản xuất VN.',                                         quantity: '1 Chai',     weight: '650g',   stock: 55 }),
  mkProd({ name: 'Dầu Xả Rejoice Siêu Mềm Mượt 320g',           slug: 'dau-xa-rejoice-sieu-mem-muot', price: '65.000đ', priceNumber: 65000,  category: 'Personal', categoryVi: 'Tắm gội',      image: uns('1608248543803-ba4f8c70ae0b'), description: 'Dầu xả Rejoice mềm mượt tức thì, giảm gãy rụng tóc, hương thơm tươi mát dịu nhẹ.',                                                quantity: '1 Chai',     weight: '320g',   stock: 50 }),
  // ---------- Chăm sóc miệng ----------
  mkProd({ name: 'Kem Đánh Răng P/S Muối Trắng Sáng 230g',       slug: 'kem-danh-rang-ps-muoi',        price: '38.000đ', priceNumber: 38000,  category: 'Personal', categoryVi: 'Vệ sinh răng', image: uns('1608248543803-ba4f8c70ae0b'), description: 'Kem đánh răng P/S muối – thương hiệu Việt Nam, muối biển kết hợp fluor bảo vệ men răng, hơi thở thơm mát.',                        quantity: '1 Hộp',      weight: '230g',   stock: 80 }),
  mkProd({ name: 'Nước Súc Miệng Listerine Mát Lạnh 750ml',      slug: 'nuoc-suc-mieng-listerine',     price: '85.000đ', priceNumber: 85000,  category: 'Personal', categoryVi: 'Vệ sinh răng', image: uns('1608248543803-ba4f8c70ae0b'), description: 'Nước súc miệng Listerine Cool Mint diệt 99.9% vi khuẩn, hơi thở thơm mát 12 tiếng.',                                                quantity: '1 Chai',     weight: '750ml',  stock: 45 }),
  // ---------- Giấy / khăn ----------
  mkProd({ name: 'Giấy Vệ Sinh Bless You 10 Cuộn 3 Lớp',         slug: 'giay-ve-sinh-bless-you-10',    price: '68.000đ', priceNumber: 68000,  category: 'Personal', categoryVi: 'Giấy & khăn',  image: uns('1584622264-7a920b3d73e3'), description: 'Giấy vệ sinh Bless You 3 lớp mềm mịn, không hoá chất tẩy trắng, an toàn cho da nhạy cảm.',                                        quantity: '10 Cuộn',    weight: '900g',   stock: 70 }),
  mkProd({ name: 'Khăn Giấy Pulppy Facial 100 Tờ x 3 Hộp',       slug: 'khan-giay-pulppy-facial',      price: '42.000đ', priceNumber: 42000,  category: 'Personal', categoryVi: 'Giấy & khăn',  image: uns('1584622264-7a920b3d73e3'), description: 'Khăn giấy rút Pulppy mềm mịn, không xơ vải, phù hợp lau mặt, chùi miệng hay dọn bếp.',                                            quantity: '3 Hộp',      weight: '300g',   stock: 85 }),
  // ---------- Chống muỗi / dã ngoại ----------
  mkProd({ name: 'Kem Chống Nắng Sunplay Skin Aqua SPF50+ 30g',  slug: 'kem-chong-nang-sunplay-30g',  price: '72.000đ', priceNumber: 72000,  category: 'Personal', categoryVi: 'Dưỡng da',     image: uns('1608248543803-ba4f8c70ae0b'), description: 'Kem chống nắng Sunplay Skin Aqua SPF50+ không nhờn rít, thấm nhanh, bảo vệ da suốt 4 tiếng.',                                     quantity: '1 Tuýp',     weight: '30g',    stock: 50 }),
  mkProd({ name: 'Xịt Chống Muỗi Raid 200ml',                    slug: 'xit-chong-muoi-raid-200ml',   price: '45.000đ', priceNumber: 45000,  category: 'Personal', categoryVi: 'Chăm sóc khác', image: uns('1608248543803-ba4f8c70ae0b'), description: 'Xịt chống muỗi Raid hiệu quả nhanh, mùi nhẹ, an toàn cho trẻ em trên 2 tuổi, tác dụng đến 8 tiếng.',                              quantity: '1 Chai',     weight: '200ml',  stock: 55 }),
  mkProd({ name: 'Bông Tẩy Trang Shiseido 165 Miếng',            slug: 'bong-tay-trang-shiseido-165', price: '95.000đ', priceNumber: 95000,  category: 'Personal', categoryVi: 'Dưỡng da',     image: uns('1608248543803-ba4f8c70ae0b'), description: 'Bông tẩy trang Shiseido siêu mịn 4 cạnh, không xơ vải, tẩy trang sạch sâu không đau da.',                                          quantity: '1 Gói',      weight: '165g',   stock: 40 }),
];

// ═══════════════════════════════════════════════════════════════════════════════
// ── HOUSEHOLD – Nhà cửa & Đời sống  ──────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
const PRODUCTS_HOUSEHOLD = [
  // ---------- Tẩy rửa ----------
  mkProd({ name: 'Nước Rửa Bát Sunlight Trà Xanh 750g',          slug: 'nuoc-rua-bat-sunlight-750g',  price: '32.000đ', priceNumber: 32000,  category: 'Household', categoryVi: 'Tẩy rửa',     image: uns('1556911220-e15b29be8c8f'), description: 'Nước rửa bát Sunlight trà xanh loại trừ 100% vi khuẩn, không gây khô da, sản xuất VN.',                                           quantity: '1 Chai',     weight: '750g',   stock: 80 }),
  mkProd({ name: 'Bột Giặt OMO Matic Cửa Trước 4.5Kg',           slug: 'bot-giat-omo-matic-45kg',     price: '265.000đ',priceNumber: 265000, category: 'Household', categoryVi: 'Giặt giũ',    image: uns('1556911220-e15b29be8c8f'), description: 'Bột giặt OMO Matic công thức tiên tiến cho máy giặt cửa trước, sạch vết bẩn cứng đầu, thơm lâu.',                                  quantity: '1 Túi',      weight: '4500g',  stock: 35 }),
  mkProd({ name: 'Nước Xả Vải Comfort Ngàn Hoa 3.2L',            slug: 'nuoc-xa-vai-comfort-32l',     price: '125.000đ',priceNumber: 125000, category: 'Household', categoryVi: 'Giặt giũ',    image: uns('1556911220-e15b29be8c8f'), description: 'Nước xả Comfort ngàn hoa hương thơm lưu lâu 24 giờ, mềm vải, chống tĩnh điện.',                                                   quantity: '1 Can',      weight: '3200ml', stock: 45 }),
  mkProd({ name: 'Nước Tẩy Bồn Cầu Vim Aqua Plus 900ml',         slug: 'nuoc-tay-bon-cau-vim-900ml',  price: '35.000đ', priceNumber: 35000,  category: 'Household', categoryVi: 'Tẩy rửa',     image: uns('1556911220-e15b29be8c8f'), description: 'Nước tẩy bồn cầu Vim diệt khuẩn 99.9%, loại cặn vôi và vi khuẩn gây mùi hiệu quả.',                                                quantity: '1 Chai',     weight: '900ml',  stock: 55 }),
  mkProd({ name: 'Nước Lau Sàn Gift Hương Lavender 1.8L',         slug: 'nuoc-lau-san-gift-lavender',  price: '55.000đ', priceNumber: 55000,  category: 'Household', categoryVi: 'Tẩy rửa',     image: uns('1556911220-e15b29be8c8f'), description: 'Nước lau sàn Gift khử mùi kháng khuẩn hương lavender nhẹ nhàng, an toàn cho trẻ nhỏ và thú cưng.',                                  quantity: '1 Chai',     weight: '1800ml', stock: 60 }),
  // ---------- Bếp / tiêu dùng ----------
  mkProd({ name: 'Túi Zip Bảo Quản Thực Phẩm Ziploc 20 Túi',    slug: 'tui-zip-ziploc-20-tui',       price: '42.000đ', priceNumber: 42000,  category: 'Household', categoryVi: 'Bếp & bảo quản',image: uns('1556911220-e15b29be8c8f'), description: 'Túi zip Ziploc khoá chặt, ngăn mùi và ẩm, bảo quản thực phẩm tươi lâu hơn trong tủ lạnh.',                                    quantity: '20 Túi',     weight: '200g',   stock: 70 }),
  mkProd({ name: 'Màng Bọc Thực Phẩm Glad 30m',                  slug: 'mang-boc-thuc-pham-glad-30m', price: '38.000đ', priceNumber: 38000,  category: 'Household', categoryVi: 'Bếp & bảo quản',image: uns('1556911220-e15b29be8c8f'), description: 'Màng bọc thực phẩm Glad trong suốt, bám dính tốt, an toàn thực phẩm, dùng cho lò vi sóng.',                                     quantity: '1 Cuộn',     weight: '150g',   stock: 65 }),
  mkProd({ name: 'Nước Rửa Tay Bọt Lifebuoy Chai Bơm 500ml',    slug: 'nuoc-rua-tay-lifebuoy-500ml', price: '52.000đ', priceNumber: 52000,  category: 'Household', categoryVi: 'Tẩy rửa',     image: uns('1556911220-e15b29be8c8f'), description: 'Nước rửa tay bọt Lifebuoy diệt khuẩn, bọt mịn phủ đều lòng bàn tay, hương tươi mát dịu nhẹ.',                                    quantity: '1 Chai',     weight: '500ml',  stock: 75 }),
  mkProd({ name: 'Giấy Bếp Scott Drap 4 Cuộn',                   slug: 'giay-bep-scott-drap-4-cuon',  price: '48.000đ', priceNumber: 48000,  category: 'Household', categoryVi: 'Bếp & bảo quản',image: uns('1584622264-7a920b3d73e3'), description: 'Giấy bếp Scott Drap 2 lớp thấm hút tốt, không xơ vải, thấm dầu mỡ và nước hiệu quả.',                                          quantity: '4 Cuộn',     weight: '400g',   stock: 60 }),
  mkProd({ name: 'Nhang Muỗi Raid Max 10 Khoanh',                 slug: 'nhang-muoi-raid-max-10',      price: '28.000đ', priceNumber: 28000,  category: 'Household', categoryVi: 'Khác',         image: uns('1556911220-e15b29be8c8f'), description: 'Nhang muỗi Raid Max tác dụng 8 tiếng, khói nhẹ không gây kích ứng hô hấp, phù hợp dùng ngoài trời.',                               quantity: '10 Khoanh',  weight: '100g',   stock: 80 }),
  mkProd({ name: 'Túi Rác Tự Huỷ Eco Green 60L x20 Túi',         slug: 'tui-rac-tu-huy-eco-green',    price: '35.000đ', priceNumber: 35000,  category: 'Household', categoryVi: 'Khác',         image: uns('1556911220-e15b29be8c8f'), description: 'Túi rác tự hủy sinh học Eco Green, thân thiện môi trường, chịu tải 15kg, không rò rỉ.',                                            quantity: '20 Túi',     weight: '300g',   stock: 90 }),
];

const PRODUCTS = [
  ...PRODUCTS_VEGETABLES,
  ...PRODUCTS_FRUITS,
  ...PRODUCTS_MEAT,
  ...PRODUCTS_SEAFOOD,
  ...PRODUCTS_DAIRY,
  ...PRODUCTS_BEVERAGES,
  ...PRODUCTS_BAKERY,
  ...PRODUCTS_PANTRY,
  ...PRODUCTS_PERSONAL,
  ...PRODUCTS_HOUSEHOLD,
];

// ── Events ─────────────────────────────────────────────
const EVENTS = [
  { name: 'Xanh Lá Fresh Food Festival',       slug: 'xanh-la-fresh-food-festival',       date: 'Thứ 5, 22 thg 10', time: '14:01 – 16:01', location: 'Festival Center',          description: 'Trải nghiệm lễ hội thực phẩm tươi với nhà cung cấp địa phương, trình diễn nấu ăn và hoạt động tương tác cho mọi lứa tuổi.', image: wix('0d1a41_1190de4761734794b7c68a8600061756~mv2.jpg'), action: 'Mua vé',   capacity: 200 },
  { name: 'Fresh Ingredients Cooking Workshop', slug: 'fresh-ingredients-cooking-workshop', date: 'Thứ 5, 22 thg 10', time: '14:01 – 16:01', location: 'Xanh Lá Headquarters',    description: 'Tham gia workshop cùng chuyên gia để nấu ăn với nguyên liệu tươi, kết hợp mẹo dinh dưỡng và ý tưởng công thức sáng tạo.', image: wix('0d1a41_2ae592d0454a4199aa6c385bb17bd28b~mv2.jpg'), action: 'Trả lời', capacity: 30 },
  { name: 'Nutrition and Wellness Conference',  slug: 'nutrition-and-wellness-conference',  date: 'Thứ 5, 22 thg 10', time: '14:01 – 16:01', location: 'Healthy Living Institute', description: 'Khám phá vai trò của thực phẩm tươi với sức khỏe qua những buổi trò chuyện dinh dưỡng, hoạt động thực hành và tư vấn cá nhân.', image: wix('0d1a41_c05ecdabc2de426a94b70508e1fbb112~mv2.jpg'), action: 'Trả lời', capacity: 80 },
];

// ── Services ───────────────────────────────────────────
const SERVICES = [
  { name: 'Meal Prep Course',   slug: 'meal-prep-course',   subtitle: 'Master the art of meal prepping',    price: '1.200.000đ', priceNumber: 1200000, status: 'Đã kết thúc',      action: 'Xem khóa học', description: 'Học kỹ thuật chuẩn bị thực phẩm tươi cho cả tuần để tiết kiệm thời gian, tối ưu dưỡng chất và ăn uống lành mạnh hơn.' },
  { name: 'Nutrition Planning', slug: 'nutrition-planning', subtitle: 'Plan your meals for nutrition goals', price: '500.000đ',   priceNumber: 500000,  status: '',                  action: 'Đặt ngay',     description: 'Buổi tư vấn 1-1 với chuyên gia dinh dưỡng để xây dựng chế độ ăn cân bằng dựa trên mục tiêu thể trạng.' },
  { name: 'Cooking Class',      slug: 'cooking-class',      subtitle: 'Cook delicious meals from scratch',   price: '700.000đ',   priceNumber: 700000,  status: 'Đang tải ngày...', action: 'Đặt ngay',     description: 'Tham gia lớp học nấu ăn thực hành từ nguyên liệu tươi hữu cơ. Khám phá kỹ thuật chế biến giữ trọn vitamin.' },
];

// ── Vouchers ───────────────────────────────────────────
const VOUCHERS = [
  {
    code: 'XANHLA10',
    name: 'Giảm 10% cho đơn hàng đầu tiên',
    description: 'Giảm 10% tối đa 50.000đ cho đơn hàng trên 200.000đ',
    discountType: 'percentage',
    discountValue: 10,
    minOrderValue: 200000,
    maxDiscountValue: 50000,
    pointsRequired: 0,
    startDate: new Date('2025-01-01'),
    endDate: new Date('2025-12-31'),
    usageLimit: 1000,
    usedCount: 0,
    isActive: true,
  },
  {
    code: 'XANHLA50K',
    name: 'Giảm 50.000đ',
    description: 'Giảm trực tiếp 50.000đ cho đơn hàng trên 300.000đ',
    discountType: 'fixed',
    discountValue: 50000,
    minOrderValue: 300000,
    maxDiscountValue: null,
    pointsRequired: 100,
    startDate: new Date('2025-01-01'),
    endDate: new Date('2025-12-31'),
    usageLimit: 500,
    usedCount: 0,
    isActive: true,
  },
  {
    code: 'FRESH15',
    name: 'Giảm 15% cho rau củ tươi',
    description: 'Giảm 15% cho tất cả sản phẩm rau củ, không giới hạn giảm giá',
    discountType: 'percentage',
    discountValue: 15,
    minOrderValue: 100000,
    maxDiscountValue: null,
    pointsRequired: 50,
    startDate: new Date('2025-01-01'),
    endDate: new Date('2025-12-31'),
    usageLimit: 0,
    usedCount: 0,
    isActive: true,
    applicableCategories: ['Vegetables'],
  },
];

// ── Sample Orders ──────────────────────────────────────
const generateOrders = async (userId) => {
  const products = await Product.find({}).limit(20);
  const statuses = ['pending', 'confirmed', 'preparing', 'shipping', 'delivered', 'cancelled'];
  const shippingMethods = ['pickup', 'delivery'];
  const paymentMethods = ['cod', 'bank_transfer'];

  const orders = [];
  const now = new Date();

  // Generate 50 orders over the last 30 days
  for (let i = 0; i < 50; i++) {
    const numItems = Math.floor(Math.random() * 5) + 1;
    const selectedProducts = products.sort(() => 0.5 - Math.random()).slice(0, numItems);

    const items = selectedProducts.map(p => ({
      product: p._id,
      productName: p.name,
      productImage: p.image,
      productPrice: p.price,
      priceNumber: p.priceNumber,
      quantity: Math.floor(Math.random() * 3) + 1,
      selectedOption: p.options && p.options.length > 0 ? p.options[0].values[0] : null,
    }));

    const subtotal = items.reduce((sum, item) => sum + (item.priceNumber * item.quantity), 0);
    const discount = Math.random() > 0.7 ? Math.floor(Math.random() * 50000) : 0;
    const shippingFee = 20000;
    const total = subtotal - discount + shippingFee;

    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const orderDate = new Date(now - Math.random() * 30 * 24 * 60 * 60 * 1000);

    orders.push({
      orderCode: 'XL-' + String(i + 1).padStart(6, '0'),
      user: userId,
      items,
      subtotal,
      discount,
      voucherCode: discount > 0 ? 'XANHLA10' : null,
      shippingFee,
      total,
      shippingMethod: shippingMethods[Math.floor(Math.random() * shippingMethods.length)],
      shippingAddress: '123 Đường ABC, Quận 1, TP. Hồ Chí Minh',
      paymentMethod: paymentMethods[Math.floor(Math.random() * paymentMethods.length)],
      status,
      estimatedPoints: Math.floor(total / 1000),
      createdAt: orderDate,
      updatedAt: orderDate,
    });
  }

  // Ensure some delivered orders for revenue calculation
  for (let i = 0; i < 20; i++) {
    orders[i].status = 'delivered';
  }

  return orders;
};

// ── Seed function ──────────────────────────────────────
async function seed() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/xanh-la');
  console.log('✅ Connected to MongoDB');

  // Clear all collections
  await Promise.all([
    Category.deleteMany({}),
    Product.deleteMany({}),
    Event.deleteMany({}),
    Service.deleteMany({}),
    User.deleteMany({}),
    Voucher.deleteMany({}),
    Order.deleteMany({}),
  ]);
  console.log('🗑  Cleared existing data');

  // Seed categories
  await Category.insertMany(CATEGORIES);
  console.log(`✅ Seeded ${CATEGORIES.length} categories`);

  // Seed products by group
  await Product.insertMany(PRODUCTS_VEGETABLES);
  console.log(`✅ Vegetables: ${PRODUCTS_VEGETABLES.length} sản phẩm`);

  await Product.insertMany(PRODUCTS_FRUITS);
  console.log(`✅ Fruits: ${PRODUCTS_FRUITS.length} sản phẩm`);

  await Product.insertMany(PRODUCTS_MEAT);
  console.log(`✅ Meat: ${PRODUCTS_MEAT.length} sản phẩm`);

  await Product.insertMany(PRODUCTS_SEAFOOD);
  console.log(`✅ Seafood: ${PRODUCTS_SEAFOOD.length} sản phẩm`);

  await Product.insertMany(PRODUCTS_DAIRY);
  console.log(`✅ Dairy: ${PRODUCTS_DAIRY.length} sản phẩm`);

  await Product.insertMany(PRODUCTS_BEVERAGES);
  console.log(`✅ Beverages: ${PRODUCTS_BEVERAGES.length} sản phẩm`);

  await Product.insertMany(PRODUCTS_BAKERY);
  console.log(`✅ Bakery: ${PRODUCTS_BAKERY.length} sản phẩm`);

  await Product.insertMany(PRODUCTS_PANTRY);
  console.log(`✅ Pantry: ${PRODUCTS_PANTRY.length} sản phẩm`);

  await Product.insertMany(PRODUCTS_PERSONAL);
  console.log(`✅ Personal: ${PRODUCTS_PERSONAL.length} sản phẩm`);

  await Product.insertMany(PRODUCTS_HOUSEHOLD);
  console.log(`✅ Household: ${PRODUCTS_HOUSEHOLD.length} sản phẩm`);

  console.log(`📦 Tổng: ${PRODUCTS.length} sản phẩm`);

  // Seed events
  await Event.insertMany(EVENTS);
  console.log(`✅ Seeded ${EVENTS.length} events`);

  // Seed services
  await Service.insertMany(SERVICES);
  console.log(`✅ Seeded ${SERVICES.length} services`);

  // Seed vouchers
  await Voucher.insertMany(VOUCHERS);
  console.log(`✅ Seeded ${VOUCHERS.length} vouchers`);

  // Admin user — pre('save') hook tự hash password
  await User.create({
    name:     'Admin Xanh Lá',
    email:    'admin@xanhla.farm',
    password: 'admin123',
    role:     'admin',
  });
  console.log('✅ Created admin user  →  admin@xanhla.farm / admin123');

  // Demo customer user
  await User.create({
    name:     'Nguyễn Văn A',
    email:    'customer@example.com',
    password: 'customer123',
    phone:    '0987654321',
    role:     'customer',
    points:   150,
    tier:     'silver',
    totalSpent: 600000,
    addresses: [
      {
        label: 'Nhà riêng',
        fullName: 'Nguyễn Văn A',
        phone: '0987654321',
        address: '123 Đường ABC',
        city: 'Quận 1, TP. Hồ Chí Minh',
        isDefault: true,
      },
    ],
  });
  console.log('✅ Created demo customer  →  customer@example.com / customer123');

  // Seed orders
  const customer = await User.findOne({ email: 'customer@example.com' });
  if (customer) {
    const orders = await generateOrders(customer._id);
    await Order.insertMany(orders);
    console.log(`✅ Seeded ${orders.length} orders`);
  }

  await mongoose.disconnect();
  console.log('🎉 Seed complete!');
}

seed().catch((e) => { console.error(e); process.exit(1); });
