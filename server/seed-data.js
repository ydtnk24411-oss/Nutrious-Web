require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const mongoose = require('mongoose');
const Voucher = require('./models/Voucher');
const Recipe = require('./models/Recipe');
const FooterConfig = require('./models/FooterConfig');

const START_DATE = new Date('2025-01-01T00:00:00.000Z');
const END_DATE = new Date('2027-12-31T23:59:59.000Z');

const vouchersData = [
  {
    code: 'WELCOME20',
    name: 'Ưu Đãi Thành Viên Mới - Giảm 20%',
    description: 'Chào mừng bạn đến với Xanh Lá! Giảm 20% (tối đa 50.000đ) cho mọi đơn hàng đầu tiên không giới hạn giá trị tối thiểu.',
    discountType: 'percentage',
    discountValue: 20,
    minOrderValue: 0,
    maxDiscountValue: 50000,
    usageLimit: 500,
    pointsRequired: 0,
    startDate: START_DATE,
    endDate: END_DATE,
    isActive: true,
  },
  {
    code: 'FREESHIP',
    name: 'Hỗ Trợ Phí Giao Hàng 30K',
    description: 'Giảm ngay 30.000đ chi phí vận chuyển xe lạnh trong ngày cho đơn hàng từ 100.000đ.',
    discountType: 'fixed',
    discountValue: 30000,
    minOrderValue: 100000,
    maxDiscountValue: 30000,
    usageLimit: 1000,
    pointsRequired: 0,
    startDate: START_DATE,
    endDate: END_DATE,
    isActive: true,
  },
  {
    code: 'XANHLA30',
    name: 'Deal Rau Củ Hữu Cơ Đà Lạt - Giảm 30%',
    description: 'Mua nông sản rau củ quả hữu cơ tươi thu hoạch trong ngày, giảm ngay 30% (tối đa 90.000đ) cho đơn từ 150.000đ.',
    discountType: 'percentage',
    discountValue: 30,
    minOrderValue: 150000,
    maxDiscountValue: 90000,
    usageLimit: 300,
    pointsRequired: 0,
    startDate: START_DATE,
    endDate: END_DATE,
    isActive: true,
  },
  {
    code: 'XANHLA20',
    name: 'Giảm 20% Trái Cây Tươi VietGAP & Nhập Khẩu',
    description: 'Áp dụng cho tất cả các loại trái cây tươi theo mùa và nhập khẩu đạt chuẩn VietGAP cho đơn từ 120.000đ.',
    discountType: 'percentage',
    discountValue: 20,
    minOrderValue: 120000,
    maxDiscountValue: 60000,
    usageLimit: 300,
    pointsRequired: 0,
    startDate: START_DATE,
    endDate: END_DATE,
    isActive: true,
  },
  {
    code: 'MORNING15',
    name: 'Deal Đi Chợ Sớm - Giảm 15% Mọi Đơn',
    description: 'Đặt rau củ thịt cá tươi sạch cho bữa cơm gia đình, giảm ngay 15% tối đa 45.000đ cho đơn từ 50.000đ.',
    discountType: 'percentage',
    discountValue: 15,
    minOrderValue: 50000,
    maxDiscountValue: 45000,
    usageLimit: 600,
    pointsRequired: 0,
    startDate: START_DATE,
    endDate: END_DATE,
    isActive: true,
  },
  {
    code: 'NUTRITION10',
    name: 'Combo Thực Đơn Dinh Dưỡng Thông Minh -10%',
    description: 'Giảm thêm 10% tối đa 40.000đ khi mua nguyên liệu theo gợi ý mâm cơm dinh dưỡng cho đơn từ 80.000đ.',
    discountType: 'percentage',
    discountValue: 10,
    minOrderValue: 80000,
    maxDiscountValue: 40000,
    usageLimit: 500,
    pointsRequired: 0,
    startDate: START_DATE,
    endDate: END_DATE,
    isActive: true,
  },
  {
    code: 'COMBO30',
    name: 'Combo Bữa Ăn Gia Đình Tiết Kiệm 30%',
    description: 'Giảm 30% tối đa 100.000đ khi mua trọn gói nguyên liệu combo gia đình cho đơn từ 250.000đ.',
    discountType: 'percentage',
    discountValue: 30,
    minOrderValue: 250000,
    maxDiscountValue: 100000,
    usageLimit: 200,
    pointsRequired: 0,
    startDate: START_DATE,
    endDate: END_DATE,
    isActive: true,
  },
  {
    code: 'WEEKEND50',
    name: 'Flash Sale Cuối Tuần Giảm 50K',
    description: 'Giảm trực tiếp 50.000đ cho đơn hàng nông sản tươi sạch từ 250.000đ dịp cuối tuần xanh.',
    discountType: 'fixed',
    discountValue: 50000,
    minOrderValue: 250000,
    maxDiscountValue: 50000,
    usageLimit: 300,
    pointsRequired: 0,
    startDate: START_DATE,
    endDate: END_DATE,
    isActive: true,
  },
  {
    code: 'MEAT25',
    name: 'Deal Thịt Sạch & Hải Sản Tươi Sống -25K',
    description: 'Giảm ngay 25.000đ cho đơn hàng có sản phẩm thịt heo thảo mộc, bò, gà thả vườn hoặc cá hồi từ 180.000đ.',
    discountType: 'fixed',
    discountValue: 25000,
    minOrderValue: 180000,
    maxDiscountValue: 25000,
    usageLimit: 400,
    pointsRequired: 0,
    startDate: START_DATE,
    endDate: END_DATE,
    isActive: true,
  },
  {
    code: 'DRY15',
    name: 'Ưu Đãi Thực Phẩm Khô, Hạt & Ngũ Cốc -15%',
    description: 'Giảm 15% tối đa 50.000đ cho các sản phẩm gạo hữu cơ, hạt dinh dưỡng, mật ong và gia vị tự nhiên từ 120.000đ.',
    discountType: 'percentage',
    discountValue: 15,
    minOrderValue: 120000,
    maxDiscountValue: 50000,
    usageLimit: 400,
    pointsRequired: 0,
    startDate: START_DATE,
    endDate: END_DATE,
    isActive: true,
  },
  {
    code: 'DRINK20',
    name: 'Deal Nước Ép Lạnh & Sữa Hạt Tự Nhiên -20K',
    description: 'Giảm trực tiếp 20.000đ cho đơn hàng từ 100.000đ khi mua kèm đồ uống lành mạnh, kombucha hoặc sữa hạt.',
    discountType: 'fixed',
    discountValue: 20000,
    minOrderValue: 100000,
    maxDiscountValue: 20000,
    usageLimit: 400,
    pointsRequired: 0,
    startDate: START_DATE,
    endDate: END_DATE,
    isActive: true,
  },
  {
    code: 'GREEN40',
    name: 'Thứ Tư Xanh Không Túi Nilon - Giảm 40K',
    description: 'Chung tay bảo vệ môi trường cùng Xanh Lá! Giảm ngay 40.000đ cho đơn hàng từ 200.000đ đóng gói túi sinh học.',
    discountType: 'fixed',
    discountValue: 40000,
    minOrderValue: 200000,
    maxDiscountValue: 40000,
    usageLimit: 350,
    pointsRequired: 0,
    startDate: START_DATE,
    endDate: END_DATE,
    isActive: true,
  },
  {
    code: 'GOLD15',
    name: 'Đặc Quyền Khách Hàng Thân Thiết -15%',
    description: 'Giảm 15% tối đa 75.000đ cho đơn hàng từ 200.000đ dành cho thành viên Xanh Lá Club.',
    discountType: 'percentage',
    discountValue: 15,
    minOrderValue: 200000,
    maxDiscountValue: 75000,
    usageLimit: 300,
    pointsRequired: 0,
    startDate: START_DATE,
    endDate: END_DATE,
    isActive: true,
  },
  {
    code: 'BIG500K',
    name: 'Đại Tiệc Nông Sản Đơn Lớn Giảm 80K',
    description: 'Giảm ngay 80.000đ cho đơn hàng thực phẩm sạch tích trữ cho cả tuần từ 450.000đ.',
    discountType: 'fixed',
    discountValue: 80000,
    minOrderValue: 450000,
    maxDiscountValue: 80000,
    usageLimit: 200,
    pointsRequired: 0,
    startDate: START_DATE,
    endDate: END_DATE,
    isActive: true,
  },
  {
    code: 'WELCOME50',
    name: 'Quà Tặng Bạn Mới Giảm 50K',
    description: 'Giảm trực tiếp 50.000đ cho đơn hàng từ 200.000đ dành cho khách hàng lần đầu trải nghiệm Xanh Lá.',
    discountType: 'fixed',
    discountValue: 50000,
    minOrderValue: 200000,
    maxDiscountValue: 50000,
    usageLimit: 500,
    pointsRequired: 0,
    startDate: START_DATE,
    endDate: END_DATE,
    isActive: true,
  },
];

const recipesData = [
  {
    recipeId: 'ca-hoi-ap-chao',
    name: 'Cá hồi áp chảo cải thìa baby',
    image: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=600&q=80',
    description: 'Cá hồi Na Uy fillet tươi áp chảo xém vàng thơm bơ tỏi, kèm cải thìa baby giòn ngọt và cà chua bi tươi mát.',
    prepTime: '20 phút',
    servingBase: 1,
    nutritionNote: 'Giàu đạm nạc chất lượng cao, axit béo Omega-3 tốt cho tim mạch và chất xơ tự nhiên.',
    goalsTags: ['protein', 'mineral', 'balance'],
    ingredients: [
      { name: 'Cá Hồi Na Uy Fillet Tươi', amountPer1Serving: 150, unit: 'g' },
      { name: 'Cải Thìa Baby', amountPer1Serving: 120, unit: 'g' },
      { name: 'Cà Chua Bi Đà Lạt', amountPer1Serving: 100, unit: 'g' },
    ],
    isActive: true,
  },
  {
    recipeId: 'salad-ga-nuong',
    name: 'Salad gà nướng rau củ Đà Lạt',
    image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=80',
    description: 'Thịt gà ta nướng thảo mộc xé phay, trộn cùng cà chua bi Đà Lạt chín mọng và ớt chuông 3 màu giòn ngọt.',
    prepTime: '25 phút',
    servingBase: 1,
    nutritionNote: 'Cung cấp nguồn protein nạc ít béo, dồi dào chất xơ và vitamin C giúp giữ dáng, thanh lọc cơ thể.',
    goalsTags: ['protein', 'fiber', 'vitamin', 'balance'],
    ingredients: [
      { name: 'Gà Ta Thả Vườn Nguyên Con', amountPer1Serving: 150, unit: 'g' },
      { name: 'Cà Chua Bi Đà Lạt', amountPer1Serving: 100, unit: 'g' },
      { name: 'Ớt Chuông 3 Màu', amountPer1Serving: 100, unit: 'g' },
    ],
    isActive: true,
  },
  {
    recipeId: 'canh-cai-xanh-thit-bo',
    name: 'Canh cải xanh thịt bò bắp Mỹ',
    image: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=600&q=80',
    description: 'Cải xanh Đà Lạt tươi giòn nấu cùng thịt bò Mỹ ngọt mềm và cà rốt baby Đà Lạt thanh mát, ấm bụng.',
    prepTime: '25 phút',
    servingBase: 1,
    nutritionNote: 'Cung cấp sắt hữu cơ, đạm cao cấp, tiền chất vitamin A và chất xơ hỗ trợ hệ tiêu hoá.',
    goalsTags: ['protein', 'fiber', 'mineral', 'balance'],
    ingredients: [
      { name: 'Thịt Bò Bắp Mỹ Nhập Khẩu', amountPer1Serving: 120, unit: 'g' },
      { name: 'Cải Xanh Đà Lạt', amountPer1Serving: 150, unit: 'g' },
      { name: 'Cà Rốt Baby Đà Lạt', amountPer1Serving: 80, unit: 'g' },
    ],
    isActive: true,
  },
  {
    recipeId: 'sinh-to-dau-xoai',
    name: 'Sinh tố dâu tây & xoài cát Hòa Lộc',
    image: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=600&q=80',
    description: 'Sự kết hợp tươi mát giữa dâu tây Đà Lạt mọng nước và xoài cát Hòa Lộc ngọt thơm tự nhiên, nạp nhanh vitamin.',
    prepTime: '10 phút',
    servingBase: 1,
    nutritionNote: 'Dồi dào vitamin C, chất chống oxy hóa tự nhiên và chất xơ hòa tan giúp tăng đề kháng, đẹp da.',
    goalsTags: ['vitamin', 'fiber', 'variety'],
    ingredients: [
      { name: 'Dâu Tây Đà Lạt', amountPer1Serving: 150, unit: 'g' },
      { name: 'Xoài Cát Hòa Lộc', amountPer1Serving: 150, unit: 'g' },
    ],
    isActive: true,
  },
  {
    recipeId: 'ca-rot-xao-thit-ga',
    name: 'Gà xào nấm đông cô & cà rốt baby',
    image: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=600&q=80',
    description: 'Thịt gà mềm thơm xào cùng nấm đông cô Đà Lạt và cà rốt baby thái lát, vị ngọt thanh tự nhiên.',
    prepTime: '20 phút',
    servingBase: 1,
    nutritionNote: 'Cực kỳ giàu beta-caroten (tiền vitamin A) sáng mắt, selen từ nấm và chất đạm phát triển cơ bắp.',
    goalsTags: ['protein', 'vitamin', 'variety'],
    ingredients: [
      { name: 'Gà Ta Thả Vườn Nguyên Con', amountPer1Serving: 140, unit: 'g' },
      { name: 'Nấm Đông Cô Đà Lạt', amountPer1Serving: 80, unit: 'g' },
      { name: 'Cà Rốt Baby Đà Lạt', amountPer1Serving: 100, unit: 'g' },
    ],
    isActive: true,
  },
  {
    recipeId: 'tom-su-hap-cai-ngot',
    name: 'Tôm sú hấp sả & rau cải ngọt',
    image: 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=600&q=80',
    description: 'Tôm sú Cà Mau tươi sống hấp sả thơm lừng giữ trọn vị ngọt tự nhiên, dùng kèm rau cải ngọt luộc thanh đạm.',
    prepTime: '15 phút',
    servingBase: 1,
    nutritionNote: 'Bổ sung canxi, kẽm, i-ốt và đạm biển dễ tiêu hóa cùng chất xơ xanh ít calo.',
    goalsTags: ['protein', 'mineral', 'fiber', 'balance'],
    ingredients: [
      { name: 'Tôm Sú Tươi Sống Cà Mau', amountPer1Serving: 150, unit: 'g' },
      { name: 'Rau Cải Ngọt', amountPer1Serving: 150, unit: 'g' },
      { name: 'Sả Tươi Bến Tre', amountPer1Serving: 30, unit: 'g' },
    ],
    isActive: true,
  },
  {
    recipeId: 'bo-ap-chao-bong-cai',
    name: 'Thăn bò Mỹ áp chảo & bông cải xanh hấp',
    image: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=600&q=80',
    description: 'Thịt bò Mỹ mềm mọng áp chảo vừa chín tới, ăn kèm bông cải xanh Đà Lạt và cà rốt baby giữ trọn độ giòn ngọt.',
    prepTime: '20 phút',
    servingBase: 1,
    nutritionNote: 'Hàm lượng sắt heme, kẽm, vitamin K và protein cao giúp phục hồi cơ bắp nhanh chóng.',
    goalsTags: ['protein', 'mineral', 'fiber', 'balance'],
    ingredients: [
      { name: 'Thịt Bò Bắp Mỹ Nhập Khẩu', amountPer1Serving: 150, unit: 'g' },
      { name: 'Bông Cải Xanh Đà Lạt', amountPer1Serving: 150, unit: 'g' },
      { name: 'Cà Rốt Baby Đà Lạt', amountPer1Serving: 80, unit: 'g' },
    ],
    isActive: true,
  },
  {
    recipeId: 'salad-bo-ca-hoi',
    name: 'Salad bơ sáp Đắk Lắk & cá hồi tươi',
    image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&q=80',
    description: 'Bơ sáp béo ngậy kết hợp cá hồi Na Uy giàu Omega-3, xà lách thủy canh và cà chua bi thanh mát.',
    prepTime: '15 phút',
    servingBase: 1,
    nutritionNote: 'Cung cấp chất béo không bão hòa đơn tốt cho tim mạch, vitamin E đẹp da và đạm tinh khiết.',
    goalsTags: ['protein', 'vitamin', 'fiber', 'balance'],
    ingredients: [
      { name: 'Cá Hồi Na Uy Fillet Tươi', amountPer1Serving: 120, unit: 'g' },
      { name: 'Bơ Sáp Đắk Lắk', amountPer1Serving: 120, unit: 'g' },
      { name: 'Cà Chua Bi Đà Lạt', amountPer1Serving: 80, unit: 'g' },
    ],
    isActive: true,
  },
  {
    recipeId: 'sup-bi-do-hat-sen',
    name: 'Súp bí đỏ Đà Lạt hầm nấm đông cô',
    image: 'https://images.unsplash.com/photo-1476718406336-bb5a9690ee2a?w=600&q=80',
    description: 'Bí đỏ Đà Lạt dẻo bùi nấu nhuyễn cùng nấm đông cô thơm dịu và cà rốt baby, dễ tiêu hóa và ấm bụng.',
    prepTime: '25 phút',
    servingBase: 1,
    nutritionNote: 'Dồi dào vitamin A, Lutein tốt cho thị lực, chất xơ hòa tan tốt cho dạ dày và giấc ngủ.',
    goalsTags: ['vitamin', 'fiber', 'variety', 'balance'],
    ingredients: [
      { name: 'Bí Đỏ Hồ Lô Đà Lạt', amountPer1Serving: 200, unit: 'g' },
      { name: 'Nấm Đông Cô Đà Lạt', amountPer1Serving: 80, unit: 'g' },
      { name: 'Cà Rốt Baby Đà Lạt', amountPer1Serving: 60, unit: 'g' },
    ],
    isActive: true,
  },
  {
    recipeId: 'heo-thao-moc-cuon-rau',
    name: 'Thịt heo thảo mộc luộc cuốn rau xanh',
    image: 'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=600&q=80',
    description: 'Thịt heo thảo mộc ngọt thơm thái mỏng cuốn cùng cải xanh, xà lách và dưa leo hữu cơ thanh mát.',
    prepTime: '20 phút',
    servingBase: 1,
    nutritionNote: 'Cân bằng hoàn hảo giữa đạm thịt sạch, vitamin nhóm B và lượng chất xơ dồi dào từ rau sống.',
    goalsTags: ['protein', 'fiber', 'variety', 'balance'],
    ingredients: [
      { name: 'Thịt Ba Rọi Heo Thảo Mộc', amountPer1Serving: 140, unit: 'g' },
      { name: 'Cải Xanh Đà Lạt', amountPer1Serving: 120, unit: 'g' },
      { name: 'Dưa Leo Baby Đà Lạt', amountPer1Serving: 100, unit: 'g' },
    ],
    isActive: true,
  },
  {
    recipeId: 'dau-hu-sot-nam-chay',
    name: 'Nấm đông cô xào cải thìa & đậu hũ thanh đạm',
    image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&q=80',
    description: 'Món chay thanh lọc cơ thể với nấm đông cô Đà Lạt xào cải thìa baby và ớt chuông ngọt tự nhiên.',
    prepTime: '15 phút',
    servingBase: 1,
    nutritionNote: 'Ít calo, không cholesterol, giàu chất chống oxy hóa Ergothioneine từ nấm và chất xơ xanh.',
    goalsTags: ['fiber', 'vitamin', 'mineral', 'variety'],
    ingredients: [
      { name: 'Nấm Đông Cô Đà Lạt', amountPer1Serving: 120, unit: 'g' },
      { name: 'Cải Thìa Baby', amountPer1Serving: 150, unit: 'g' },
      { name: 'Ớt Chuông 3 Màu', amountPer1Serving: 80, unit: 'g' },
    ],
    isActive: true,
  },
  {
    recipeId: 'detox-cam-tao-ca-rot',
    name: 'Nước ép Detox cam sành, táo đỏ & cà rốt',
    image: 'https://images.unsplash.com/photo-1610970881699-44a5587cabec?w=600&q=80',
    description: 'Thức uống ép lạnh nguyên chất từ cam sành mọng nước, táo nhập khẩu và cà rốt baby Đà Lạt.',
    prepTime: '10 phút',
    servingBase: 1,
    nutritionNote: 'Cung cấp 100% nhu cầu Vitamin C và Beta-Caroten mỗi ngày, hỗ trợ sáng da và tăng miễn dịch.',
    goalsTags: ['vitamin', 'mineral', 'variety'],
    ingredients: [
      { name: 'Cam Sành Vĩnh Long', amountPer1Serving: 200, unit: 'g' },
      { name: 'Cà Rốt Baby Đà Lạt', amountPer1Serving: 120, unit: 'g' },
      { name: 'Dâu Tây Đà Lạt', amountPer1Serving: 80, unit: 'g' },
    ],
    isActive: true,
  },
];

const footerConfigData = {
  key: 'main',
  brandName: 'Xanh Lá',
  brandDesc: 'Tự hào mang nông sản Việt đạt chuẩn VietGAP, GlobalGAP và Organic từ các nông trại xanh đến tận bàn ăn gia đình bạn mỗi ngày.',
  newsletterTitle: 'Bản tin dinh dưỡng & Ưu đãi xanh',
  newsletterDesc: 'Đăng ký email để nhận ngay mã giảm giá 20%, gợi ý thực đơn dinh dưỡng mỗi tuần và thông báo Flash Sale nông sản mới thu hoạch.',
  copyrightText: '© 2026 Xanh Lá — Nông Nghiệp Hữu Cơ & Dinh Dưỡng Thông Minh. Bảo lưu mọi quyền.',
  contactInfo: {
    hotline: '1900 6789 (07:00 – 21:00)',
    email: 'chamsoc@xanhla.vn',
    address: 'Khu phố 6, Phường Linh Trung, TP. Thủ Đức, TP. Hồ Chí Minh',
  },
  trustItems: [
    { iconKey: 'leaf', title: '100% Hữu Cơ & VietGAP', subtitle: 'Nguồn gốc rõ ràng từ nông trại' },
    { iconKey: 'truck', title: 'Giao Nhanh Trong 2 Giờ', subtitle: 'Giữ trọn độ tươi ngon mỗi ngày' },
    { iconKey: 'shield', title: 'Đồng Kiểm Khi Nhận Hàng', subtitle: 'Đổi trả miễn phí trong 24 giờ' },
    { iconKey: 'headset', title: 'Hỗ Trợ Tận Tâm 24/7', subtitle: 'Hotline tư vấn: 1900 6789' },
  ],
  serviceLinks: [
    { label: 'Đặt hàng trực tuyến', route: '/online-ordering' },
    { label: 'Khuyến mãi & Deal nông sản', route: '/promotions' },
    { label: 'Kho Voucher giảm giá', route: '/vouchers' },
    { label: 'Lớp học nấu ăn xanh', route: '/book-online' },
    { label: 'Sự kiện & Workshop', route: '/event-list' },
  ],
  utilityLinks: [
    { label: '🥗 Dinh dưỡng thông minh', route: '/nutrition' },
    { label: '🍳 Nấu gì với đồ sẵn có?', route: '/cook-with-what-you-have' },
    { label: '📦 Theo dõi đơn hàng', route: '/tracker-page' },
    { label: '👤 Tài khoản của tôi', route: '/account' },
    { label: '⭐ Tích điểm Xanh Lá Club', route: '/loyalty' },
    { label: '🎟️ Ví Voucher của tôi', route: '/vouchers' },
  ],
  aboutLinks: [
    { label: 'Giới thiệu về Xanh Lá (About)', policyKey: 'about' },
    { label: 'Cẩm nang sống xanh', route: '/cam-nang' },
    { label: 'Câu hỏi thường gặp (FAQ)', policyKey: 'faq' },
    { label: 'Trung tâm hỗ trợ (Help)', policyKey: 'help' },
    { label: 'Liên hệ với chúng tôi', policyKey: 'contact' },
  ],
  policyLinks: [
    { label: 'Chính sách giao hàng & Đồng kiểm', policyKey: 'shipping', icon: 'truck' },
    { label: 'Chính sách đổi trả & Hoàn tiền', policyKey: 'returns', icon: 'refresh' },
    { label: 'Chính sách bảo mật thông tin', policyKey: 'privacy', icon: 'shield' },
    { label: 'Điều khoản sử dụng dịch vụ', policyKey: 'terms', icon: 'doc' },
    { label: 'Câu hỏi thường gặp (FAQ)', policyKey: 'faq', icon: 'help' },
    { label: 'Hướng dẫn đặt hàng & Thanh toán', policyKey: 'help', icon: 'info' },
  ],
  socialLinks: [
    { platform: 'facebook', label: 'Facebook Xanh Lá', url: 'https://facebook.com' },
    { platform: 'instagram', label: 'Instagram Xanh Lá', url: 'https://instagram.com' },
    { platform: 'youtube', label: 'YouTube Xanh Lá', url: 'https://youtube.com' },
    { platform: 'zalo', label: 'Zalo OA Xanh Lá', url: 'https://zalo.me' },
  ],
  paymentMethods: ['COD', 'VietQR', 'MoMo', 'VNPay', 'ZaloPay', 'Visa/Master'],
  policies: [
    {
      key: 'shipping',
      title: 'Chính Sách Giao Hàng & Đồng Kiểm',
      subtitle: 'Quy trình vận chuyển chuyên biệt bảo vệ độ tươi ngon của nông sản',
      updatedAt: '01/10/2026',
      sections: [
        {
          heading: '1. Phạm vi & Thời gian giao hàng',
          content: [
            'Giao hàng hỏa tốc trong 30 - 60 phút cho các quận nội thành TP. Hồ Chí Minh.',
            'Giao theo khung giờ hẹn trước (8h–11h, 14h–17h, 18h–20h) cho các khu vực lân cận.',
            'Phí giao hàng: Miễn phí cho đơn từ 200.000đ. Dưới 200.000đ: 20.000đ.',
          ],
        },
        {
          heading: '2. Bảo quản Cold-Chain trong suốt hành trình',
          content: [
            'Nông sản hữu cơ được đóng thùng giữ nhiệt kèm túi đá gel duy trì nhiệt độ 0°C – 4°C.',
            'Thịt, cá và hải sản được đóng gói chân không và bảo quản lạnh riêng biệt.',
          ],
        },
        {
          heading: '3. Quyền đồng kiểm khi nhận hàng',
          content: [
            'Quý khách được mở thùng kiểm tra số lượng và độ tươi trước khi thanh toán.',
            'Có quyền từ chối nhận hàng nếu sản phẩm không đạt chất lượng cam kết.',
            'Shipper sẽ chụp ảnh xác nhận giao hàng thành công và gửi qua Zalo/SMS.',
          ],
        },
      ],
    },
    {
      key: 'privacy',
      title: 'Chính Sách Bảo Mật Thông Tin Khách Hàng',
      subtitle: 'Cam kết bảo vệ tuyệt đối quyền riêng tư và dữ liệu cá nhân',
      updatedAt: '01/10/2026',
      sections: [
        {
          heading: '1. Mục đích thu thập dữ liệu',
          content: [
            'Chỉ thu thập thông tin để phục vụ xử lý và giao nhận đơn hàng (Họ tên, SĐT, Địa chỉ, Email).',
            'Dữ liệu dùng để cá nhân hóa trải nghiệm mua sắm và gợi ý sản phẩm phù hợp.',
          ],
        },
        {
          heading: '2. Cam kết bảo mật',
          content: [
            'Tuyệt đối KHÔNG chia sẻ hay thương mại hóa dữ liệu khách hàng cho bên thứ ba.',
            'Mã hóa toàn bộ giao dịch thanh toán trực tuyến bằng tiêu chuẩn SSL 256-bit.',
            'Máy chủ được bảo vệ bởi tường lửa và hệ thống giám sát 24/7.',
          ],
        },
        {
          heading: '3. Quyền của khách hàng',
          content: [
            'Có quyền yêu cầu xem, sửa hoặc xóa dữ liệu cá nhân bất kỳ lúc nào.',
            'Liên hệ: privacy@xanhla.vn để thực hiện các yêu cầu về dữ liệu.',
          ],
        },
      ],
    },
    {
      key: 'returns',
      title: 'Chính Sách Đổi Trả & Hoàn Tiền 100%',
      subtitle: 'Bảo hành chất lượng tươi sạch — An tâm tuyệt đối khi mua sắm',
      updatedAt: '01/10/2026',
      sections: [
        {
          heading: '1. Điều kiện áp dụng',
          content: [
            'Áp dụng trong vòng 24 giờ kể từ khi nhận hàng đối với rau củ quả, thịt cá tươi sống.',
            'Sản phẩm bị dập nát, héo úa, không đúng đơn đặt hàng hoặc hết hạn sử dụng.',
            'Chụp ảnh sản phẩm lỗi và gửi qua Zalo hoặc email để xác nhận.',
          ],
        },
        {
          heading: '2. Hình thức xử lý',
          content: [
            'Đổi mới 1:1 hỏa tốc trong 2 giờ hoặc hoàn tiền 100% qua chuyển khoản ngân hàng.',
            'Thời gian hoàn tiền: 1–3 ngày làm việc tùy ngân hàng.',
          ],
        },
        {
          heading: '3. Liên hệ đổi trả',
          content: [
            'Hotline: 1900 6789 (7h–21h mỗi ngày).',
            'Email: chamsoc@xanhla.vn',
            'Zalo OA: Xanh Lá Official',
          ],
        },
      ],
    },
    {
      key: 'terms',
      title: 'Điều Khoản Sử Dụng Dịch Vụ',
      subtitle: 'Quy định chung về việc sử dụng website và dịch vụ Xanh Lá',
      updatedAt: '01/10/2026',
      sections: [
        {
          heading: '1. Chấp thuận điều khoản',
          content: [
            'Khi sử dụng website Xanh Lá, bạn đồng ý tuân thủ các điều khoản và điều kiện này.',
            'Xanh Lá có quyền cập nhật điều khoản bất cứ lúc nào và sẽ thông báo trước 7 ngày.',
          ],
        },
        {
          heading: '2. Tài khoản người dùng',
          content: [
            'Bạn chịu trách nhiệm bảo mật thông tin đăng nhập và mọi hoạt động từ tài khoản của mình.',
            'Nghiêm cấm sử dụng tài khoản người khác hoặc tạo tài khoản ảo để gian lận.',
          ],
        },
        {
          heading: '3. Sử dụng hợp lệ',
          content: [
            'Nghiêm cấm sử dụng website cho mục đích bất hợp pháp hoặc gây hại đến hệ thống.',
            'Nội dung đánh giá sản phẩm phải trung thực và không vi phạm quyền sở hữu trí tuệ.',
          ],
        },
      ],
    },
    {
      key: 'about',
      title: 'Giới Thiệu Về Xanh Lá',
      subtitle: 'Nông sản hữu cơ tươi sạch & Trợ lý dinh dưỡng thông minh cho gia đình Việt',
      updatedAt: '01/10/2026',
      sections: [
        {
          heading: '1. Sứ mệnh của Xanh Lá',
          content: [
            'Kết nối trực tiếp nông trại hữu cơ Đà Lạt, miền Tây với bàn ăn gia đình Việt mỗi ngày.',
            'Ứng dụng công nghệ Dinh dưỡng thông minh giúp gợi ý thực đơn cân bằng vi chất và đi chợ nhanh chỉ với một chạm.',
          ],
        },
        {
          heading: '2. Cam kết chất lượng 3 Không',
          content: [
            'Không hóa chất bảo quản độc hại — kiểm định VietGAP / GlobalGAP định kỳ.',
            'Không thực phẩm tồn kho qua ngày — thu hoạch sáng sớm, giao nhanh trong 2 giờ.',
            'Không rủi ro mua sắm — đồng kiểm khi nhận hàng và hoàn tiền 100% nếu không hài lòng.',
          ],
        },
      ],
    },
    {
      key: 'faq',
      title: 'Câu Hỏi Thường Gặp (FAQ)',
      subtitle: 'Giải đáp nhanh các thắc mắc về đặt hàng, voucher và dinh dưỡng',
      updatedAt: '01/10/2026',
      sections: [
        {
          heading: '1. Làm sao để thu thập và sử dụng mã giảm giá (Voucher)?',
          content: [
            'Truy cập mục Khuyến mãi hoặc Ví Voucher để nhấn "Lưu vào ví" hoặc "Sao chép mã" các mã giảm giá đang mở.',
            'Tại trang Thanh toán (Checkout), chọn ưu đãi trực tiếp từ danh sách hoặc dán mã để hệ thống tự động trừ tiền.',
          ],
        },
        {
          heading: '2. Tính năng Dinh dưỡng thông minh hoạt động như thế nào?',
          content: [
            'Bạn chỉ cần chọn mục tiêu (Protein, Chất xơ, Vitamin...), số người ăn và ngân sách.',
            'Hệ thống sẽ gợi ý công thức phù hợp từ cơ sở dữ liệu và tự động khớp nguyên liệu đang bán tại cửa hàng để thêm vào giỏ.',
          ],
        },
        {
          heading: '3. Tôi có thể theo dõi trạng thái đơn hàng ở đâu?',
          content: [
            'Vào trang "Theo dõi đơn hàng" trên thanh điều hướng hoặc mục "Đơn hàng của tôi" trong Tài khoản.',
          ],
        },
      ],
    },
    {
      key: 'help',
      title: 'Trung Tâm Hỗ Trợ Khách Hàng',
      subtitle: 'Hướng dẫn mua sắm, thanh toán và chăm sóc khách hàng 24/7',
      updatedAt: '01/10/2026',
      sections: [
        {
          heading: '1. Hướng dẫn đặt hàng nhanh',
          content: [
            'Bước 1: Chọn sản phẩm tại Đặt hàng trực tuyến hoặc từ gợi ý Dinh dưỡng thông minh.',
            'Bước 2: Kiểm tra giỏ hàng, chọn khung giờ giao nhận và áp dụng Voucher / Điểm thưởng.',
            'Bước 3: Xác nhận thanh toán (COD, VietQR, MoMo, ZaloPay hoặc thẻ ngân hàng).',
          ],
        },
        {
          heading: '2. Hỗ trợ sự cố đơn hàng',
          content: [
            'Nếu đơn hàng giao trễ hoặc sản phẩm không đạt độ tươi, vui lòng gọi ngay Hotline 1900 6789.',
            'Đội ngũ CSKH Xanh Lá sẽ xử lý đổi mới hoặc hoàn tiền trong vòng 2 giờ.',
          ],
        },
      ],
    },
    {
      key: 'contact',
      title: 'Liên Hệ Với Chúng Tôi',
      subtitle: 'Kênh kết nối chính thức của Xanh Lá',
      updatedAt: '01/10/2026',
      sections: [
        {
          heading: '1. Thông tin liên hệ trực tiếp',
          content: [
            'Hotline CSKH: 1900 6789 (Hoạt động 7:00 – 21:00 tất cả các ngày).',
            'Email hỗ trợ: chamsoc@xanhla.vn | support@xanhla.vn',
            'Zalo Official Account: Xanh Lá Official',
          ],
        },
        {
          heading: '2. Địa chỉ văn phòng & Trung tâm phân phối',
          content: [
            'Văn phòng & Trung tâm phân phối: Khu phố 6, Phường Linh Trung, TP. Thủ Đức, TP. Hồ Chí Minh.',
          ],
        },
      ],
    },
  ],
};

async function runSeed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 4000 });
    console.log('✅ Connected to MongoDB Atlas for seeding');

    // 1. Upsert Vouchers
    for (const v of vouchersData) {
      await Voucher.findOneAndUpdate(
        { code: v.code },
        { $set: v },
        { upsert: true, new: true }
      );
    }
    await Voucher.updateMany(
      {},
      { $set: { startDate: START_DATE, endDate: END_DATE, isActive: true } }
    );
    const totalVouchers = await Voucher.countDocuments();
    console.log(`✅ Vouchers upserted & active: ${totalVouchers}`);

    // 2. Upsert Recipes (and remove any legacy docs missing recipeId)
    await Recipe.deleteMany({ $or: [{ recipeId: null }, { recipeId: { $exists: false } }] });
    for (const r of recipesData) {
      await Recipe.findOneAndUpdate(
        { recipeId: r.recipeId },
        { $set: r },
        { upsert: true, new: true }
      );
    }
    const totalRecipes = await Recipe.countDocuments();
    console.log(`✅ Recipes upserted: ${totalRecipes}`);

    // 3. Upsert FooterConfig
    await FooterConfig.findOneAndUpdate(
      { key: 'main' },
      { $set: footerConfigData },
      { upsert: true, new: true }
    );
    console.log('✅ FooterConfig upserted');

    // 4. Ensure UserVouchers exist for customer users in Atlas
    const User = require('./models/User');
    const UserVoucher = require('./models/UserVoucher');
    const customers = await User.find({ role: 'customer' }).lean();
    const allVouchers = await Voucher.find({}).lean();
    const vMap = new Map(allVouchers.map(v => [v.code, v]));
    for (const u of customers.slice(0, 3)) {
      for (const code of ['WELCOME20', 'FREESHIP', 'XANHLA30', 'NOV2026']) {
        const vDoc = vMap.get(code);
        if (vDoc) {
          await UserVoucher.findOneAndUpdate(
            { user: u._id, voucher: vDoc._id },
            { $setOnInsert: { user: u._id, voucher: vDoc._id, status: 'available', receivedAt: new Date() } },
            { upsert: true }
          );
        }
      }
    }

    // 5. Sync all collections from Atlas to Local MongoDB (mongodb://127.0.0.1:27017/xanh-la) if running locally
    const collectionsToSync = [
      'categories',
      'products',
      'users',
      'vouchers',
      'uservouchers',
      'recipes',
      'footerconfigs',
      'events',
      'services',
      'orders',
      'reviews',
      'bookings',
      'pointtransactions',
      'newslettersubscribers',
    ];
    const atlasData = {};
    for (const colName of collectionsToSync) {
      try {
        atlasData[colName] = await mongoose.connection.db.collection(colName).find({}).toArray();
      } catch (_) {
        atlasData[colName] = [];
      }
    }

    await mongoose.disconnect();

    try {
      const localUri = 'mongodb://127.0.0.1:27017/xanh-la';
      await mongoose.connect(localUri, { serverSelectionTimeoutMS: 3000 });
      console.log('✅ Connected to Local MongoDB (127.0.0.1:27017/xanh-la) — syncing data...');
      for (const colName of collectionsToSync) {
        const docs = atlasData[colName] || [];
        if (docs.length > 0) {
          const col = mongoose.connection.db.collection(colName);
          await col.deleteMany({});
          await col.insertMany(docs, { ordered: false });
          console.log(`  ↳ Synced ${docs.length} docs into local collection '${colName}'`);
        }
      }
      await mongoose.disconnect();
      console.log('✅ Local MongoDB sync completed!');
    } catch (localErr) {
      console.log('ℹ️ Local MongoDB not reachable or skipped:', localErr.message);
    }

    console.log('🎉 Seed completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed error:', err);
    process.exit(1);
  }
}

runSeed();
