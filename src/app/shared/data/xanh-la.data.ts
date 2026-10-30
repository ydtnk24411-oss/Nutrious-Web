import {
  XanhLaCategory,
  XanhLaProduct,
  XanhLaMeal,
  XanhLaNutritionGoal,
  EventItem,
  ServiceItem,
  NavItem,
} from '../models/xanh-la.models';

const wixMedia = (asset: string) =>
  `https://static.wixstatic.com/media/${asset}`;
const uns = (id: string) =>
  `https://images.unsplash.com/photo-${id}?w=600&q=80`;

// ── Categories ────────────────────────────────────────
export const categories: XanhLaCategory[] = [
  { name: 'Rau củ',                 slug: '/category/vegetables', image: wixMedia('0d1a41_b6a77851ff264d8aae6380a742234d2d~mv2.jpg') },
  { name: 'Trái cây',               slug: '/category/fruits',     image: wixMedia('0d1a41_788df897f4c54cd0adaf4afa3d6aa776~mv2.jpg') },
  { name: 'Thịt',                   slug: '/category/meat',       image: wixMedia('0d1a41_2332e64cf86d42289c7ef555cfcd805e~mv2.jpg') },
  { name: 'Cá & Hải sản',           slug: '/category/seafood',    image: wixMedia('0d1a41_075fbe21f1464e70b72b4e06eb27c9c8~mv2.jpg') },
  { name: 'Sữa & Thực phẩm mát',    slug: '/category/dairy',      image: uns('1563636619-e9143da7973b') },
  { name: 'Thức uống',              slug: '/category/beverages',  image: uns('1544145945-f90425340c7e') },
  { name: 'Bánh & Đồ ăn vặt',       slug: '/category/bakery',     image: uns('1499636136210-6f4ee915583e') },
  { name: 'Gia vị & Thực phẩm khô', slug: '/category/pantry',     image: uns('1532336414038-cf19250c5757') },

  { name: 'Nhà cửa & Đời sống',     slug: '/category/household',  image: uns('1556911220-e15b29be8c8f') },
];

// ── Helpers ───────────────────────────────────────────
const base = (o: Partial<XanhLaProduct> & Pick<XanhLaProduct, 'id'|'name'|'slug'|'price'|'priceNumber'|'image'|'category'|'categoryVi'|'description'|'quantity'|'weight'>): XanhLaProduct => ({
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
  ...o,
});

// ═══════════════════════════════════════════════════════
// ── VEGETABLES (19 sản phẩm) ──────────────────────────
// ═══════════════════════════════════════════════════════
export const vegetableProducts: XanhLaProduct[] = [
  base({ id: 'rau-muong-tuoi',          name: 'Rau Muống Tươi',          slug: '/product-page/rau-muong-tuoi',          price: '8.000đ',  priceNumber: 8000,   category: 'Vegetables', categoryVi: 'Rau xanh',    image: uns('1540420773420-3366772f4999'), description: 'Rau muống tươi hái buổi sáng, thích hợp xào tỏi hoặc luộc, giàu sắt và vitamin C.',                       quantity: '1 Bó',   weight: '300g' }),
  base({ id: 'cai-thia-baby',            name: 'Cải Thìa Baby',           slug: '/product-page/cai-thia-baby',           price: '14.000đ', priceNumber: 14000,  category: 'Vegetables', categoryVi: 'Rau xanh',    image: uns('1587411768638-ec71f8e33b78'), description: 'Cải thìa baby non mềm, vị ngọt nhẹ, thích hợp xào, nấu canh hoặc làm salad.',                              quantity: '1 Gói',  weight: '250g', sizeGroup: 'Small', container: 'Clamshell' }),
  base({ id: 'rau-cai-ngot',             name: 'Rau Cải Ngọt',            slug: '/product-page/rau-cai-ngot',            price: '10.000đ', priceNumber: 10000,  category: 'Vegetables', categoryVi: 'Rau xanh',    image: uns('1576045057032-026b06c5b5d6'), description: 'Cải ngọt non giòn, vị ngọt dịu tự nhiên, thích hợp luộc, xào hoặc nấu canh.',                               quantity: '1 Bó',   weight: '300g' }),
  base({ id: 'rau-mong-toi',             name: 'Rau Mồng Tơi',            slug: '/product-page/rau-mong-toi',            price: '9.000đ',  priceNumber: 9000,   category: 'Vegetables', categoryVi: 'Rau xanh',    image: uns('1512621776951-a57141f001a6'), description: 'Mồng tơi tươi mát, giàu chất nhầy tốt cho tiêu hóa, xào tỏi hoặc nấu canh chua.',                         quantity: '1 Bó',   weight: '250g' }),
  base({ id: 'cai-xanh-da-lat',          name: 'Cải Xanh Đà Lạt',         slug: '/product-page/cai-xanh-da-lat',         price: '12.000đ', priceNumber: 12000,  category: 'Vegetables', categoryVi: 'Rau xanh',    image: uns('1584270354949-c26b0d5b1f62'), description: 'Cải xanh Đà Lạt lá to giòn, vị đắng nhẹ đặc trưng, trồng hữu cơ không thuốc trừ sâu.',                    quantity: '1 Gói',  weight: '350g' }),
  base({ id: 'ca-rot-baby-da-lat',       name: 'Cà Rốt Baby Đà Lạt',      slug: '/product-page/ca-rot-baby-da-lat',      price: '22.000đ', priceNumber: 22000,  category: 'Vegetables', categoryVi: 'Củ quả',      image: uns('1447175008436-a35e25417040'), description: 'Cà rốt baby Đà Lạt ngọt tự nhiên, giàu beta-caroten, ăn sống giòn hoặc hầm soup.',                          quantity: '500g',   weight: '500g' }),
  base({ id: 'khoai-lang-mat-vinh-long', name: 'Khoai Lang Mật Vĩnh Long', slug: '/product-page/khoai-lang-mat-vinh-long',price: '18.000đ', priceNumber: 18000,  category: 'Vegetables', categoryVi: 'Củ quả',      image: uns('1596123068616-a01f2f3a9b24'), description: 'Khoai lang mật Vĩnh Long ngọt bùi, ruột vàng cam, hấp, nướng hay làm bánh đều tuyệt.',                     quantity: '1 Kg',   weight: '1000g' }),
  base({ id: 'cu-cai-trang-tuoi',        name: 'Củ Cải Trắng Tươi',        slug: '/product-page/cu-cai-trang-tuoi',       price: '15.000đ', priceNumber: 15000,  category: 'Vegetables', categoryVi: 'Củ quả',      image: uns('1570586776745-8e2245a15b79'), description: 'Củ cải trắng giòn, vị cay nhẹ, hầm xương, muối chua hay xào đều ngon.',                                    quantity: '1 Kg',   weight: '1000g' }),
  base({ id: 'ngo-ngot-non-tay-ninh',    name: 'Ngô Ngọt Non Tây Ninh',    slug: '/product-page/ngo-ngot-non-tay-ninh',   price: '12.000đ', priceNumber: 12000,  category: 'Vegetables', categoryVi: 'Củ quả',      image: uns('1551754655-cd27e38d2076'),    description: 'Ngô non ngọt giòn Tây Ninh, giàu tinh bột và khoáng chất, hấp, nướng hoặc nấu canh.',                     quantity: '2 Trái', weight: '400g' }),
  base({ id: 'ca-chua-bi-da-lat',        name: 'Cà Chua Bi Đà Lạt',        slug: '/product-page/ca-chua-bi-da-lat',       price: '28.000đ', priceNumber: 28000,  category: 'Vegetables', categoryVi: 'Củ quả',      image: uns('1546793665-c807762997cc'),    description: 'Cà chua bi Đà Lạt ngọt đậm, nhiều nước, ăn sống salad hoặc làm sốt pasta thơm ngon.',                    quantity: '500g',   weight: '500g', container: 'Clamshell' }),
  base({ id: 'ot-chuong-3-mau',          name: 'Ớt Chuông 3 Màu',          slug: '/product-page/ot-chuong-3-mau',         price: '35.000đ', priceNumber: 35000,  category: 'Vegetables', categoryVi: 'Củ quả',      image: uns('1563565375-f3fdfdbefa83'),    description: 'Bộ ớt chuông đỏ-vàng-xanh giòn ngọt, giàu vitamin C, xào thập cẩm hay ăn sống đều đẹp.',                 quantity: '3 Trái', weight: '350g', sizeGroup: 'Large', container: 'Clamshell', cutType: 'Pre-chopped' }),
  base({ id: 'dau-bap-tuoi-mien-tay',    name: 'Đậu Bắp Tươi Miền Tây',    slug: '/product-page/dau-bap-tuoi-mien-tay',   price: '16.000đ', priceNumber: 16000,  category: 'Vegetables', categoryVi: 'Củ quả',      image: uns('1613840024249-62ae4577d8e8'), description: 'Đậu bắp tươi miền Tây giòn, giàu chất nhầy tốt cho tiêu hóa, luộc, xào hoặc hầm.',                        quantity: '400g',   weight: '400g' }),
  base({ id: 'nam-dong-co-da-lat',       name: 'Nấm Đông Cô Đà Lạt',       slug: '/product-page/nam-dong-co-da-lat',      price: '38.000đ', priceNumber: 38000,  category: 'Vegetables', categoryVi: 'Nấm',         image: uns('1586190848861-99aa4a171e90'), description: 'Nấm đông cô Đà Lạt tươi thơm đậm, giàu protein và khoáng chất, xào, hầm, nấu canh.',                       quantity: '200g',   weight: '200g', container: 'Clamshell' }),
  base({ id: 'nam-kim-cham-tuoi',        name: 'Nấm Kim Châm Tươi',         slug: '/product-page/nam-kim-cham-tuoi',       price: '18.000đ', priceNumber: 18000,  category: 'Vegetables', categoryVi: 'Nấm',         image: uns('1604577882580-8b3f898e81ae'), description: 'Nấm kim châm trắng mềm, thơm dịu, nhúng lẩu, xào bơ tỏi hoặc nấu canh đều ngon.',                         quantity: '200g',   weight: '200g', container: 'Clamshell' }),
  base({ id: 'nam-rom-tuoi',             name: 'Nấm Rơm Tươi',             slug: '/product-page/nam-rom-tuoi',            price: '25.000đ', priceNumber: 25000,  category: 'Vegetables', categoryVi: 'Nấm',         image: uns('1510009346899-029ce81afc6e'), description: 'Nấm rơm tươi hái sáng sớm, vị ngọt thơm đặc trưng, kho tương, xào hoặc nấu canh chua.',                   quantity: '300g',   weight: '300g' }),
  base({ id: 'toi-tuoi-ly-son',          name: 'Tỏi Tươi Lý Sơn',          slug: '/product-page/toi-tuoi-ly-son',         price: '32.000đ', priceNumber: 32000,  category: 'Vegetables', categoryVi: 'Gia vị tươi', image: uns('1615485500834-bc10199bc727'), description: 'Tỏi Lý Sơn nổi tiếng thơm nồng, củ nhỏ cánh mỏng, kháng khuẩn tự nhiên, gia vị số 1 ẩm thực Việt.',       quantity: '200g',   weight: '200g', sizeGroup: 'Small', cutType: 'Pre-chopped', cutting: 'Diced' }),
  base({ id: 'gung-tuoi-hung-yen',       name: 'Gừng Tươi Hưng Yên',        slug: '/product-page/gung-tuoi-hung-yen',      price: '20.000đ', priceNumber: 20000,  category: 'Vegetables', categoryVi: 'Gia vị tươi', image: uns('1615485500834-bc10199bc727'), description: 'Gừng tươi Hưng Yên cay nồng, giàu gingerol, làm ấm bụng, khử tanh và ướp thịt cá.',                       quantity: '300g',   weight: '300g' }),
  base({ id: 'sa-tuoi-ben-tre',          name: 'Sả Tươi Bến Tre',           slug: '/product-page/sa-tuoi-ben-tre',         price: '10.000đ', priceNumber: 10000,  category: 'Vegetables', categoryVi: 'Gia vị tươi', image: uns('1597690723046-4ba3c37a32ee'), description: 'Sả tươi Bến Tre thơm đặc trưng, nguyên liệu không thể thiếu trong gà lá chanh, bò lúc lắc, lẩu Thái.',    quantity: '1 Bó',   weight: '250g' }),
  base({ id: 'hanh-la-tuoi',             name: 'Hành Lá Tươi',              slug: '/product-page/hanh-la-tuoi',            price: '8.000đ',  priceNumber: 8000,   category: 'Vegetables', categoryVi: 'Gia vị tươi', image: uns('1558864669-3937ca9f9192'),    description: 'Hành lá xanh tươi, thơm nhẹ, rắc lên mọi món ăn Việt từ phở, bún, cháo đến canh.',                         quantity: '1 Bó',   weight: '150g', sizeGroup: 'Small' }),
];

// ═══════════════════════════════════════════════════════
// ── FRUITS (14 sản phẩm) ──────────────────────────────
// ═══════════════════════════════════════════════════════
export const fruitProducts: XanhLaProduct[] = [
  base({ id: 'xoai-cat-hoa-loc',          name: 'Xoài Cát Hòa Lộc',            slug: '/product-page/xoai-cat-hoa-loc',          price: '55.000đ', priceNumber: 55000,  category: 'Fruits', categoryVi: 'Đặc sản Việt', image: uns('1553279768-865429fa0078'),    description: 'Xoài cát Hòa Lộc thơm dịu, thịt vàng mịn không xơ, đặc sản nức tiếng miền Tây, ngọt ngất ngây.',   quantity: '2 Trái', weight: '700g',  sizeGroup: 'Large', options: [{ name: 'Độ chín', values: ['Chín vừa', 'Chín kỹ'] }] }),
  base({ id: 'thanh-long-ruot-do',         name: 'Thanh Long Ruột Đỏ Bình Thuận',slug: '/product-page/thanh-long-ruot-do',         price: '32.000đ', priceNumber: 32000,  category: 'Fruits', categoryVi: 'Đặc sản Việt', image: uns('1527325678964-54921661f888'),  description: 'Thanh long ruột đỏ Bình Thuận, ngọt vừa, giàu chất chống oxy hóa, đẹp mắt trong tráng miệng.',       quantity: '2 Trái', weight: '600g',  sizeGroup: 'Large' }),
  base({ id: 'cam-sanh-vinh-long',         name: 'Cam Sành Vĩnh Long',            slug: '/product-page/cam-sanh-vinh-long',         price: '35.000đ', priceNumber: 35000,  category: 'Fruits', categoryVi: 'Đặc sản Việt', image: uns('1547514701-42782101795e'),    description: 'Cam sành Vĩnh Long vỏ xanh múi đỏ, ngọt đậm và nhiều nước, đặc sản miền Tây Nam Bộ.',               quantity: '1 Kg',   weight: '1000g', options: [{ name: 'Kích cỡ', values: ['Nhỡ', 'To'] }] }),
  base({ id: 'dau-tay-da-lat',             name: 'Dâu Tây Đà Lạt',               slug: '/product-page/dau-tay-da-lat',             price: '42.000đ', priceNumber: 42000,  category: 'Fruits', categoryVi: 'Đặc sản Việt', image: uns('1464965911861-746a04b4bca6'),  description: 'Dâu tây Đà Lạt đỏ mọng, ngọt chua tự nhiên, hái buổi sáng đảm bảo độ tươi ngon nhất.',              quantity: '300g',   weight: '300g',  sizeGroup: 'Small', container: 'Clamshell', options: [{ name: 'Loại', values: ['Thường', 'Premium'] }] }),
  base({ id: 'buoi-da-xanh-ben-tre',       name: 'Bưởi Da Xanh Bến Tre',          slug: '/product-page/buoi-da-xanh-ben-tre',       price: '48.000đ', priceNumber: 48000,  category: 'Fruits', categoryVi: 'Đặc sản Việt', image: uns('1611080626919-7cf5a9dbab12'),  description: 'Bưởi da xanh Bến Tre múi hồng đỏ, ngọt thanh, ít hạt, giàu vitamin C.',                             quantity: '1 Trái', weight: '1200g', sizeGroup: 'Large' }),
  base({ id: 'nhan-long-hung-yen',         name: 'Nhãn Lồng Hưng Yên',            slug: '/product-page/nhan-long-hung-yen',         price: '38.000đ', priceNumber: 38000,  category: 'Fruits', categoryVi: 'Đặc sản Việt', image: uns('1519996409144-56c88c35ba26'),  description: 'Nhãn lồng Hưng Yên cùi dày, ngọt đậm, hạt nhỏ, hương thơm đặc trưng khó trộn lẫn.',                 quantity: '500g',   weight: '500g',  sizeGroup: 'Small', container: 'Clamshell' }),
  base({ id: 'dua-queen-da-lat',           name: 'Dứa Queen Đà Lạt',              slug: '/product-page/dua-queen-da-lat',           price: '28.000đ', priceNumber: 28000,  category: 'Fruits', categoryVi: 'Đặc sản Việt', image: uns('1550258987-190a2d41a8ba'),    description: 'Dứa Queen ngọt lịm, ít mắt, thơm đặc trưng vùng cao Đà Lạt, tươi giòn và nhiều nước.',              quantity: '1 Trái', weight: '900g',  sizeGroup: 'Large', cutType: 'Pre-chopped' }),
  base({ id: 'dua-hau-hoi-an',             name: 'Dưa Hấu Hội An',                slug: '/product-page/dua-hau-hoi-an',             price: '30.000đ', priceNumber: 30000,  category: 'Fruits', categoryVi: 'Đặc sản Việt', image: uns('1563114773-84221bd62daa'),    description: 'Dưa hấu Hội An ruột đỏ tươi, giòn ngọt mát, giải nhiệt tốt nhất mùa hè.',                           quantity: '1/4 Trái', weight: '1500g', sizeGroup: 'Large', cutType: 'Pre-chopped', cutting: 'Diced' }),
  base({ id: 'sau-rieng-ri6-cai-lay',      name: 'Sầu Riêng Ri6 Cai Lậy',         slug: '/product-page/sau-rieng-ri6-cai-lay',      price: '85.000đ', priceNumber: 85000,  category: 'Fruits', categoryVi: 'Đặc sản Việt', image: uns('1609780262-ac0fa2e47a08'),    description: 'Sầu riêng Ri6 Cai Lậy múi vàng kem béo ngậy, thơm lừng, không xơ, đặc sản số 1 miền Tây.',          quantity: '1 Kg',   weight: '1000g', sizeGroup: 'Large', options: [{ name: 'Loại', values: ['Nguyên hạt', 'Đã tách múi'] }] }),
  base({ id: 'vai-thieu-luc-ngan',         name: 'Vải Thiều Lục Ngạn',             slug: '/product-page/vai-thieu-luc-ngan',         price: '45.000đ', priceNumber: 45000,  category: 'Fruits', categoryVi: 'Đặc sản Việt', image: uns('1519996409144-56c88c35ba26'),  description: 'Vải thiều Lục Ngạn – Bắc Giang cùi giòn dày, ngọt thanh, đỏ mọng đặc sản mùa hè miền Bắc.',         quantity: '500g',   weight: '500g',  sizeGroup: 'Small', container: 'Clamshell' }),
  base({ id: 'mang-cut-binh-duong',        name: 'Măng Cụt Bình Dương',            slug: '/product-page/mang-cut-binh-duong',        price: '52.000đ', priceNumber: 52000,  category: 'Fruits', categoryVi: 'Đặc sản Việt', image: uns('1556909211-54d3640fcb8b'),    description: 'Măng cụt Bình Dương – "nữ hoàng trái cây", múi trắng ngọt chua thanh, vỏ tím sẫm dày.',              quantity: '500g',   weight: '500g',  sizeGroup: 'Small' }),
  base({ id: 'chom-chom-ben-tre',          name: 'Chôm Chôm Bến Tre',              slug: '/product-page/chom-chom-ben-tre',          price: '28.000đ', priceNumber: 28000,  category: 'Fruits', categoryVi: 'Đặc sản Việt', image: uns('1519996409144-56c88c35ba26'),  description: 'Chôm chôm Bến Tre lông đỏ, múi trắng giòn ngọt, thơm nhẹ, hái tươi từ vườn miền Tây.',              quantity: '500g',   weight: '500g',  sizeGroup: 'Small', container: 'Clamshell' }),
  base({ id: 'tao-fuji-nhat-ban',          name: 'Táo Fuji Nhật Bản',              slug: '/product-page/tao-fuji-nhat-ban',          price: '55.000đ', priceNumber: 55000,  category: 'Fruits', categoryVi: 'Nhập khẩu',    image: uns('1560806887-8d801c6168ea'),    description: 'Táo Fuji Nhật Bản giòn ngọt đậm, vỏ đỏ tươi, nhập khẩu chính ngạch, kiểm tra VSATTP.',             quantity: '4 Quả',  weight: '700g',  sizeGroup: 'Large', options: [{ name: 'Kích cỡ', values: ['Nhỡ', 'To'] }] }),
  base({ id: 'nho-den-khong-hat-my',       name: 'Nho Đen Không Hạt Mỹ',          slug: '/product-page/nho-den-khong-hat-my',       price: '65.000đ', priceNumber: 65000,  category: 'Fruits', categoryVi: 'Nhập khẩu',    image: uns('1474804540968-e7b5a1b38f79'),  description: 'Nho đen không hạt nhập khẩu từ Mỹ, cùi dày giòn ngọt, ăn trực tiếp hoặc dùng làm sinh tố.',        quantity: '500g',   weight: '500g',  container: 'Clamshell' }),
];

// ═══════════════════════════════════════════════════════
// ── MEAT (14 sản phẩm) ────────────────────────────────
// ═══════════════════════════════════════════════════════
export const meatProducts: XanhLaProduct[] = [
  base({ id: 'thit-ba-chi-heo-cp',        name: 'Thịt Ba Chỉ Heo CP',          slug: '/product-page/thit-ba-chi-heo-cp',        price: '92.000đ',  priceNumber: 92000,  category: 'Meat', categoryVi: 'Heo', image: uns('1558030006-450675393462'), description: 'Thịt ba chỉ heo CP tươi, tỷ lệ nạc mỡ cân đối 6:4, thích hợp kho tàu, quay hoặc luộc chấm mắm.',          quantity: '500g', weight: '500g', sizeGroup: 'Large', container: 'Clamshell', cutType: 'Pre-chopped', options: [{ name: 'Độ dày', values: ['Lát mỏng', 'Lát dày'] }] }),
  base({ id: 'thit-nac-vai-heo-sach',     name: 'Thịt Nạc Vai Heo Sạch',       slug: '/product-page/thit-nac-vai-heo-sach',     price: '80.000đ',  priceNumber: 80000,  category: 'Meat', categoryVi: 'Heo', image: uns('1607623814075-e51df1bdc82f'), description: 'Thịt nạc vai heo sạch – không kháng sinh, thịt hồng tươi, làm nhân bánh, xào hay nấu bún.',               quantity: '500g', weight: '500g', container: 'Clamshell', cutType: 'Pre-chopped', cutting: 'Diced' }),
  base({ id: 'suon-non-heo-tuoi',         name: 'Sườn Non Heo Tươi',            slug: '/product-page/suon-non-heo-tuoi',         price: '115.000đ', priceNumber: 115000, category: 'Meat', categoryVi: 'Heo', image: uns('1558030006-450675393462'), description: 'Sườn non heo tươi nhiều thịt, ít xương vụn, nướng BBQ, chiên giòn hay kho tiêu đều thơm ngon.',           quantity: '500g', weight: '500g', sizeGroup: 'Large', container: 'Clamshell', cutType: 'Pre-chopped' }),
  base({ id: 'gio-lua-huong-viet',        name: 'Giò Lụa Hương Việt 200g',      slug: '/product-page/gio-lua-huong-viet',        price: '48.000đ',  priceNumber: 48000,  category: 'Meat', categoryVi: 'Heo', image: uns('1567620905732-2d1ec7ab7445'), description: 'Giò lụa Hương Việt dai mịn, vị đậm thơm đặc trưng, làm từ thịt heo tươi không phụ gia độc hại.',          quantity: '200g', weight: '200g', sizeGroup: 'Small', container: 'Clamshell', cutType: 'Pre-chopped', cutting: 'Sliced' }),
  base({ id: 'xuc-xich-duc-viet-heo',     name: 'Xúc Xích Đức Việt Heo',        slug: '/product-page/xuc-xich-duc-viet-heo',     price: '52.000đ',  priceNumber: 52000,  category: 'Meat', categoryVi: 'Heo', image: uns('1555041469-a586c61ea9bc'), description: 'Xúc xích Đức Việt – thương hiệu Việt Nam uy tín, dai giòn, thơm khói tự nhiên, tiện chiên bữa sáng.',   quantity: '200g', weight: '200g', sizeGroup: 'Small', container: 'Clamshell', cutting: 'Sliced' }),
  base({ id: 'gan-heo-tuoi',              name: 'Gan Heo Tươi',                  slug: '/product-page/gan-heo-tuoi',              price: '55.000đ',  priceNumber: 55000,  category: 'Meat', categoryVi: 'Heo', image: uns('1504674900247-0877df9cc836'), description: 'Gan heo tươi sạch, giàu sắt và vitamin A, thích hợp xào hành tỏi hoặc làm pate truyền thống.',           quantity: '300g', weight: '300g', container: 'Clamshell', cutType: 'Pre-chopped', cutting: 'Sliced' }),
  base({ id: 'thit-bo-bap-my-nhap',       name: 'Thịt Bò Bắp Mỹ Nhập Khẩu',    slug: '/product-page/thit-bo-bap-my-nhap',       price: '185.000đ', priceNumber: 185000, category: 'Meat', categoryVi: 'Bò', image: uns('1546833999-b9f581a1996d'),  description: 'Bắp bò Mỹ nhập khẩu vân gân đẹp, hầm nhừ thịt mềm ngọt, thích hợp nấu bún bò, phở hoặc kho.',       quantity: '500g', weight: '500g', sizeGroup: 'Large', thickness: '1.5 Inches', preparation: 'Marinated', options: [{ name: 'Chế biến', values: ['Nguyên miếng', 'Thái lát'] }] }),
  base({ id: 'bo-than-noi-tuoi',          name: 'Bò Thăn Nội Tươi',              slug: '/product-page/bo-than-noi-tuoi',          price: '160.000đ', priceNumber: 160000, category: 'Meat', categoryVi: 'Bò', image: uns('1546833999-b9f581a1996d'),  description: 'Bò thăn nội tươi thịt đỏ hồng, thớ mịn, nướng lửa than, xào lăn hoặc nhúng lẩu.',                    quantity: '300g', weight: '300g', sizeGroup: 'Large', thickness: '1.5 Inches' }),
  base({ id: 'bo-vien-phuc-long',         name: 'Bò Viên Phúc Long 500g',        slug: '/product-page/bo-vien-phuc-long',         price: '68.000đ',  priceNumber: 68000,  category: 'Meat', categoryVi: 'Bò', image: uns('1519708227418-c8fd9a32b7a2'), description: 'Bò viên Phúc Long – thương hiệu VN nổi tiếng, dai giòn, thơm đậm, nhúng lẩu, nấu bún bò.',            quantity: '500g', weight: '500g', container: 'Clamshell' }),
  base({ id: 'ga-ta-tha-vuon',            name: 'Gà Ta Thả Vườn Nguyên Con',     slug: '/product-page/ga-ta-tha-vuon',            price: '150.000đ', priceNumber: 150000, category: 'Meat', categoryVi: 'Gà', image: uns('1518492104633-130d0cc84637'), description: 'Gà ta thả vườn nguyên con, thịt vàng chắc thơm, luộc, hấp gừng sả hoặc nướng muối ớt.',               quantity: '1 Con ~1.2kg', weight: '1200g', sizeGroup: 'Large', thickness: '1.5 Inches', packSize: 'Family Pack' }),
  base({ id: 'dui-ga-cong-nghiep-cp',     name: 'Đùi Gà Công Nghiệp C.P',        slug: '/product-page/dui-ga-cong-nghiep-cp',     price: '72.000đ',  priceNumber: 72000,  category: 'Meat', categoryVi: 'Gà', image: uns('1501200898405-f2284e1f15ab'), description: 'Đùi gà CP tươi nhiều thịt, da vàng đẹp, chiên giòn, nướng BBQ hoặc om sả ớt đều thơm ngon.',           quantity: '500g', weight: '500g', container: 'Clamshell' }),
  base({ id: 'canh-ga-giua-tuoi',         name: 'Cánh Gà Giữa Tươi',             slug: '/product-page/canh-ga-giua-tuoi',         price: '65.000đ',  priceNumber: 65000,  category: 'Meat', categoryVi: 'Gà', image: uns('1501200898405-f2284e1f15ab'), description: 'Cánh gà giữa tươi, da giòn sau khi chiên hoặc nướng, ướp tương mật ong cực hấp dẫn.',                  quantity: '500g', weight: '500g', container: 'Clamshell' }),
  base({ id: 'luon-vit-xiem-tuoi',        name: 'Lườn Vịt Xiêm Tươi',            slug: '/product-page/luon-vit-xiem-tuoi',        price: '75.000đ',  priceNumber: 75000,  category: 'Meat', categoryVi: 'Vịt', image: uns('1518492104633-130d0cc84637'), description: 'Lườn vịt xiêm tươi thịt đỏ chắc, ít mỡ, nấu lẩu, chiên sả ớt hoặc kho gừng đều ngon.',              quantity: '500g', weight: '500g', sizeGroup: 'Large', container: 'Clamshell', cutType: 'Pre-chopped', cutting: 'Whole Breast' }),
  base({ id: 'thit-cuu-uc-nhap',          name: 'Thịt Cừu Úc Nhập Khẩu',         slug: '/product-page/thit-cuu-uc-nhap',          price: '210.000đ', priceNumber: 210000, category: 'Meat', categoryVi: 'Nhập khẩu', image: uns('1546833999-b9f581a1996d'), description: 'Thịt cừu Úc nhập khẩu thơm đặc trưng, mềm ngọt, nướng rack of lamb hoặc xào rosemary.', quantity: '300g', weight: '300g', sizeGroup: 'Large', thickness: '1.5 Inches', preparation: 'Marinated' }),
];

// ═══════════════════════════════════════════════════════
// ── SEAFOOD (16 sản phẩm) ─────────────────────────────
// ═══════════════════════════════════════════════════════
export const seafoodProducts: XanhLaProduct[] = [
  base({ id: 'tom-su-tuoi-song-ca-mau',   name: 'Tôm Sú Tươi Sống Cà Mau',    slug: '/product-page/tom-su-tuoi-song-ca-mau',   price: '195.000đ', priceNumber: 195000, category: 'Seafood', categoryVi: 'Tôm', image: uns('1565680018434-b513d5e5fd47'), description: 'Tôm sú Cà Mau tươi sống size 20–25 con/kg, thịt chắc ngọt, hấp, nướng, rang muối hay làm lẩu.',      quantity: '500g', weight: '500g', sizeGroup: 'Large', container: 'Clamshell', cutting: 'Whole Breast', options: [{ name: 'Size', values: ['20-25 con/kg', '15-20 con/kg'] }] }),
  base({ id: 'tom-the-chan-trang-sach',    name: 'Tôm Thẻ Chân Trắng Sạch',    slug: '/product-page/tom-the-chan-trang-sach',    price: '140.000đ', priceNumber: 140000, category: 'Seafood', categoryVi: 'Tôm', image: uns('1625938144755-652e08e359b7'), description: 'Tôm thẻ nuôi sạch – ao kiểm soát kháng sinh, thịt chắc trắng, hấp, luộc, rang muối.',              quantity: '500g', weight: '500g', container: 'Clamshell', cutType: 'Pre-chopped' }),
  base({ id: 'tom-hum-bong-nha-trang',    name: 'Tôm Hùm Bông Nha Trang',      slug: '/product-page/tom-hum-bong-nha-trang',    price: '780.000đ', priceNumber: 780000, category: 'Seafood', categoryVi: 'Tôm', image: uns('1565680018434-b513d5e5fd47'), description: 'Tôm hùm bông Nha Trang tươi sống, thịt trắng ngọt béo, hấp bia, nướng phô mai hay làm sashimi.', quantity: '1 Con ~500g', weight: '500g', sizeGroup: 'Large', cutting: 'Whole Breast' }),
  base({ id: 'ca-hoi-na-uy-fillet',       name: 'Cá Hồi Na Uy Fillet Tươi',    slug: '/product-page/ca-hoi-na-uy-fillet',       price: '260.000đ', priceNumber: 260000, category: 'Seafood', categoryVi: 'Cá', image: uns('1510130387422-82bed34b37e9'),  description: 'Cá hồi Na Uy fillet tươi nhập khẩu, thịt hồng đậm, giàu omega-3, áp chảo, nướng hoặc ăn sashimi.', quantity: '300g', weight: '300g', sizeGroup: 'Large', container: 'Clamshell', cutType: 'Pre-chopped', cutting: 'Sliced', options: [{ name: 'Phần', values: ['Phần lưng', 'Phần bụng'] }] }),
  base({ id: 'ca-basa-fillet-dong-thap',  name: 'Cá Basa Fillet Đồng Tháp',    slug: '/product-page/ca-basa-fillet-dong-thap',  price: '72.000đ',  priceNumber: 72000,  category: 'Seafood', categoryVi: 'Cá', image: uns('1510130387422-82bed34b37e9'),  description: 'Cá basa fillet Đồng Tháp thịt trắng mịn không xương, dễ chế biến, kho, chiên, nấu canh chua.',     quantity: '500g', weight: '500g', container: 'Clamshell', cutType: 'Pre-chopped', cutting: 'Whole Breast' }),
  base({ id: 'ca-chem-fillet-tuoi',       name: 'Cá Chẽm Fillet Tươi',          slug: '/product-page/ca-chem-fillet-tuoi',       price: '110.000đ', priceNumber: 110000, category: 'Seafood', categoryVi: 'Cá', image: uns('1519708227418-c8fd9a32b7a2'),  description: 'Cá chẽm fillet thịt trắng dày ngọt, chiên giòn, hấp gừng hoặc nướng lá chuối đều xuất sắc.',     quantity: '500g', weight: '500g', sizeGroup: 'Large', container: 'Clamshell', cutType: 'Pre-chopped', cutting: 'Whole Breast' }),
  base({ id: 'ca-thu-dai-duong-khuc',     name: 'Cá Thu Đại Dương Khúc',        slug: '/product-page/ca-thu-dai-duong-khuc',     price: '145.000đ', priceNumber: 145000, category: 'Seafood', categoryVi: 'Cá', image: uns('1578662996442-48f60103fc96'),  description: 'Cá thu đại dương thịt đỏ hồng chắc, giàu omega-3, chiên sả hay kho mặn nước dừa đều thơm ngon.', quantity: '500g', weight: '500g', sizeGroup: 'Large', container: 'Clamshell', cutType: 'Pre-chopped' }),
  base({ id: 'ca-dieu-hong-ao-sach',      name: 'Cá Diêu Hồng Ao Sạch',         slug: '/product-page/ca-dieu-hong-ao-sach',      price: '72.000đ',  priceNumber: 72000,  category: 'Seafood', categoryVi: 'Cá', image: uns('1615141982883-c7ad0e69fd62'),  description: 'Cá diêu hồng nuôi ao sạch Đồng Tháp, thịt trắng ngọt, hấp gừng sả hoặc chiên giòn cuốn bánh tráng.', quantity: '1 Con ~600g', weight: '600g', sizeGroup: 'Large', cutting: 'Whole Breast' }),
  base({ id: 'ca-loc-tuoi-mien-tay',      name: 'Cá Lóc Tươi Miền Tây',         slug: '/product-page/ca-loc-tuoi-mien-tay',      price: '88.000đ',  priceNumber: 88000,  category: 'Seafood', categoryVi: 'Cá', image: uns('1519708227418-c8fd9a32b7a2'),  description: 'Cá lóc đồng miền Tây tươi sống, thịt trắng ngọt ít xương, nướng mọi, nấu canh chua hoặc kho tiêu.', quantity: '1 Con ~500g', weight: '500g', sizeGroup: 'Large', cutting: 'Whole Breast' }),
  base({ id: 'muc-ong-tuoi-phan-thiet',   name: 'Mực Ống Tươi Phan Thiết',      slug: '/product-page/muc-ong-tuoi-phan-thiet',   price: '120.000đ', priceNumber: 120000, category: 'Seafood', categoryVi: 'Mực', image: uns('1604594849809-dfedbc827105'), description: 'Mực ống Phan Thiết tươi thịt trắng giòn, vị ngọt tự nhiên, xào, chiên, nướng đều thơm ngon.',     quantity: '500g', weight: '500g', container: 'Clamshell', cutType: 'Pre-chopped', options: [{ name: 'Sơ chế', values: ['Nguyên con', 'Đã làm sạch'] }] }),
  base({ id: 'bach-tuoc-mini-tuoi',       name: 'Bạch Tuộc Mini Tươi',           slug: '/product-page/bach-tuoc-mini-tuoi',       price: '95.000đ',  priceNumber: 95000,  category: 'Seafood', categoryVi: 'Mực', image: uns('1559734840-f9509ee5677f'),  description: 'Bạch tuộc mini tươi giòn ngọt, nướng mỡ hành, xào sả ớt hay nhúng lẩu đều xuất sắc.',           quantity: '400g', weight: '400g', container: 'Clamshell', cutting: 'Sliced' }),
  base({ id: 'cua-bien-ca-mau-tuoi',      name: 'Cua Biển Cà Mau Tươi Sống',    slug: '/product-page/cua-bien-ca-mau-tuoi',      price: '240.000đ', priceNumber: 240000, category: 'Seafood', categoryVi: 'Cua & Ghẹ', image: uns('1550367363-02bb7dbb445d'), description: 'Cua biển Cà Mau tươi sống gạch đầy, thịt chắc ngọt, hấp bia, rang me hoặc nấu cháo.',           quantity: '1 Con ~600g', weight: '600g', sizeGroup: 'Large', cutting: 'Whole Breast' }),
  base({ id: 'ghe-xanh-tuoi-vung-tau',    name: 'Ghẹ Xanh Tươi Vũng Tàu',       slug: '/product-page/ghe-xanh-tuoi-vung-tau',    price: '165.000đ', priceNumber: 165000, category: 'Seafood', categoryVi: 'Cua & Ghẹ', image: uns('1550367363-02bb7dbb445d'), description: 'Ghẹ xanh Vũng Tàu tươi sống thịt ngọt, rang sả ớt, hấp gừng hoặc làm bún ghẹ miền Trung.',     quantity: '500g', weight: '500g', container: 'Clamshell' }),
  base({ id: 'ngheu-bien-tuoi-ben-tre',   name: 'Nghêu Biển Tươi Bến Tre',       slug: '/product-page/ngheu-bien-tuoi-ben-tre',   price: '55.000đ',  priceNumber: 55000,  category: 'Seafood', categoryVi: 'Nhuyễn thể', image: uns('1553659971-f01207815431'), description: 'Nghêu biển Bến Tre tươi sống, thịt béo ngọt, hấp sả gừng, rang muối sả ớt hay nấu canh chua.',  quantity: '500g', weight: '500g', cutting: 'Whole Breast' }),
  base({ id: 'hau-tuoi-vung-tau',         name: 'Hàu Tươi Vũng Tàu',             slug: '/product-page/hau-tuoi-vung-tau',         price: '68.000đ',  priceNumber: 68000,  category: 'Seafood', categoryVi: 'Nhuyễn thể', image: uns('1569718212165-3a8278d5f624'), description: 'Hàu tươi Vũng Tàu vỏ dày, thịt béo ngọt, nướng mỡ hành phô mai hoặc ăn sống với chanh ớt.',    quantity: '500g ~10 con', weight: '500g', cutting: 'Whole Breast' }),
  base({ id: 'so-huyet-tuoi',             name: 'Sò Huyết Tươi',                  slug: '/product-page/so-huyet-tuoi',             price: '58.000đ',  priceNumber: 58000,  category: 'Seafood', categoryVi: 'Nhuyễn thể', image: uns('1553659971-f01207815431'), description: 'Sò huyết tươi thịt đỏ mọng, giàu sắt, xào lăn, nhúng lẩu hay ăn kèm bánh tráng đều ngon.',      quantity: '500g', weight: '500g', cutting: 'Whole Breast' }),
];

// ═══════════════════════════════════════════════════════
// ── DAIRY – Sữa & Thực phẩm mát (12 SP) ──────────────
// ═══════════════════════════════════════════════════════
export const dairyProducts: XanhLaProduct[] = [
  base({ id: 'sua-tuoi-th-1l',               name: 'Sữa Tươi Tiệt Trùng TH True Milk 1L',    slug: '/product-page/sua-tuoi-th-1l',               price: '38.000đ',  priceNumber: 38000,  category: 'Dairy', categoryVi: 'Sữa tươi',     image: uns('1563636619-e9143da7973b'), description: 'Sữa tươi TH True Milk không đường tiệt trùng, nguyên chất 100% từ trang trại chuẩn quốc tế, bảo quản 6 tháng.',                quantity: '1 Hộp',    weight: '1000ml' }),
  base({ id: 'sua-tuoi-vinamilk-1l',          name: 'Sữa Tươi Vinamilk 100% Có Đường 1L',     slug: '/product-page/sua-tuoi-vinamilk-1l',          price: '35.000đ',  priceNumber: 35000,  category: 'Dairy', categoryVi: 'Sữa tươi',     image: uns('1563636619-e9143da7973b'), description: 'Sữa tươi Vinamilk 100% có đường, hương vị thơm ngon quen thuộc, bổ sung canxi và vitamin D3.',                                    quantity: '1 Hộp',    weight: '1000ml' }),
  base({ id: 'sua-chua-vinamilk-probi',       name: 'Sữa Chua Uống Vinamilk Probi 65ml×6',    slug: '/product-page/sua-chua-vinamilk-probi',       price: '32.000đ',  priceNumber: 32000,  category: 'Dairy', categoryVi: 'Sữa chua',     image: uns('1488477583-0958585028-0e'), description: 'Sữa chua uống Vinamilk Probi men vi sinh sống, tốt cho hệ tiêu hóa, vị chua ngọt dễ uống.',                                      quantity: '6 Hộp',    weight: '390ml',  container: 'Clamshell' }),
  base({ id: 'sua-chua-th-yogurt',            name: 'Sữa Chua Ăn TH True Yogurt 100g×4',      slug: '/product-page/sua-chua-th-yogurt',            price: '28.000đ',  priceNumber: 28000,  category: 'Dairy', categoryVi: 'Sữa chua',     image: uns('1488477583-0958585028-0e'), description: 'Sữa chua ăn TH True Yogurt không đường, men vi sinh sống, mịn béo tự nhiên.',                                                     quantity: '4 Hũ',     weight: '400g',   container: 'Clamshell' }),
  base({ id: 'pho-mai-con-bo-cuoi',           name: 'Phô Mai Con Bò Cười 8 Miếng',             slug: '/product-page/pho-mai-con-bo-cuoi',           price: '52.000đ',  priceNumber: 52000,  category: 'Dairy', categoryVi: 'Phô mai',      image: uns('1452195100-fe69bfc3cb6e'), description: 'Phô mai con bò cười nhập khẩu Pháp, creamy, bổ sung canxi, tiện dùng cho trẻ em và làm sandwich.',                                quantity: '8 Miếng',  weight: '120g',   container: 'Clamshell' }),
  base({ id: 'pho-mai-mozzarella-anchor',     name: 'Phô Mai Mozzarella Anchor 250g',          slug: '/product-page/pho-mai-mozzarella-anchor',     price: '85.000đ',  priceNumber: 85000,  category: 'Dairy', categoryVi: 'Phô mai',      image: uns('1452195100-fe69bfc3cb6e'), description: 'Phô mai mozzarella Anchor New Zealand, kéo sợi đẹp khi nướng, dùng cho pizza, bánh mì nướng.',                                  quantity: '1 Gói',    weight: '250g',   container: 'Clamshell' }),
  base({ id: 'trung-ga-ta-vuon-que',          name: 'Trứng Gà Ta Sạch Vườn Quê 10 Quả',       slug: '/product-page/trung-ga-ta-vuon-que',          price: '45.000đ',  priceNumber: 45000,  category: 'Dairy', categoryVi: 'Trứng',        image: uns('1582722007-0908a24b9be0'), description: 'Trứng gà ta nuôi sạch, lòng đỏ vàng đậm, không tăng trưởng, phù hợp trẻ em và người lớn tuổi.',                                  quantity: '10 Quả',   weight: '600g' }),
  base({ id: 'trung-ga-ba-huan-10',           name: 'Trứng Gà Công Nghiệp Ba Huân 10 Quả',    slug: '/product-page/trung-ga-ba-huan-10',           price: '32.000đ',  priceNumber: 32000,  category: 'Dairy', categoryVi: 'Trứng',        image: uns('1582722007-0908a24b9be0'), description: 'Trứng gà Ba Huân – thương hiệu VN uy tín, sạch khuẩn salmonella, kiểm định chất lượng nghiêm ngặt.',                         quantity: '10 Quả',   weight: '600g' }),
  base({ id: 'trung-vit-muoi-san',            name: 'Trứng Vịt Muối Sẵn 4 Quả',               slug: '/product-page/trung-vit-muoi-san',            price: '28.000đ',  priceNumber: 28000,  category: 'Dairy', categoryVi: 'Trứng',        image: uns('1582722007-0908a24b9be0'), description: 'Trứng vịt muối đã qua sơ chế, lòng đỏ chảy dầu đặc trưng, ăn kèm cháo trắng hay làm bánh.',                                     quantity: '4 Quả',    weight: '300g' }),
  base({ id: 'bo-lat-tuong-an-200g',          name: 'Bơ Lạt Tường An 200g',                   slug: '/product-page/bo-lat-tuong-an-200g',          price: '42.000đ',  priceNumber: 42000,  category: 'Dairy', categoryVi: 'Bơ & kem',     image: uns('1628191510-d9bf1f8b966c'), description: 'Bơ lạt Tường An – thương hiệu Việt Nam, mềm mịn, thơm ngậy dùng cho bánh, xào và phết bánh mì.',                                  quantity: '1 Hộp',    weight: '200g',   container: 'Clamshell' }),
  base({ id: 'kem-tuoi-whipping-anchor',      name: 'Kem Tươi Whipping Cream Anchor 250ml',   slug: '/product-page/kem-tuoi-whipping-anchor',      price: '65.000đ',  priceNumber: 65000,  category: 'Dairy', categoryVi: 'Bơ & kem',     image: uns('1628191510-d9bf1f8b966c'), description: 'Whipping cream Anchor 35% béo, đánh bông tốt, dùng trang trí bánh kem và làm sốt kem.',                                          quantity: '1 Hộp',    weight: '250ml',  container: 'Clamshell' }),
  base({ id: 'sua-dac-ong-tho-380g',          name: 'Sữa Đặc Có Đường Ông Thọ 380g',          slug: '/product-page/sua-dac-ong-tho-380g',          price: '22.000đ',  priceNumber: 22000,  category: 'Dairy', categoryVi: 'Sữa chế biến', image: uns('1563636619-e9143da7973b'), description: 'Sữa đặc Ông Thọ – thương hiệu kinh điển của Vinamilk, ngọt béo đậm đà, pha cà phê, làm bánh hay ăn kèm bánh mì.',              quantity: '1 Lon',    weight: '380g' }),
];

// ═══════════════════════════════════════════════════════
// ── BEVERAGES – Thức uống (12 SP) ─────────────────────
// ═══════════════════════════════════════════════════════
export const beverageProducts: XanhLaProduct[] = [
  base({ id: 'nuoc-cam-ep-vfresh-1l',         name: 'Nước Cam Ép Vfresh 1L',                  slug: '/product-page/nuoc-cam-ep-vfresh-1l',         price: '32.000đ',  priceNumber: 32000,  category: 'Beverages', categoryVi: 'Nước trái cây',  image: uns('1600271535-b5a69c7f5c2d'), description: 'Nước cam ép Vfresh (Vinamilk) 100% từ cam tự nhiên, không màu chất bảo quản, nhiều vitamin C.',                                    quantity: '1 Hộp',    weight: '1000ml' }),
  base({ id: 'nuoc-ep-tao-welchs',            name: 'Nước Ép Táo Welchs 296ml',               slug: '/product-page/nuoc-ep-tao-welchs',            price: '28.000đ',  priceNumber: 28000,  category: 'Beverages', categoryVi: 'Nước trái cây',  image: uns('1600271535-b5a69c7f5c2d'), description: 'Nước ép táo Welchs nguyên chất 100%, vị ngọt tự nhiên, nhập khẩu Mỹ, không thêm đường.',                                         quantity: '1 Chai',   weight: '296ml' }),
  base({ id: 'tra-xanh-c2-500ml',             name: 'Trà Xanh Không Độ C2 500ml',             slug: '/product-page/tra-xanh-c2-500ml',             price: '12.000đ',  priceNumber: 12000,  category: 'Beverages', categoryVi: 'Trà & cà phê',   image: uns('1544145945-f90425340c7e'), description: 'Trà xanh C2 hương chanh mát lạnh, ít calo, thương hiệu Tân Hiệp Phát Việt Nam, giải khát nhanh.',                                  quantity: '1 Chai',   weight: '500ml' }),
  base({ id: 'ca-phe-highlands-250ml',        name: 'Cà Phê Sữa Đá Highlands 250ml',         slug: '/product-page/ca-phe-highlands-250ml',        price: '22.000đ',  priceNumber: 22000,  category: 'Beverages', categoryVi: 'Trà & cà phê',   image: uns('1509042023-f6fc48d40a2e'), description: 'Cà phê sữa đá Highlands Coffee đóng chai, hương thơm đặc trưng cà phê Việt, tiện uống mọi lúc mọi nơi.',                      quantity: '1 Chai',   weight: '250ml' }),
  base({ id: 'nuoc-khoang-lavie-24',          name: 'Nước Khoáng LaVie 500ml×24',             slug: '/product-page/nuoc-khoang-lavie-24',          price: '92.000đ',  priceNumber: 92000,  category: 'Beverages', categoryVi: 'Nước khoáng',    image: uns('1548438294-ee8a8eb34816'), description: 'Nước khoáng thiên nhiên LaVie nguồn gốc Đak Long – Lâm Đồng, đóng thùng 24 chai tiết kiệm.',                                     quantity: '24 Chai',  weight: '12000ml' }),
  base({ id: 'nuoc-suoi-aquafina-24',         name: 'Nước Suối Aquafina 500ml×24',            slug: '/product-page/nuoc-suoi-aquafina-24',         price: '80.000đ',  priceNumber: 80000,  category: 'Beverages', categoryVi: 'Nước khoáng',    image: uns('1548438294-ee8a8eb34816'), description: 'Nước tinh khiết Aquafina lọc 7 giai đoạn, vị thanh khiết, thùng 24 chai tiện lợi cho gia đình.',                                  quantity: '24 Chai',  weight: '12000ml' }),
  base({ id: 'bia-saigon-special-24',         name: 'Bia Saigon Special 330ml×24',            slug: '/product-page/bia-saigon-special-24',         price: '285.000đ', priceNumber: 285000, category: 'Beverages', categoryVi: 'Bia & rượu',     image: uns('1535958327-64a2d5bb8b73'), description: 'Bia Saigon Special – thương hiệu bia Việt Nam nổi tiếng nhất, vị đậm đà sảng khoái, thùng 24 lon.',                               quantity: '24 Lon',   weight: '7920ml', sizeGroup: 'Large' }),
  base({ id: 'bia-tiger-bac-24',              name: 'Bia Tiger Bạc 330ml×24',                 slug: '/product-page/bia-tiger-bac-24',              price: '295.000đ', priceNumber: 295000, category: 'Beverages', categoryVi: 'Bia & rượu',     image: uns('1535958327-64a2d5bb8b73'), description: 'Bia Tiger bạc sản xuất tại Việt Nam, vị nhẹ mát dịu, phù hợp mọi bữa tiệc.',                                                      quantity: '24 Lon',   weight: '7920ml', sizeGroup: 'Large' }),
  base({ id: 'sua-dau-nanh-fami-10',          name: 'Sữa Đậu Nành Fami Nguyên Chất 200ml×10', slug: '/product-page/sua-dau-nanh-fami-10',          price: '42.000đ',  priceNumber: 42000,  category: 'Beverages', categoryVi: 'Sữa hạt',        image: uns('1563636619-e9143da7973b'), description: 'Sữa đậu nành Fami nguyên chất – thương hiệu VN Vinasoy, giàu protein thực vật, không đường thêm.',                               quantity: '10 Hộp',   weight: '2000ml' }),
  base({ id: 'sua-hanh-nhan-almond-12',       name: 'Sữa Hạnh Nhân Nestlé Almond 180ml×12',  slug: '/product-page/sua-hanh-nhan-almond-12',       price: '115.000đ', priceNumber: 115000, category: 'Beverages', categoryVi: 'Sữa hạt',        image: uns('1563636619-e9143da7973b'), description: 'Sữa hạnh nhân Nestlé ít calo, không lactose, hương vị thơm dịu, phù hợp người ăn chay.',                                         quantity: '12 Hộp',   weight: '2160ml' }),
  base({ id: 'nuoc-tang-luc-sting-dau',       name: 'Nước Tăng Lực Sting Dâu 330ml',         slug: '/product-page/nuoc-tang-luc-sting-dau',       price: '10.000đ',  priceNumber: 10000,  category: 'Beverages', categoryVi: 'Nước tăng lực',  image: uns('1535958327-64a2d5bb8b73'), description: 'Nước tăng lực Sting dâu đỏ – hương vị quen thuộc, bổ sung vitamin B6 và B12 giúp tỉnh táo tức thì.',                            quantity: '1 Lon',    weight: '330ml',  sizeGroup: 'Small' }),
  base({ id: 'tra-kombucha-yuzu',             name: 'Trà Kombucha Yuzu Lên Men 480ml',        slug: '/product-page/tra-kombucha-yuzu',             price: '65.000đ',  priceNumber: 65000,  category: 'Beverages', categoryVi: 'Trà & cà phê',   image: uns('1544145945-f90425340c7e'), description: 'Trà kombucha hữu cơ vị yuzu, lên men tự nhiên, giàu probiotic và enzyme có lợi cho tiêu hóa.',                                   quantity: '1 Chai',   weight: '480ml' }),
];

// ═══════════════════════════════════════════════════════
// ── BAKERY – Bánh & Đồ ăn vặt (12 SP) ────────────────
// ═══════════════════════════════════════════════════════
export const bakeryProducts: XanhLaProduct[] = [
  base({ id: 'banh-mi-sandwich-abc',          name: 'Bánh Mì Sandwich ABC Loại Dày',          slug: '/product-page/banh-mi-sandwich-abc',          price: '28.000đ',  priceNumber: 28000,  category: 'Bakery', categoryVi: 'Bánh mì',        image: uns('1509440159596-0280db3ae2d1'), description: 'Bánh mì sandwich ABC Kinh Đô dày mềm, vỏ nâu vàng, lát to phù hợp làm toast sáng và sandwich.',                                   quantity: '1 Túi',    weight: '450g' }),
  base({ id: 'banh-mi-brioche-phap',          name: 'Bánh Mì Hoa Cúc Brioche Pháp',          slug: '/product-page/banh-mi-brioche-phap',          price: '45.000đ',  priceNumber: 45000,  category: 'Bakery', categoryVi: 'Bánh mì',        image: uns('1509440159596-0280db3ae2d1'), description: 'Bánh mì hoa cúc brioche mềm bơ thơm, nhập khẩu Pháp, dùng kẹp chả lụa, trứng hay ăn không đều ngon.',                           quantity: '6 Cái',    weight: '300g' }),
  base({ id: 'banh-custas-kinh-do-6',         name: 'Bánh Custas Kem Trứng Kinh Đô 6 Cái',   slug: '/product-page/banh-custas-kinh-do-6',         price: '22.000đ',  priceNumber: 22000,  category: 'Bakery', categoryVi: 'Bánh ngọt',      image: uns('1499636136210-6f4ee915583e'), description: 'Bánh custas kem trứng Kinh Đô – thương hiệu bánh kẹo hàng đầu Việt Nam, vỏ xốp thơm nhân kem béo.',                              quantity: '6 Cái',    weight: '132g',   sizeGroup: 'Small' }),
  base({ id: 'banh-chocopie-orion-6',         name: 'Bánh Chocopie Orion 6 Cái',              slug: '/product-page/banh-chocopie-orion-6',         price: '32.000đ',  priceNumber: 32000,  category: 'Bakery', categoryVi: 'Bánh ngọt',      image: uns('1499636136210-6f4ee915583e'), description: 'Bánh Chocopie Orion sản xuất tại Việt Nam, lớp socola bao ngoài, nhân marshmallow mềm ngọt.',                                      quantity: '6 Cái',    weight: '168g',   sizeGroup: 'Small' }),
  base({ id: 'banh-gao-rong-bien-150g',       name: 'Bánh Gạo Việt Rong Biển 150g',          slug: '/product-page/banh-gao-rong-bien-150g',       price: '18.000đ',  priceNumber: 18000,  category: 'Bakery', categoryVi: 'Bánh ngọt',      image: uns('1499636136210-6f4ee915583e'), description: 'Bánh gạo vị rong biển giòn tan, ít calo, phù hợp ăn vặt lành mạnh, dành cho trẻ em và người lớn.',                               quantity: '1 Túi',    weight: '150g',   sizeGroup: 'Small' }),
  base({ id: 'banh-quy-cosy-bo-sua',          name: 'Bánh Quy Cosy Bơ Sữa 378g',             slug: '/product-page/banh-quy-cosy-bo-sua',          price: '38.000đ',  priceNumber: 38000,  category: 'Bakery', categoryVi: 'Bánh ngọt',      image: uns('1499636136210-6f4ee915583e'), description: 'Bánh quy bơ sữa Cosy – thương hiệu Kinh Đô, giòn thơm, đóng gói bảo quản tốt, phù hợp tiếp khách.',                              quantity: '1 Hộp',    weight: '378g' }),
  base({ id: 'keo-dua-ben-tre',               name: 'Kẹo Dừa Bến Tre Thanh Hương',           slug: '/product-page/keo-dua-ben-tre',               price: '25.000đ',  priceNumber: 25000,  category: 'Bakery', categoryVi: 'Kẹo & mứt',      image: uns('1556909211-54d3640fcb8b'), description: 'Kẹo dừa Bến Tre – đặc sản Việt Nam, làm từ dừa tươi nguyên chất, dai ngọt thơm béo.',                                              quantity: '200g',     weight: '200g',   sizeGroup: 'Small' }),
  base({ id: 'mut-gung-deo-200g',             name: 'Mứt Gừng Dẻo Handmade 200g',            slug: '/product-page/mut-gung-deo-200g',             price: '35.000đ',  priceNumber: 35000,  category: 'Bakery', categoryVi: 'Kẹo & mứt',      image: uns('1556909211-54d3640fcb8b'), description: 'Mứt gừng dẻo handmade vị cay ngọt đặc trưng, không phẩm màu, phù hợp ngày Tết và tiêu hóa.',                                     quantity: '200g',     weight: '200g',   sizeGroup: 'Small' }),
  base({ id: 'chocolate-marou-ben-tre',       name: 'Chocolate Đen 70% Marou Bến Tre 80g',   slug: '/product-page/chocolate-marou-ben-tre',       price: '85.000đ',  priceNumber: 85000,  category: 'Bakery', categoryVi: 'Kẹo & mứt',      image: uns('1548907593-d9e6d5a0'), description: 'Chocolate Marou – thương hiệu bean-to-bar Việt Nam, cacao Bến Tre 70%, đắng sâu thanh thoát.',                                      quantity: '1 Thanh',  weight: '80g',    sizeGroup: 'Small' }),
  base({ id: 'bim-bim-tom-oishi-40g',         name: 'Bim Bim Tôm Oishi 40g',                 slug: '/product-page/bim-bim-tom-oishi-40g',         price: '8.000đ',   priceNumber: 8000,   category: 'Bakery', categoryVi: 'Snack & chips',   image: uns('1621939457-ef843da1fb1d'), description: 'Bim bim tôm Oishi giòn xốp, hương tôm đặc trưng, snack phổ biến nhất Việt Nam cho mọi lứa tuổi.',                                  quantity: '1 Gói',    weight: '40g',    sizeGroup: 'Small' }),
  base({ id: 'banh-phong-tom-sa-giang',       name: 'Bánh Phồng Tôm Sa Giang 200g',          slug: '/product-page/banh-phong-tom-sa-giang',       price: '22.000đ',  priceNumber: 22000,  category: 'Bakery', categoryVi: 'Snack & chips',   image: uns('1621939457-ef843da1fb1d'), description: 'Bánh phồng tôm Sa Giang – đặc sản Đồng Tháp, chiên phồng to giòn vàng, hương tôm ngọt tự nhiên.',                                 quantity: '1 Gói',    weight: '200g',   sizeGroup: 'Small' }),
  base({ id: 'hat-dieu-long-an-200g',         name: 'Hạt Điều Rang Muối Long An 200g',        slug: '/product-page/hat-dieu-long-an-200g',         price: '55.000đ',  priceNumber: 55000,  category: 'Bakery', categoryVi: 'Snack & chips',   image: uns('1621939457-ef843da1fb1d'), description: 'Hạt điều rang muối Long An – đặc sản Việt Nam, hạt to đều thơm bùi, giàu chất béo lành mạnh.',                                    quantity: '200g',     weight: '200g',   sizeGroup: 'Small' }),
];

// ═══════════════════════════════════════════════════════
// ── PANTRY – Gia vị & Thực phẩm khô (11 SP) ──────────
// ═══════════════════════════════════════════════════════
export const pantryProducts: XanhLaProduct[] = [
  base({ id: 'nuoc-mam-phu-quoc-500ml',       name: 'Nước Mắm Phú Quốc Khải Hoàn 500ml',     slug: '/product-page/nuoc-mam-phu-quoc-500ml',       price: '52.000đ',  priceNumber: 52000,  category: 'Pantry', categoryVi: 'Gia vị',         image: uns('1532336414038-cf19250c5757'), description: 'Nước mắm truyền thống Phú Quốc 40 độ đạm, ủ thùng gỗ 12 tháng, vị đậm ngọt tự nhiên.',                                          quantity: '1 Chai',   weight: '500ml' }),
  base({ id: 'nuoc-tuong-maggi-700ml',        name: 'Nước Tương Maggi Đậm Đặc 700ml',         slug: '/product-page/nuoc-tuong-maggi-700ml',        price: '28.000đ',  priceNumber: 28000,  category: 'Pantry', categoryVi: 'Gia vị',         image: uns('1532336414038-cf19250c5757'), description: 'Nước tương đen Maggi đậm đặc, sản xuất tại Việt Nam, ướp thịt, nấu kho hay chấm trực tiếp.',                                    quantity: '1 Chai',   weight: '700ml' }),
  base({ id: 'hat-nem-knorr-400g',            name: 'Hạt Nêm Knorr Xương Ống 400g',           slug: '/product-page/hat-nem-knorr-400g',            price: '42.000đ',  priceNumber: 42000,  category: 'Pantry', categoryVi: 'Gia vị',         image: uns('1532336414038-cf19250c5757'), description: 'Hạt nêm Knorr từ thịt thăn và xương ống bò, vị ngọt tự nhiên, nêm canh, xào, kho đều đậm đà.',                                   quantity: '1 Gói',    weight: '400g' }),
  base({ id: 'nuoc-mam-nam-ngu-650ml',        name: 'Nước Mắm Nam Ngư Đặc Biệt 650ml',        slug: '/product-page/nuoc-mam-nam-ngu-650ml',        price: '25.000đ',  priceNumber: 25000,  category: 'Pantry', categoryVi: 'Gia vị',         image: uns('1532336414038-cf19250c5757'), description: 'Nước mắm Nam Ngư phổ biến nhất Việt Nam, vị vừa, dễ pha chế nước chấm bún, phở hay chả.',                                        quantity: '1 Chai',   weight: '650ml' }),
  base({ id: 'dau-an-neptune-2l',             name: 'Dầu Ăn Neptune 2L',                      slug: '/product-page/dau-an-neptune-2l',             price: '78.000đ',  priceNumber: 78000,  category: 'Pantry', categoryVi: 'Dầu ăn',         image: uns('1532336414038-cf19250c5757'), description: 'Dầu thực vật Neptune giàu omega-6, bền nhiệt cao, phù hợp chiên, xào mọi loại thức ăn.',                                          quantity: '1 Chai',   weight: '2000ml', sizeGroup: 'Large' }),
  base({ id: 'dau-oliu-bertolli-500ml',       name: 'Dầu Oliu Extra Virgin Bertolli 500ml',   slug: '/product-page/dau-oliu-bertolli-500ml',       price: '195.000đ', priceNumber: 195000, category: 'Pantry', categoryVi: 'Dầu ăn',         image: uns('1532336414038-cf19250c5757'), description: 'Dầu oliu extra virgin Bertolli Ý ép lạnh, giàu chất béo tốt, dùng trộn salad, sốt pasta.',                                         quantity: '1 Chai',   weight: '500ml' }),
  base({ id: 'gao-st25-5kg',                  name: 'Gạo ST25 Cần Thơ 5Kg Hút Chân Không',   slug: '/product-page/gao-st25-5kg',                  price: '145.000đ', priceNumber: 145000, category: 'Pantry', categoryVi: 'Gạo & ngũ cốc',  image: uns('1532336414038-cf19250c5757'), description: 'Gạo ST25 Cần Thơ – gạo ngon nhất thế giới 2019, hạt dài thơm mềm dẻo, cơm ngon từng bữa.',                                       quantity: '5 Kg',     weight: '5000g',  sizeGroup: 'Large' }),
  base({ id: 'bun-kho-bich-chi-400g',         name: 'Bún Khô Bích Chi 400g',                  slug: '/product-page/bun-kho-bich-chi-400g',         price: '18.000đ',  priceNumber: 18000,  category: 'Pantry', categoryVi: 'Mì bún miến',    image: uns('1551248429-3197e4ef4020'), description: 'Bún khô Bích Chi – thương hiệu VN, sợi trắng mềm mướt sau khi nấu, làm bún bò Huế, bún riêu.',                                  quantity: '1 Gói',    weight: '400g' }),
  base({ id: 'mi-hao-hao-tom-chua-cay',       name: 'Mì Hảo Hảo Tôm Chua Cay 75g',           slug: '/product-page/mi-hao-hao-tom-chua-cay',       price: '5.000đ',   priceNumber: 5000,   category: 'Pantry', categoryVi: 'Mì bún miến',    image: uns('1551248429-3197e4ef4020'), description: 'Mì Hảo Hảo – mì gói số 1 Việt Nam, hương tôm chua cay đặc trưng, tiện nhanh cho bữa ăn bận rộn.',                              quantity: '1 Gói',    weight: '75g',    sizeGroup: 'Small' }),
  base({ id: 'tuong-ot-chinsu-520g',          name: 'Tương Ớt Chinsu 520g',                   slug: '/product-page/tuong-ot-chinsu-520g',          price: '28.000đ',  priceNumber: 28000,  category: 'Pantry', categoryVi: 'Gia vị',         image: uns('1532336414038-cf19250c5757'), description: 'Tương ớt Chinsu – thương hiệu Masan Việt Nam, cay vừa thơm ngọt, chấm bánh tráng hay pha gia vị.',                               quantity: '1 Chai',   weight: '520g' }),
  base({ id: 'muoi-tom-tay-ninh',             name: 'Muối Tôm Tây Ninh 100g',                 slug: '/product-page/muoi-tom-tay-ninh',             price: '15.000đ',  priceNumber: 15000,  category: 'Pantry', categoryVi: 'Gia vị',         image: uns('1532336414038-cf19250c5757'), description: 'Muối tôm Tây Ninh đặc sản, màu đỏ đẹp, vị mặn ngọt cay đặc trưng, chấm trái cây chua hay xoài xanh.',                              quantity: '1 Túi',    weight: '100g',   sizeGroup: 'Small' }),
];

// ═══════════════════════════════════════════════════════
// ── PERSONAL – Chăm sóc cá nhân (11 SP) ──────────────
// ═══════════════════════════════════════════════════════
export const personalProducts: XanhLaProduct[] = [
  base({ id: 'sua-tam-lifebuoy-850g',         name: 'Sữa Tắm Lifebuoy Sạch Khuẩn 850g',      slug: '/product-page/sua-tam-lifebuoy-850g',         price: '88.000đ',  priceNumber: 88000,  category: 'Personal', categoryVi: 'Tắm gội',       image: uns('1608248543803-ba4f8c70ae0b'), description: 'Sữa tắm Lifebuoy kháng khuẩn 99.9%, hương thơm tươi mát, sản xuất tại Việt Nam, da sạch mịn.',                                    quantity: '1 Chai',   weight: '850g',   sizeGroup: 'Large' }),
  base({ id: 'sua-tam-romano-380g',           name: 'Sữa Tắm Romano Classic 380g',            slug: '/product-page/sua-tam-romano-380g',           price: '52.000đ',  priceNumber: 52000,  category: 'Personal', categoryVi: 'Tắm gội',       image: uns('1608248543803-ba4f8c70ae0b'), description: 'Sữa tắm Romano hương gỗ lịch lãm – thương hiệu quen thuộc của người Việt, da sạch tươi mát.',                                      quantity: '1 Chai',   weight: '380g' }),
  base({ id: 'dau-goi-clear-men-650g',        name: 'Dầu Gội Clear Men Cool Sport 650g',      slug: '/product-page/dau-goi-clear-men-650g',        price: '95.000đ',  priceNumber: 95000,  category: 'Personal', categoryVi: 'Tắm gội',       image: uns('1608248543803-ba4f8c70ae0b'), description: 'Dầu gội Clear Men ngăn gàu 100%, hương bạc hà mát lạnh, sạch dầu suốt 24h, sản xuất VN.',                                         quantity: '1 Chai',   weight: '650g',   sizeGroup: 'Large' }),
  base({ id: 'dau-xa-rejoice-320g',           name: 'Dầu Xả Rejoice Siêu Mềm Mượt 320g',     slug: '/product-page/dau-xa-rejoice-320g',           price: '65.000đ',  priceNumber: 65000,  category: 'Personal', categoryVi: 'Tắm gội',       image: uns('1608248543803-ba4f8c70ae0b'), description: 'Dầu xả Rejoice mềm mượt tức thì, giảm gãy rụng tóc, hương thơm tươi mát dịu nhẹ.',                                                quantity: '1 Chai',   weight: '320g' }),
  base({ id: 'kem-danh-rang-ps-muoi',         name: 'Kem Đánh Răng P/S Muối Trắng Sáng 230g',slug: '/product-page/kem-danh-rang-ps-muoi',         price: '38.000đ',  priceNumber: 38000,  category: 'Personal', categoryVi: 'Vệ sinh răng',  image: uns('1608248543803-ba4f8c70ae0b'), description: 'Kem đánh răng P/S muối – thương hiệu Việt Nam, muối biển kết hợp fluor bảo vệ men răng, hơi thở thơm mát.',                        quantity: '1 Hộp',    weight: '230g' }),
  base({ id: 'nuoc-suc-mieng-listerine-750',  name: 'Nước Súc Miệng Listerine Cool 750ml',    slug: '/product-page/nuoc-suc-mieng-listerine-750',  price: '85.000đ',  priceNumber: 85000,  category: 'Personal', categoryVi: 'Vệ sinh răng',  image: uns('1608248543803-ba4f8c70ae0b'), description: 'Nước súc miệng Listerine Cool Mint diệt 99.9% vi khuẩn, hơi thở thơm mát 12 tiếng.',                                                quantity: '1 Chai',   weight: '750ml',  sizeGroup: 'Large' }),
  base({ id: 'giay-ve-sinh-bless-you-10',     name: 'Giấy Vệ Sinh Bless You 10 Cuộn 3 Lớp',  slug: '/product-page/giay-ve-sinh-bless-you-10',     price: '68.000đ',  priceNumber: 68000,  category: 'Personal', categoryVi: 'Giấy & khăn',   image: uns('1584622264-7a920b3d73e3'), description: 'Giấy vệ sinh Bless You 3 lớp mềm mịn, không hoá chất tẩy trắng, an toàn cho da nhạy cảm.',                                        quantity: '10 Cuộn',  weight: '900g' }),
  base({ id: 'khan-giay-pulppy-3-hop',        name: 'Khăn Giấy Pulppy Facial 100 Tờ×3 Hộp',  slug: '/product-page/khan-giay-pulppy-3-hop',        price: '42.000đ',  priceNumber: 42000,  category: 'Personal', categoryVi: 'Giấy & khăn',   image: uns('1584622264-7a920b3d73e3'), description: 'Khăn giấy rút Pulppy mềm mịn, không xơ vải, phù hợp lau mặt, chùi miệng hay dọn bếp.',                                            quantity: '3 Hộp',    weight: '300g' }),
  base({ id: 'kem-chong-nang-sunplay-30g',    name: 'Kem Chống Nắng Sunplay SPF50+ 30g',      slug: '/product-page/kem-chong-nang-sunplay-30g',    price: '72.000đ',  priceNumber: 72000,  category: 'Personal', categoryVi: 'Dưỡng da',      image: uns('1608248543803-ba4f8c70ae0b'), description: 'Kem chống nắng Sunplay Skin Aqua SPF50+ không nhờn rít, thấm nhanh, bảo vệ da suốt 4 tiếng.',                                     quantity: '1 Tuýp',   weight: '30g',    sizeGroup: 'Small' }),
  base({ id: 'xit-chong-muoi-raid-200ml',     name: 'Xịt Chống Muỗi Raid 200ml',             slug: '/product-page/xit-chong-muoi-raid-200ml',     price: '45.000đ',  priceNumber: 45000,  category: 'Personal', categoryVi: 'Chăm sóc khác', image: uns('1608248543803-ba4f8c70ae0b'), description: 'Xịt chống muỗi Raid hiệu quả nhanh, mùi nhẹ, an toàn cho trẻ em trên 2 tuổi, tác dụng đến 8 tiếng.',                              quantity: '1 Chai',   weight: '200ml' }),
  base({ id: 'bong-tay-trang-shiseido',       name: 'Bông Tẩy Trang Shiseido 165 Miếng',      slug: '/product-page/bong-tay-trang-shiseido',       price: '95.000đ',  priceNumber: 95000,  category: 'Personal', categoryVi: 'Dưỡng da',      image: uns('1608248543803-ba4f8c70ae0b'), description: 'Bông tẩy trang Shiseido siêu mịn 4 cạnh, không xơ vải, tẩy trang sạch sâu không đau da.',                                          quantity: '1 Gói',    weight: '165g' }),
];

// ═══════════════════════════════════════════════════════
// ── HOUSEHOLD – Nhà cửa & Đời sống (11 SP) ────────────
// ═══════════════════════════════════════════════════════
export const householdProducts: XanhLaProduct[] = [
  base({ id: 'nuoc-rua-bat-sunlight-750g',    name: 'Nước Rửa Bát Sunlight Trà Xanh 750g',   slug: '/product-page/nuoc-rua-bat-sunlight-750g',    price: '32.000đ',  priceNumber: 32000,  category: 'Household', categoryVi: 'Tẩy rửa',      image: uns('1556911220-e15b29be8c8f'), description: 'Nước rửa bát Sunlight trà xanh loại trừ 100% vi khuẩn, không gây khô da, sản xuất VN.',                                           quantity: '1 Chai',   weight: '750ml' }),
  base({ id: 'bot-giat-omo-matic-45kg',       name: 'Bột Giặt OMO Matic Cửa Trước 4.5Kg',    slug: '/product-page/bot-giat-omo-matic-45kg',       price: '265.000đ', priceNumber: 265000, category: 'Household', categoryVi: 'Giặt giũ',     image: uns('1556911220-e15b29be8c8f'), description: 'Bột giặt OMO Matic cho máy giặt cửa trước, sạch vết bẩn cứng đầu, thơm lâu.',                                                      quantity: '1 Túi',    weight: '4500g',  sizeGroup: 'Large' }),
  base({ id: 'nuoc-xa-vai-comfort-32l',       name: 'Nước Xả Vải Comfort Ngàn Hoa 3.2L',     slug: '/product-page/nuoc-xa-vai-comfort-32l',       price: '125.000đ', priceNumber: 125000, category: 'Household', categoryVi: 'Giặt giũ',     image: uns('1556911220-e15b29be8c8f'), description: 'Nước xả Comfort ngàn hoa hương thơm lưu lâu 24 giờ, mềm vải, chống tĩnh điện.',                                                   quantity: '1 Can',    weight: '3200ml', sizeGroup: 'Large' }),
  base({ id: 'nuoc-tay-bon-cau-vim-900ml',    name: 'Nước Tẩy Bồn Cầu Vim Aqua Plus 900ml',  slug: '/product-page/nuoc-tay-bon-cau-vim-900ml',    price: '35.000đ',  priceNumber: 35000,  category: 'Household', categoryVi: 'Tẩy rửa',      image: uns('1556911220-e15b29be8c8f'), description: 'Nước tẩy bồn cầu Vim diệt khuẩn 99.9%, loại cặn vôi và vi khuẩn gây mùi hiệu quả.',                                                quantity: '1 Chai',   weight: '900ml' }),
  base({ id: 'nuoc-lau-san-gift-18l',         name: 'Nước Lau Sàn Gift Hương Lavender 1.8L',  slug: '/product-page/nuoc-lau-san-gift-18l',         price: '55.000đ',  priceNumber: 55000,  category: 'Household', categoryVi: 'Tẩy rửa',      image: uns('1556911220-e15b29be8c8f'), description: 'Nước lau sàn Gift khử mùi kháng khuẩn hương lavender, an toàn cho trẻ nhỏ và thú cưng.',                                            quantity: '1 Chai',   weight: '1800ml', sizeGroup: 'Large' }),
  base({ id: 'tui-zip-ziploc-20',             name: 'Túi Zip Bảo Quản Thực Phẩm Ziploc 20 Túi',slug: '/product-page/tui-zip-ziploc-20',            price: '42.000đ',  priceNumber: 42000,  category: 'Household', categoryVi: 'Bếp & bảo quản',image: uns('1556911220-e15b29be8c8f'), description: 'Túi zip Ziploc khoá chặt, ngăn mùi và ẩm, bảo quản thực phẩm tươi lâu hơn trong tủ lạnh.',                                    quantity: '20 Túi',   weight: '200g' }),
  base({ id: 'mang-boc-glad-30m',             name: 'Màng Bọc Thực Phẩm Glad 30m',            slug: '/product-page/mang-boc-glad-30m',             price: '38.000đ',  priceNumber: 38000,  category: 'Household', categoryVi: 'Bếp & bảo quản',image: uns('1556911220-e15b29be8c8f'), description: 'Màng bọc thực phẩm Glad trong suốt, bám dính tốt, an toàn thực phẩm, dùng cho lò vi sóng.',                                     quantity: '1 Cuộn',   weight: '150g',   sizeGroup: 'Small' }),
  base({ id: 'nuoc-rua-tay-lifebuoy-500ml',   name: 'Nước Rửa Tay Bọt Lifebuoy 500ml',        slug: '/product-page/nuoc-rua-tay-lifebuoy-500ml',   price: '52.000đ',  priceNumber: 52000,  category: 'Household', categoryVi: 'Tẩy rửa',      image: uns('1556911220-e15b29be8c8f'), description: 'Nước rửa tay bọt Lifebuoy diệt khuẩn, bọt mịn phủ đều lòng bàn tay, hương tươi mát dịu nhẹ.',                                    quantity: '1 Chai',   weight: '500ml' }),
  base({ id: 'giay-bep-scott-4-cuon',         name: 'Giấy Bếp Scott Drap 4 Cuộn',             slug: '/product-page/giay-bep-scott-4-cuon',         price: '48.000đ',  priceNumber: 48000,  category: 'Household', categoryVi: 'Bếp & bảo quản',image: uns('1584622264-7a920b3d73e3'), description: 'Giấy bếp Scott Drap 2 lớp thấm hút tốt, không xơ vải, thấm dầu mỡ và nước hiệu quả.',                                          quantity: '4 Cuộn',   weight: '400g' }),
  base({ id: 'nhang-muoi-raid-max-10',        name: 'Nhang Muỗi Raid Max 10 Khoanh',          slug: '/product-page/nhang-muoi-raid-max-10',        price: '28.000đ',  priceNumber: 28000,  category: 'Household', categoryVi: 'Khác',          image: uns('1556911220-e15b29be8c8f'), description: 'Nhang muỗi Raid Max tác dụng 8 tiếng, khói nhẹ không gây kích ứng hô hấp, phù hợp dùng ngoài trời.',                               quantity: '10 Khoanh',weight: '100g',   sizeGroup: 'Small' }),
  base({ id: 'tui-rac-eco-green-20',          name: 'Túi Rác Tự Huỷ Eco Green 60L×20 Túi',   slug: '/product-page/tui-rac-eco-green-20',          price: '35.000đ',  priceNumber: 35000,  category: 'Household', categoryVi: 'Khác',          image: uns('1556911220-e15b29be8c8f'), description: 'Túi rác tự hủy sinh học Eco Green, thân thiện môi trường, chịu tải 15kg, không rò rỉ.',                                            quantity: '20 Túi',   weight: '300g' }),
];

// ── Tổng hợp ──────────────────────────────────────────
export const products: XanhLaProduct[] = [
  ...vegetableProducts,
  ...fruitProducts,
  ...meatProducts,
  ...seafoodProducts,
  ...dairyProducts,
  ...beverageProducts,
  ...bakeryProducts,
  ...pantryProducts,
  ...personalProducts,
  ...householdProducts,
];

// backward-compat alias (ordering page dùng)
export const onlineOrderProducts: XanhLaProduct[] = products;

// ── Meals / Nutrition ─────────────────────────────────
export const meals: XanhLaMeal[] = [
  { name: 'Cá hồi áp chảo',       nutrition: 'Protein: 35g | Omega-3: Cao | Chất xơ: 8g',            image: wixMedia('0d1a41_2ae592d0454a4199aa6c385bb17bd28b~mv2.jpg') },
  { name: 'Canh bắp cải xanh',    nutrition: 'Chất xơ: 12g | Vitamin C: Cao | Canxi: Trung bình',    image: wixMedia('0d1a41_1190de4761734794b7c68a8600061756~mv2.jpg') },
  { name: 'Trứng sốt cà chua',    nutrition: 'Protein: 15g | Chất xơ: 3g | Vitamin B12: Cao',        image: wixMedia('0d1a41_0ae3ff9196dd4a77a38f997e89fb70a1~mv2.jpg') },
];

export const nutritionGoals: XanhLaNutritionGoal[] = [
  { name: 'Protein & Omega-3', image: wixMedia('0d1a41_c05ecdabc2de426a94b70508e1fbb112~mv2.jpg') },
  { name: 'Chất xơ & Vitamin', image: wixMedia('0d1a41_4b92291ebd874983837b9485ef05d88c~mv2.jpg') },
  { name: 'Canxi & Sắt',       image: wixMedia('0d1a41_a2f9e25456e84ebd9ed97667066c1ae2~mv2.jpg') },
];

export const heroImage   = wixMedia('0d1a41_326f7b43d4384788b80419eec1c06d4c~mv2.jpg');
export const originImage = wixMedia('0d1a41_e80826e064234798b2e978dd32fbea9b~mv2.jpg');
export const logoImage   = wixMedia('0d1a41_99cbfe9e9ab04d228185d68d4a866f7f~mv2.png');

export const navItems: NavItem[] = [
  { label: 'Trang chủ',       path: '/' },
  { label: 'Đặt hàng',        path: '/online-ordering' },
  { label: 'Dinh dưỡng TM',   path: '/nutrition' },
  { label: 'Nấu gì hôm nay?', path: '/cook-with-what-you-have' },
  { label: 'Sự kiện',         path: '/event-list' },
  { label: 'Đặt lịch',        path: '/book-online' },
];

export const FILTER_FACETS = {
  categories:  ['Vegetables', 'Fruits', 'Meat', 'Seafood', 'Dairy', 'Beverages', 'Bakery', 'Pantry', 'Personal', 'Household'],
  container:   ['Bulk', 'Clamshell', 'Pint Basket'],
  cutType:     ['Pre-chopped', 'Whole Leaves'],
  cutting:     ['Diced', 'Sliced', 'Whole Breast'],
  packSize:    ['Family Pack', 'Single Pack'],
  packaging:   ['Quad Pack', 'Twin Pack'],
  preparation: ['Marinated', 'Raw'],
  ripeness:    ['Ready to Eat', 'Slightly Firm'],
  sizeGroup:   ['Large', 'Medium', 'Small'],
  thickness:   ['1 Inch', '1.5 Inches'],
  type:        ['Dried', 'Fresh'],
  weight:      ['200g', '250g', '300g', '500g', '1000g'],
};

export const eventsList: EventItem[] = [
  {
    id: 'xanh-la-fresh-food-festival', name: 'Xanh Lá Fresh Food Festival',
    slug: '/event-details/xanh-la-fresh-food-festival',
    date: 'Thứ 5, 22 thg 10', time: '14:01 – 16:01', location: 'Festival Center',
    description: 'Trải nghiệm lễ hội thực phẩm tươi với nhà cung cấp địa phương, trình diễn nấu ăn và hoạt động tương tác cho mọi lứa tuổi.',
    action: 'Mua vé', image: meals[1].image,
  },
  {
    id: 'fresh-ingredients-cooking-workshop', name: 'Fresh Ingredients Cooking Workshop',
    slug: '/event-details/fresh-ingredients-cooking-workshop',
    date: 'Thứ 5, 22 thg 10', time: '14:01 – 16:01', location: 'Xanh Lá Headquarters',
    description: 'Tham gia workshop cùng chuyên gia để nấu ăn với nguyên liệu tươi, kết hợp mẹo dinh dưỡng và ý tưởng công thức sáng tạo.',
    action: 'Trả lời', image: meals[0].image,
  },
  {
    id: 'nutrition-and-wellness-conference', name: 'Nutrition and Wellness Conference',
    slug: '/event-details/nutrition-and-wellness-conference',
    date: 'Thứ 5, 22 thg 10', time: '14:01 – 16:01', location: 'Healthy Living Institute',
    description: 'Khám phá vai trò của thực phẩm tươi với sức khỏe qua những buổi trò chuyện dinh dưỡng, hoạt động thực hành và tư vấn cá nhân.',
    action: 'Trả lời', image: nutritionGoals[0].image,
  },
];

export const servicesList: ServiceItem[] = [
  {
    id: 'meal-prep-course',   name: 'Meal Prep Course',   slug: '/service-page/meal-prep-course',
    subtitle: 'Master the art of meal prepping', price: '1.200.000đ', status: 'Đã kết thúc', action: 'Xem khóa học',
    description: 'Học kỹ thuật chuẩn bị thực phẩm tươi cho cả tuần để tiết kiệm thời gian, tối ưu dưỡng chất và ăn uống lành mạnh hơn.',
  },
  {
    id: 'nutrition-planning', name: 'Nutrition Planning', slug: '/service-page/nutrition-planning',
    subtitle: 'Plan your meals for nutrition goals', price: '500.000đ', status: '', action: 'Đặt ngay',
    description: 'Buổi tư vấn 1-1 với chuyên gia dinh dưỡng để xây dựng chế độ ăn cân bằng dựa trên mục tiêu thể trạng.',
  },
  {
    id: 'cooking-class',      name: 'Cooking Class',      slug: '/service-page/cooking-class',
    subtitle: 'Cook delicious meals from scratch', price: '700.000đ', status: 'Đang tải ngày...', action: 'Đặt ngay',
    description: 'Tham gia lớp học nấu ăn thực hành từ nguyên liệu tươi hữu cơ. Khám phá kỹ thuật chế biến giữ trọn vitamin.',
  },
];

// ── Slug lookup maps ──────────────────────────────────
export const productBySlug: Record<string, XanhLaProduct> = products.reduce(
  (acc, prod) => {
    acc[prod.slug] = prod;
    acc[prod.slug.replace(/^\/product-page\//, '')] = prod;
    return acc;
  },
  {} as Record<string, XanhLaProduct>
);

export const eventBySlug: Record<string, EventItem> = eventsList.reduce(
  (acc, evt) => {
    acc[evt.slug] = evt;
    acc[evt.slug.replace(/^\/event-details\//, '')] = evt;
    return acc;
  },
  {} as Record<string, EventItem>
);

export const serviceBySlug: Record<string, ServiceItem> = servicesList.reduce(
  (acc, svc) => {
    acc[svc.slug] = svc;
    acc[svc.slug.replace(/^\/service-page\//, '')] = svc;
    return acc;
  },
  {} as Record<string, ServiceItem>
);
