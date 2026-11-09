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
    image: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=800&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=800&q=80',
      'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800&q=80',
      'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&q=80',
    ],
    description: 'Cá hồi Na Uy fillet tươi áp chảo xém vàng thơm bơ tỏi, kèm cải thìa baby giòn ngọt và cà chua bi tươi mát.',
    prepTime: '10 phút',
    cookTime: '10 phút',
    difficulty: 'Dễ nấu',
    calories: 460,
    macros: {
      protein: '36g',
      carbs: '14g',
      fat: '22g',
      fiber: '6g',
      vitamins: 'Omega-3, Vitamin D, B12, Vitamin C, Canxi',
    },
    servingBase: 1,
    nutritionNote: 'Giàu đạm nạc chất lượng cao, axit béo Omega-3 tốt cho tim mạch và chất xơ tự nhiên.',
    chefTips: 'Thấm thật khô mặt da cá hồi trước khi áp chảo và đặt mặt da xuống trước để da cá giòn rụm mà thịt bên trong vẫn mềm mọng.',
    steps: [
      { stepNumber: 1, title: 'Sơ chế cá hồi & rau củ', detail: 'Thấm khô miếng cá hồi Na Uy bằng khăn giấy, ướp nhẹ với chút muối hồng và tiêu đen trong 5 phút. Cải thìa baby và cà chua bi rửa sạch, để ráo.' },
      { stepNumber: 2, title: 'Áp chảo cá hồi da giòn', detail: 'Làm nóng chảo với 1 thìa dầu ô liu, đặt mặt da cá hồi xuống áp chảo ở lửa vừa 4 phút cho da vàng giòn, lật mặt áp thêm 2 phút cùng 1 tép tỏi đập dập.' },
      { stepNumber: 3, title: 'Xào nhanh cải thìa & cà chua bi', detail: 'Dùng chính chiếc chảo đó cho cải thìa baby và cà chua bi cắt đôi vào đảo nhanh 2 phút trên lửa lớn để rau giữ màu xanh mướt và độ giòn.' },
      { stepNumber: 4, title: 'Trình bày & Thưởng thức', detail: 'Xếp cải thìa và cà chua bi ra đĩa, đặt miếng cá hồi áp chảo lên trên, rưới nước sốt chanh dây hoặc bơ tỏi và thưởng thức nóng.' },
    ],
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
    image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80',
      'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80',
      'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&q=80',
    ],
    description: 'Thịt gà ta nướng thảo mộc xé phay, trộn cùng cà chua bi Đà Lạt chín mọng và ớt chuông 3 màu giòn ngọt.',
    prepTime: '10 phút',
    cookTime: '15 phút',
    difficulty: 'Dễ nấu',
    calories: 340,
    macros: {
      protein: '32g',
      carbs: '18g',
      fat: '10g',
      fiber: '9g',
      vitamins: 'Vitamin C, Vitamin A, B6, Kẽm, Kali',
    },
    servingBase: 1,
    nutritionNote: 'Cung cấp nguồn protein nạc ít béo, dồi dào chất xơ và vitamin C giúp giữ dáng, thanh lọc cơ thể.',
    chefTips: 'Ngâm ớt chuông và cà chua bi vào nước mát 5 phút trước khi trộn sẽ giúp rau củ giòn ngọt hơn gấp đôi.',
    steps: [
      { stepNumber: 1, title: 'Ướp & Nướng thịt gà thảo mộc', detail: 'Thịt gà rửa sạch, ướp cùng chút muối, tiêu, lá hương thảo và mật ong rồi nướng hoặc áp chảo chín vàng 2 mặt (khoảng 12 phút), sau đó thái lát vừa ăn.' },
      { stepNumber: 2, title: 'Sơ chế rau củ Đà Lạt', detail: 'Ớt chuông 3 màu bỏ hạt, thái sợi dài. Cà chua bi Đà Lạt rửa sạch, bổ đôi.' },
      { stepNumber: 3, title: 'Pha sốt trộn Eat Clean', detail: 'Khuấy đều 2 thìa dầu ô liu, 1 thìa nước cốt chanh tươi, 1 thìa mật ong và một chút muối tiêu.' },
      { stepNumber: 4, title: 'Trộn salad & Thưởng thức', detail: 'Cho rau củ vào tô lớn, rưới nước sốt trộn đều, xếp thịt gà nướng lên trên và dùng ngay.' },
    ],
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
    image: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=800&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1547592180-85f173990554?w=800&q=80',
      'https://images.unsplash.com/photo-1544025162-d76694265947?w=800&q=80',
    ],
    description: 'Cải xanh Đà Lạt tươi giòn nấu cùng thịt bò Mỹ ngọt mềm và cà rốt baby Đà Lạt thanh mát, ấm bụng.',
    prepTime: '10 phút',
    cookTime: '15 phút',
    difficulty: 'Dễ nấu',
    calories: 380,
    macros: {
      protein: '29g',
      carbs: '20g',
      fat: '12g',
      fiber: '8g',
      vitamins: 'Sắt Heme, Vitamin A, K, C, Folate',
    },
    servingBase: 1,
    nutritionNote: 'Cung cấp sắt hữu cơ, đạm cao cấp, tiền chất vitamin A và chất xơ hỗ trợ hệ tiêu hoá.',
    chefTips: 'Cho một vài lát gừng tươi vào nồi nước canh và trụng thịt bò vừa chín tới ở bước cuối cùng để thịt bò mềm ngọt không bị dai.',
    steps: [
      { stepNumber: 1, title: 'Sơ chế thịt bò & rau củ', detail: 'Thịt bò bắp Mỹ thái lát mỏng ngang thớ, ướp chút gừng băm và hạt nêm. Cải xanh cắt khúc 4cm, cà rốt baby tỉa hoa cắt khoanh.' },
      { stepNumber: 2, title: 'Hầm ngọt nước cùng cà rốt', detail: 'Đun sôi 500ml nước cùng vài lát gừng, cho cà rốt baby vào nấu khoảng 5 phút cho tiết vị ngọt tự nhiên.' },
      { stepNumber: 3, title: 'Nấu cải xanh & thịt bò', detail: 'Cho phần cọng cải xanh vào trước 1 phút, tiếp tục cho lá cải và thịt bò vào khuấy nhẹ tay đến khi nước sôi bùng trở lại thì tắt bếp ngay.' },
      { stepNumber: 4, title: 'Múc ra tô & Dùng nóng', detail: 'Rắc thêm chút tiêu xay và hành ngò, dùng nóng với cơm trắng hoặc cơm gạo lứt.' },
    ],
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
    name: 'Sinh tố dâu tây, xoài cát & sữa chua Hy Lạp',
    image: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=800&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=800&q=80',
      'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=800&q=80',
      'https://images.unsplash.com/photo-1610970881699-44a5587cabec?w=800&q=80',
    ],
    description: 'Sự kết hợp tươi mát giữa dâu tây Đà Lạt mọng nước, xoài cát Hòa Lộc ngọt thơm và sữa chua Hy Lạp giàu lợi khuẩn Probiotics.',
    prepTime: '5 phút',
    cookTime: '5 phút',
    difficulty: 'Rất dễ',
    calories: 255,
    macros: {
      protein: '11g',
      carbs: '46g',
      fat: '3.5g',
      fiber: '7g',
      vitamins: 'Probiotics, Canxi, Vitamin C (150% DV), Vitamin A, E, Kali',
    },
    servingBase: 1,
    nutritionNote: 'Dồi dào vitamin C, lợi khuẩn Probiotics từ sữa chua Hy Lạp và chất xơ hòa tan giúp tốt tiêu hóa, đẹp da.',
    chefTips: 'Xay trái cây để lạnh cùng sữa chua Hy Lạp không đường giúp sinh tố sánh mịn mát lạnh mà không cần thêm đường hay sữa đặc.',
    steps: [
      { stepNumber: 1, title: 'Sơ chế trái cây tươi', detail: 'Dâu tây Đà Lạt bỏ cuống, rửa sạch với nước muối loãng, bổ đôi. Xoài cát Hòa Lộc gọt vỏ, cắt quân cờ.' },
      { stepNumber: 2, title: 'Xay lớp xoài sữa chua', detail: 'Xay nhuyễn xoài cát Hòa Lộc cùng 50g sữa chua Hy Lạp không đường rồi rót vào nửa dưới ly.' },
      { stepNumber: 3, title: 'Xay lớp dâu tây đỏ mọng', detail: 'Tiếp tục xay nhuyễn dâu tây Đà Lạt cùng 50g sữa chua Hy Lạp còn lại và rót lên trên lớp xoài tạo hiệu ứng phân tầng.' },
      { stepNumber: 4, title: 'Trang trí & Thưởng thức', detail: 'Điểm thêm vài lát dâu tây tươi trên mặt ly, thưởng thức ngay để hấp thu trọn vẹn vitamin và lợi khuẩn.' },
    ],
    goalsTags: ['vitamin', 'fiber', 'mineral', 'variety'],
    ingredients: [
      { name: 'Sữa Chua Hy Lạp Hữu Cơ Không Đường', amountPer1Serving: 100, unit: 'g' },
      { name: 'Dâu Tây Đà Lạt', amountPer1Serving: 150, unit: 'g' },
      { name: 'Xoài Cát Hòa Lộc', amountPer1Serving: 150, unit: 'g' },
    ],
    isActive: true,
  },
  {
    recipeId: 'ca-rot-xao-thit-ga',
    name: 'Gà xào nấm đông cô & cà rốt baby',
    image: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800&q=80',
      'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80',
    ],
    description: 'Thịt gà mềm thơm xào cùng nấm đông cô Đà Lạt và cà rốt baby thái lát, vị ngọt thanh tự nhiên.',
    prepTime: '10 phút',
    cookTime: '12 phút',
    difficulty: 'Dễ nấu',
    calories: 390,
    macros: {
      protein: '31g',
      carbs: '22g',
      fat: '13g',
      fiber: '7g',
      vitamins: 'Beta-Caroten (Vitamin A), Selen, Vitamin D, B3',
    },
    servingBase: 1,
    nutritionNote: 'Cực kỳ giàu beta-caroten (tiền vitamin A) sáng mắt, selen từ nấm và chất đạm phát triển cơ bắp.',
    chefTips: 'Xào cà rốt với một chút dầu ăn sẽ giúp cơ thể hấp thu tiền chất Vitamin A (tan trong dầu) hiệu quả hơn gấp 3 lần.',
    steps: [
      { stepNumber: 1, title: 'Sơ chế nguyên liệu', detail: 'Thịt gà lọc xương thái miếng vừa ăn. Nấm đông cô tươi cắt bỏ chân, khía chữ thập trên mũ nấm. Cà rốt baby thái lát xéo.' },
      { stepNumber: 2, title: 'Xào săn thịt gà', detail: 'Phi thơm hành tỏi với 1 thìa dầu ăn, cho thịt gà vào đảo lửa lớn 4 phút cho săn vàng.' },
      { stepNumber: 3, title: 'Xào nấm đông cô & cà rốt', detail: 'Cho cà rốt baby và nấm đông cô vào đảo chung, thêm 2 thìa nước lọc và đậy nắp 3 phút cho nấm và cà rốt chín mềm.' },
      { stepNumber: 4, title: 'Nêm nếm & Hoàn thiện', detail: 'Nêm chút dầu hào, hạt nêm vừa miệng, rắc hành lá và tiêu xay rồi bày ra đĩa.' },
    ],
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
    image: 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=800&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=800&q=80',
      'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&q=80',
    ],
    description: 'Tôm sú Cà Mau tươi sống hấp sả thơm lừng giữ trọn vị ngọt tự nhiên, dùng kèm rau cải ngọt luộc thanh đạm.',
    prepTime: '8 phút',
    cookTime: '10 phút',
    difficulty: 'Dễ nấu',
    calories: 320,
    macros: {
      protein: '34g',
      carbs: '12g',
      fat: '8g',
      fiber: '6g',
      vitamins: 'Canxi, Kẽm, I-ốt, Vitamin B12, Folate',
    },
    servingBase: 1,
    nutritionNote: 'Bổ sung canxi, kẽm, i-ốt và đạm biển dễ tiêu hóa cùng chất xơ xanh ít calo.',
    chefTips: 'Chỉ hấp tôm sú trong khoảng 5–6 phút tính từ lúc nước sôi để thịt tôm giòn ngọt, không bị khô xác.',
    steps: [
      { stepNumber: 1, title: 'Sơ chế tôm sú & sả tươi', detail: 'Tôm sú rửa sạch, rút chỉ lưng. Sả tươi Bến Tre đập dập, cắt khúc lót dưới đáy xửng hấp.' },
      { stepNumber: 2, title: 'Hấp tôm sú thơm lừng', detail: 'Xếp tôm sú lên lớp sả, hấp cách thủy 5–6 phút đến khi tôm chuyển màu đỏ gạch đẹp mắt.' },
      { stepNumber: 3, title: 'Luộc rau cải ngọt xanh mướt', detail: 'Đun sôi nước với vài hạt muối, cho cải ngọt vào luộc 2 phút rồi vớt ra đĩa.' },
      { stepNumber: 4, title: 'Thưởng thức', detail: 'Dùng tôm sú hấp sả kèm rau cải ngọt chấm muối tiêu chanh hoặc nước mắm nhĩ ớt tỏi.' },
    ],
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
    image: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1544025162-d76694265947?w=800&q=80',
      'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80',
    ],
    description: 'Thịt bò Mỹ mềm mọng áp chảo vừa chín tới, ăn kèm bông cải xanh Đà Lạt và cà rốt baby giữ trọn độ giòn ngọt.',
    prepTime: '10 phút',
    cookTime: '10 phút',
    difficulty: 'Dễ nấu',
    calories: 450,
    macros: {
      protein: '38g',
      carbs: '16g',
      fat: '20g',
      fiber: '8g',
      vitamins: 'Sắt, Kẽm, Vitamin K, Vitamin C, B12',
    },
    servingBase: 1,
    nutritionNote: 'Hàm lượng sắt heme, kẽm, vitamin K và protein cao giúp phục hồi cơ bắp nhanh chóng.',
    chefTips: 'Sau khi áp chảo bò, hãy để miếng thịt nghỉ trên đĩa ấm 3 phút trước khi cắt để nước ngọt phân bố đều bên trong thớ thịt.',
    steps: [
      { stepNumber: 1, title: 'Ướp thịt bò Mỹ', detail: 'Thấm khô thịt bò, rắc đều muối biển, tiêu đen xay thô và 1 thìa dầu ô liu lên 2 mặt thịt.' },
      { stepNumber: 2, title: 'Hấp bông cải xanh & cà rốt', detail: 'Tách bông cải xanh Đà Lạt thành nhánh vừa ăn, hấp cách thủy cùng cà rốt baby trong 4 phút để giữ trọn màu xanh và vitamin C.' },
      { stepNumber: 3, title: 'Áp chảo thịt bò', detail: 'Làm nóng chảo gang, áp chảo mỗi mặt thịt bò 2–3 phút cùng tỏi đập dập cho đến độ chín vừa ý.' },
      { stepNumber: 4, title: 'Cắt lát & Trình bày', detail: 'Để thịt bò nghỉ 3 phút rồi thái lát dày 1cm, xếp cạnh bông cải xanh và cà rốt hấp.' },
    ],
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
    image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80',
      'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=800&q=80',
    ],
    description: 'Bơ sáp béo ngậy kết hợp cá hồi Na Uy giàu Omega-3, xà lách thủy canh và cà chua bi thanh mát.',
    prepTime: '10 phút',
    cookTime: '5 phút',
    difficulty: 'Rất dễ',
    calories: 410,
    macros: {
      protein: '28g',
      carbs: '14g',
      fat: '24g',
      fiber: '9g',
      vitamins: 'Omega-3, Vitamin E, Vitamin C, Folate, Kali',
    },
    servingBase: 1,
    nutritionNote: 'Cung cấp chất béo không bão hòa đơn tốt cho tim mạch, vitamin E đẹp da và đạm tinh khiết.',
    chefTips: 'Vắt vài giọt nước cốt chanh lên phần bơ sáp vừa cắt để bơ luôn giữ màu xanh vàng tươi tắn, không bị thâm.',
    steps: [
      { stepNumber: 1, title: 'Áp chảo sơ cá hồi', detail: 'Cá hồi Na Uy cắt khối vuông 2cm, áp chảo nhanh 2 phút trên lửa lớn cho xém cạnh thơm lừng.' },
      { stepNumber: 2, title: 'Cắt bơ sáp & cà chua bi', detail: 'Bơ sáp Đắk Lắk lột vỏ, bỏ hạt, cắt miếng vuông vừa ăn. Cà chua bi Đà Lạt rửa sạch bổ đôi.' },
      { stepNumber: 3, title: 'Trộn sốt mè rang / chanh dây', detail: 'Cho cà chua bi và bơ sáp vào đĩa sâu lòng, xếp cá hồi lên trên và rưới sốt mè rang hoặc dầu ô liu chanh tươi.' },
      { stepNumber: 4, title: 'Thưởng thức', detail: 'Trộn nhẹ tay để bơ không bị nát và thưởng thức ngay.' },
    ],
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
    image: 'https://images.unsplash.com/photo-1476718406336-bb5a9690ee2a?w=800&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1476718406336-bb5a9690ee2a?w=800&q=80',
      'https://images.unsplash.com/photo-1547592180-85f173990554?w=800&q=80',
    ],
    description: 'Bí đỏ Đà Lạt dẻo bùi nấu nhuyễn cùng nấm đông cô thơm dịu và cà rốt baby, dễ tiêu hóa và ấm bụng.',
    prepTime: '10 phút',
    cookTime: '15 phút',
    difficulty: 'Dễ nấu',
    calories: 280,
    macros: {
      protein: '8g',
      carbs: '38g',
      fat: '7g',
      fiber: '10g',
      vitamins: 'Vitamin A (200% DV), Lutein, Vitamin C, Sắt, Magie',
    },
    servingBase: 1,
    nutritionNote: 'Dồi dào vitamin A, Lutein tốt cho thị lực, chất xơ hòa tan tốt cho dạ dày và giấc ngủ.',
    chefTips: 'Xào sơ bí đỏ và cà rốt với một chút bơ lạt trước khi hầm sẽ giúp món súp dậy mùi thơm béo tự nhiên.',
    steps: [
      { stepNumber: 1, title: 'Sơ chế bí đỏ & nấm đông cô', detail: 'Bí đỏ hồ lô Đà Lạt và cà rốt baby gọt vỏ, cắt miếng nhỏ. Nấm đông cô rửa sạch, thái lát mỏng.' },
      { stepNumber: 2, title: 'Hầm mềm bí đỏ & cà rốt', detail: 'Cho bí đỏ và cà rốt vào nồi cùng 350ml nước dùng rau củ, hầm nhỏ lửa 12 phút đến khi chín mềm rồi tán hoặc xay mịn.' },
      { stepNumber: 3, title: 'Nấu cùng nấm đông cô', detail: 'Đổ hỗn hợp súp bí đỏ trở lại nồi, thêm nấm đông cô thái lát vào đun sôi nhẹ 4 phút.' },
      { stepNumber: 4, title: 'Múc ra bát & Thưởng thức', detail: 'Nêm chút muối hồng và tiêu đen, múc ra bát dùng nóng rất tốt cho tiêu hóa.' },
    ],
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
    image: 'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=800&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=800&q=80',
      'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&q=80',
    ],
    description: 'Thịt heo thảo mộc ngọt thơm thái mỏng cuốn cùng cải xanh, xà lách và dưa leo hữu cơ thanh mát.',
    prepTime: '10 phút',
    cookTime: '15 phút',
    difficulty: 'Dễ nấu',
    calories: 410,
    macros: {
      protein: '30g',
      carbs: '16g',
      fat: '18g',
      fiber: '8g',
      vitamins: 'Vitamin B1, B6, B12, Kẽm, Vitamin K',
    },
    servingBase: 1,
    nutritionNote: 'Cân bằng hoàn hảo giữa đạm thịt sạch, vitamin nhóm B và lượng chất xơ dồi dào từ rau sống.',
    chefTips: 'Luộc thịt heo thảo mộc cùng 2 củ hành tím đập dập rồi ngâm qua nước sôi để nguội sẽ giúp thớ thịt trắng giòn, thái lát không bị vỡ.',
    steps: [
      { stepNumber: 1, title: 'Luộc thịt heo thảo mộc', detail: 'Cho thịt heo vào nồi nước lạnh cùng hành tím và 1/2 thìa muối, đun sôi nhỏ lửa 15 phút cho thịt chín mềm rồi vớt ra thái lát mỏng.' },
      { stepNumber: 2, title: 'Sơ chế rau cải xanh & dưa leo', detail: 'Cải xanh Đà Lạt rửa sạch từng bẹ, để ráo. Dưa leo baby rửa sạch, thái thanh dài.' },
      { stepNumber: 3, title: 'Cuốn thịt cùng rau củ', detail: 'Trải lá cải xanh, xếp thịt heo thảo mộc và dưa leo baby vào giữa rồi cuộn tròn vừa ăn.' },
      { stepNumber: 4, title: 'Chấm kèm nước mắm chua ngọt', detail: 'Thưởng thức cuốn thịt rau xanh thanh mát cùng nước mắm tỏi ớt chua ngọt.' },
    ],
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
    image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&q=80',
      'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80',
    ],
    description: 'Món chay thanh lọc cơ thể với nấm đông cô Đà Lạt xào cải thìa baby và ớt chuông ngọt tự nhiên.',
    prepTime: '8 phút',
    cookTime: '10 phút',
    difficulty: 'Dễ nấu',
    calories: 260,
    macros: {
      protein: '14g',
      carbs: '26g',
      fat: '8g',
      fiber: '11g',
      vitamins: 'Vitamin D, Vitamin C, Canxi, Sắt thực vật, Selen',
    },
    servingBase: 1,
    nutritionNote: 'Ít calo, không cholesterol, giàu chất chống oxy hóa Ergothioneine từ nấm và chất xơ xanh.',
    chefTips: 'Trụng sơ cải thìa baby trong nước sôi 30 giây trước khi xào giúp rau giữ màu xanh ngọc bích và giòn ngọt.',
    steps: [
      { stepNumber: 1, title: 'Sơ chế nấm & rau củ', detail: 'Nấm đông cô rửa sạch cắt đôi. Cải thìa baby chẻ đôi theo chiều dọc. Ớt chuông thái miếng vuông.' },
      { stepNumber: 2, title: 'Trụng sơ cải thìa', detail: 'Chần cải thìa baby trong nước sôi có pha chút dầu ăn 30 giây rồi vớt ra xếp quanh đĩa.' },
      { stepNumber: 3, title: 'Xào nấm đông cô & ớt chuông', detail: 'Phi thơm đầu hành, cho nấm đông cô và ớt chuông vào xào lửa lớn 4 phút cùng nước tương và dầu hào chay.' },
      { stepNumber: 4, title: 'Trình bày', detail: 'Múc phần nấm đông cô và ớt chuông sốt bóng mượt vào giữa đĩa cải thìa baby và dùng nóng.' },
    ],
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
    name: 'Nước ép Detox cam sành, dâu tây & cà rốt',
    image: 'https://images.unsplash.com/photo-1610970881699-44a5587cabec?w=800&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1610970881699-44a5587cabec?w=800&q=80',
      'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=800&q=80',
    ],
    description: 'Thức uống ép lạnh nguyên chất từ cam sành mọng nước, dâu tây Đà Lạt và cà rốt baby giàu vitamin.',
    prepTime: '5 phút',
    cookTime: '5 phút',
    difficulty: 'Rất dễ',
    calories: 195,
    macros: {
      protein: '3g',
      carbs: '42g',
      fat: '1g',
      fiber: '6g',
      vitamins: 'Vitamin C (180% DV), Beta-Caroten, Kali, Folate',
    },
    servingBase: 1,
    nutritionNote: 'Cung cấp 100% nhu cầu Vitamin C và Beta-Caroten mỗi ngày, hỗ trợ sáng da và tăng miễn dịch.',
    chefTips: 'Ép xen kẽ cà rốt baby và dâu tây, sau đó pha cùng nước cam sành vắt tươi để giữ trọn các tép cam và hương thơm tinh dầu vỏ cam.',
    steps: [
      { stepNumber: 1, title: 'Sơ chế nguyên liệu', detail: 'Cam sành Vĩnh Long rửa sạch, cắt đôi vắt lấy nước. Cà rốt baby và dâu tây Đà Lạt rửa sạch, cắt miếng vừa máy ép.' },
      { stepNumber: 2, title: 'Ép lạnh cà rốt & dâu tây', detail: 'Cho cà rốt baby và dâu tây vào máy ép chậm lấy nước cốt nguyên chất.' },
      { stepNumber: 3, title: 'Pha trộn cùng nước cam sành', detail: 'Hòa quyện nước ép cà rốt dâu tây với nước cam sành tươi, khuấy đều.' },
      { stepNumber: 4, title: 'Thưởng thức', detail: 'Thêm vài viên đá nhỏ và thưởng thức ngay sau bữa sáng hoặc sau buổi tập.' },
    ],
    goalsTags: ['vitamin', 'mineral', 'variety'],
    ingredients: [
      { name: 'Cam Sành Vĩnh Long', amountPer1Serving: 200, unit: 'g' },
      { name: 'Cà Rốt Baby Đà Lạt', amountPer1Serving: 120, unit: 'g' },
      { name: 'Dâu Tây Đà Lạt', amountPer1Serving: 80, unit: 'g' },
    ],
    isActive: true,
  },
  {
    recipeId: 'sua-chua-hy-lap-trai-cay',
    name: 'Bát sữa chua Hy Lạp trái cây tươi & bơ sáp (Yogurt Bowl)',
    image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=800&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=800&q=80',
      'https://images.unsplash.com/photo-1511690743698-d9d85f2fbf38?w=800&q=80',
      'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=800&q=80',
    ],
    description: 'Bữa ăn sáng hoặc bữa phụ Eat Clean tuyệt hảo với sữa chua Hy Lạp đặc sánh giàu lợi khuẩn Probiotics, ăn kèm dâu tây Đà Lạt, xoài cát và bơ sáp Đắk Lắk.',
    prepTime: '5 phút',
    cookTime: '0 phút (Ăn liền)',
    difficulty: 'Rất dễ',
    calories: 310,
    macros: {
      protein: '18g',
      carbs: '32g',
      fat: '11g',
      fiber: '8g',
      vitamins: 'Probiotics (10 tỷ lợi khuẩn), Canxi, Vitamin C, E, B12',
    },
    servingBase: 1,
    nutritionNote: 'Cung cấp hàng tỷ lợi khuẩn Probiotics hỗ trợ đường ruột khỏe mạnh, giàu đạm tự nhiên và Canxi từ sữa chua kết hợp chất béo tốt từ quả bơ.',
    chefTips: 'Ướp lạnh bát sứ 10 phút trước khi cho sữa chua Hy Lạp vào, xếp trái cây thành từng dải màu sắc để vừa đẹp mắt vừa giữ độ mát lạnh.',
    steps: [
      { stepNumber: 1, title: 'Chuẩn bị nền sữa chua Hy Lạp', detail: 'Múc 150g sữa chua Hy Lạp hữu cơ không đường ra bát sâu lòng, dùng muỗng dàn đều tạo bề mặt mịn.' },
      { stepNumber: 2, title: 'Cắt lát trái cây tươi Đà Lạt', detail: 'Dâu tây Đà Lạt rửa sạch cắt lát dọc. Xoài cát Hòa Lộc và bơ sáp Đắk Lắk gọt vỏ, thái miếng vừa ăn.' },
      { stepNumber: 3, title: 'Xếp topping lên bát sữa chua', detail: 'Xếp lần lượt dâu tây đỏ mọng, xoài vàng ươm và bơ sáp xanh mướt lên trên lớp sữa chua Hy Lạp.' },
      { stepNumber: 4, title: 'Thưởng thức bữa ăn lành mạnh', detail: 'Có thể rắc thêm hạt chia, hạnh nhân hoặc 1 thìa mật ong rừng và thưởng thức ngay.' },
    ],
    goalsTags: ['protein', 'vitamin', 'fiber', 'mineral', 'balance'],
    ingredients: [
      { name: 'Sữa Chua Hy Lạp Hữu Cơ Không Đường', amountPer1Serving: 150, unit: 'g' },
      { name: 'Dâu Tây Đà Lạt', amountPer1Serving: 100, unit: 'g' },
      { name: 'Xoài Cát Hòa Lộc', amountPer1Serving: 80, unit: 'g' },
      { name: 'Bơ Sáp Đắk Lắk', amountPer1Serving: 70, unit: 'g' },
    ],
    isActive: true,
  },
  {
    recipeId: 'salad-uc-ga-sot-sua-chua',
    name: 'Salad gà áp chảo & rau củ sốt sữa chua men sống',
    image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&q=80',
      'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=800&q=80',
      'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80',
    ],
    description: 'Thay thế sốt mayonnaise nhiều dầu mỡ bằng sốt sữa chua men sống Đà Lạt thanh mát, trộn cùng thịt gà áp chảo, dưa leo baby và cà chua bi.',
    prepTime: '10 phút',
    cookTime: '8 phút',
    difficulty: 'Dễ nấu',
    calories: 345,
    macros: {
      protein: '33g',
      carbs: '19g',
      fat: '9g',
      fiber: '7g',
      vitamins: 'Probiotics, Canxi, Vitamin C, Vitamin A, Kẽm',
    },
    servingBase: 1,
    nutritionNote: 'Giảm 70% lượng chất béo xấu nhờ sốt sữa chua tự nhiên, giúp nhẹ bụng, tốt tiêu hóa mà vẫn cung cấp 33g đạm chất lượng cao.',
    chefTips: 'Khuấy đều sữa chua men sống với 1 thìa nước cốt chanh vàng, 1/2 thìa dầu ô liu, chút muối hồng và tiêu đen để tạo nước sốt sánh mịn thơm ngậy.',
    steps: [
      { stepNumber: 1, title: 'Áp chảo thịt gà vàng thơm', detail: 'Thịt gà ướp muối tiêu, áp chảo mỗi mặt 4 phút đến khi chín mềm mọng nước rồi thái miếng vừa ăn.' },
      { stepNumber: 2, title: 'Sơ chế rau củ hữu cơ', detail: 'Dưa leo baby Đà Lạt thái lát giòn, cà chua bi bổ đôi, để ráo nước.' },
      { stepNumber: 3, title: 'Pha sốt sữa chua men sống', detail: 'Cho 100g sữa chua men sống Đà Lạt ra chén, thêm chút cốt chanh, muối hồng, tiêu đen và khuấy đều.' },
      { stepNumber: 4, title: 'Trộn salad & Thưởng thức', detail: 'Xếp rau củ và thịt gà áp chảo ra đĩa, rưới đều sốt sữa chua mát lạnh lên trên và dùng ngay.' },
    ],
    goalsTags: ['protein', 'fiber', 'mineral', 'balance'],
    ingredients: [
      { name: 'Sữa Chua Men Sống Đà Lạt Ít Đường', amountPer1Serving: 100, unit: 'g' },
      { name: 'Gà Ta Thả Vườn Nguyên Con', amountPer1Serving: 130, unit: 'g' },
      { name: 'Dưa Leo Baby Đà Lạt', amountPer1Serving: 100, unit: 'g' },
      { name: 'Cà Chua Bi Đà Lạt', amountPer1Serving: 80, unit: 'g' },
    ],
    isActive: true,
  },
];

const footerConfigData = {
  key: 'main',
  brandName: 'Evergreen Mart',
  brandDesc: 'Tự hào mang nông sản Việt đạt chuẩn VietGAP, GlobalGAP và Organic từ các nông trại xanh đến tận bàn ăn gia đình bạn mỗi ngày.',
  newsletterTitle: 'Bản tin dinh dưỡng & Ưu đãi Evergreen Mart',
  newsletterDesc: 'Đăng ký email để nhận ngay mã giảm giá 20%, gợi ý thực đơn dinh dưỡng mỗi tuần và thông báo Flash Sale nông sản mới thu hoạch.',
  copyrightText: '© 2026 Evergreen Mart — Nông Nghiệp Hữu Cơ & Dinh Dưỡng Thông Minh. Bảo lưu mọi quyền.',
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
    { label: '⭐ Tích điểm Evergreen Mart Club', route: '/loyalty' },
    { label: '🎟️ Ví Voucher của tôi', route: '/vouchers' },
  ],
  aboutLinks: [
    { label: 'Giới thiệu về Evergreen Mart (About)', policyKey: 'about' },
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
    { platform: 'facebook', label: 'Facebook Evergreen Mart', url: 'https://facebook.com' },
    { platform: 'instagram', label: 'Instagram Evergreen Mart', url: 'https://instagram.com' },
    { platform: 'youtube', label: 'YouTube Evergreen Mart', url: 'https://youtube.com' },
    { platform: 'zalo', label: 'Zalo OA Evergreen Mart', url: 'https://zalo.me' },
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
  let connectedToAtlas = false;
  try {
    try {
      await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
      connectedToAtlas = true;
      console.log('✅ Connected to MongoDB Atlas for seeding');
    } catch (atlasErr) {
      console.log('ℹ️ Atlas connection timed out or unavailable, falling back to Local MongoDB (127.0.0.1:27017/xanh-la)...');
      await mongoose.connect('mongodb://127.0.0.1:27017/xanh-la', { serverSelectionTimeoutMS: 5000 });
      console.log('✅ Connected to Local MongoDB for seeding');
    }

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

    // 3b. Upsert all 22 core recipe ingredient products in MongoDB with 100% accurate photos & fix any mismatched product images
    const Product = require('./models/Product');
    const coreIngredientProducts = [
      {
        name: 'Cá Hồi Na Uy Fillet Tươi',
        slug: 'ca-hoi-na-uy-fillet-tuoi',
        price: '165.000 ₫',
        priceNumber: 165000,
        image: 'https://images.unsplash.com/photo-1599084993091-1cb5c0721cc6?w=600&q=80',
        category: 'Thịt & Hải sản',
        categoryVi: 'Hải sản tươi sống',
        description: 'Cá hồi Na Uy phi lê tươi rói nhập khẩu đường hàng không, giàu axit béo Omega-3, DHA và Protein tinh khiết.',
        weight: 'Khay 250g',
        packSize: '250g',
        isActive: true,
        stock: 80,
      },
      {
        name: 'Bông Cải Xanh Đà Lạt',
        slug: 'bong-cai-xanh-da-lat',
        price: '28.000 ₫',
        priceNumber: 28000,
        image: 'https://images.unsplash.com/photo-1459411621453-7b03977f4bfc?w=600&q=80',
        category: 'Rau củ hữu cơ',
        categoryVi: 'Rau củ Đà Lạt',
        description: 'Bông cải xanh hữu cơ trồng tại nông trại Đà Lạt, búp chặt giòn ngọt, giàu chất xơ, Vitamin C và K.',
        weight: 'Búp 350g',
        packSize: '350g',
        isActive: true,
        stock: 120,
      },
      {
        name: 'Cà Rốt Baby Đà Lạt',
        slug: 'ca-rot-baby-da-lat',
        price: '22.000 ₫',
        priceNumber: 22000,
        image: 'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=600&q=80',
        category: 'Rau củ hữu cơ',
        categoryVi: 'Rau củ Đà Lạt',
        description: 'Cà rốt baby Đà Lạt củ nhỏ giòn ngọt, cực kỳ giàu Beta-Caroten (tiền Vitamin A) tốt cho mắt và làn da.',
        weight: 'Túi 400g',
        packSize: '400g',
        isActive: true,
        stock: 150,
      },
      {
        name: 'Gà Ta Thả Vườn Nguyên Con',
        slug: 'ga-ta-tha-vuon-nguyen-con',
        price: '95.000 ₫',
        priceNumber: 95000,
        image: 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=600&q=80',
        category: 'Thịt & Hải sản',
        categoryVi: 'Thịt gia cầm sạch',
        description: 'Thịt gà ta thả vườn săn chắc, ít mỡ, giàu đạm nạc chất lượng cao giúp phát triển cơ bắp và giữ dáng.',
        weight: 'Khay 500g',
        packSize: '500g',
        isActive: true,
        stock: 90,
      },
      {
        name: 'Dưa Leo Baby Đà Lạt',
        slug: 'dua-leo-baby-da-lat',
        price: '20.000 ₫',
        priceNumber: 20000,
        image: 'https://images.unsplash.com/photo-1449300079323-02e209d9d3a6?w=600&q=80',
        category: 'Rau củ hữu cơ',
        categoryVi: 'Rau củ Đà Lạt',
        description: 'Dưa leo baby hữu cơ vỏ mỏng, ruột đặc giòn mát, rất hợp ăn sống, trộn salad hoặc cuốn thịt.',
        weight: 'Túi 400g',
        packSize: '400g',
        isActive: true,
        stock: 140,
      },
      {
        name: 'Cà Chua Bi Đà Lạt',
        slug: 'ca-chua-bi-da-lat',
        price: '25.000 ₫',
        priceNumber: 25000,
        image: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600&q=80',
        category: 'Rau củ hữu cơ',
        categoryVi: 'Rau củ Đà Lạt',
        description: 'Cà chua bi đỏ mọng thu hoạch trong ngày, giàu Lycopene chống oxy hóa và Vitamin C tự nhiên.',
        weight: 'Hộp 350g',
        packSize: '350g',
        isActive: true,
        stock: 130,
      },
      {
        name: 'Thịt Bò Bắp Mỹ Nhập Khẩu',
        slug: 'thit-bo-bap-my-nhap-khau',
        price: '135.000 ₫',
        priceNumber: 135000,
        image: 'https://images.unsplash.com/photo-1603048297172-c92544798d5a?w=600&q=80',
        category: 'Thịt & Hải sản',
        categoryVi: 'Thịt bò nhập khẩu',
        description: 'Thịt bò Mỹ tươi mềm vân mỡ đều, giàu Sắt heme, Kẽm, Vitamin B12 và Protein phục hồi cơ bắp.',
        weight: 'Khay 300g',
        packSize: '300g',
        isActive: true,
        stock: 85,
      },
      {
        name: 'Cải Xanh Đà Lạt',
        slug: 'cai-xanh-da-lat',
        price: '18.000 ₫',
        priceNumber: 18000,
        image: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=600&q=80',
        category: 'Rau củ hữu cơ',
        categoryVi: 'Rau ăn lá hữu cơ',
        description: 'Cải xanh hữu cơ Đà Lạt lá non xanh mướt, giàu chất xơ, Folate và Vitamin K thanh nhiệt cơ thể.',
        weight: 'Bó 350g',
        packSize: '350g',
        isActive: true,
        stock: 160,
      },
      {
        name: 'Sữa Chua Hy Lạp Hữu Cơ Không Đường',
        slug: 'sua-chua-hy-lap-huu-co',
        price: '45.000 ₫',
        priceNumber: 45000,
        image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=600&q=80',
        category: 'Thực phẩm khô & Đồ uống',
        categoryVi: 'Sữa chua & Chế phẩm sữa hữu cơ',
        description: 'Sữa chua Hy Lạp hữu cơ lên men tự nhiên, đặc sánh gấp đôi, giàu đạm (Protein) và 10 tỷ lợi khuẩn Probiotics tốt cho hệ tiêu hóa.',
        weight: 'Hộp 250g',
        packSize: '250g',
        isActive: true,
        stock: 120,
      },
      {
        name: 'Sữa Chua Men Sống Đà Lạt Ít Đường',
        slug: 'sua-chua-men-song-da-lat',
        price: '32.000 ₫',
        priceNumber: 32000,
        image: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=600&q=80',
        category: 'Thực phẩm khô & Đồ uống',
        categoryVi: 'Sữa chua & Chế phẩm sữa hữu cơ',
        description: 'Sữa chua men sống từ nguồn sữa tươi cao nguyên Đà Lạt, vị chua thanh dịu nhẹ, rất hợp làm sốt salad hoặc ăn kèm trái cây.',
        weight: 'Lốc 4 hộp × 100g',
        packSize: '400g',
        isActive: true,
        stock: 150,
      },
      {
        name: 'Dâu Tây Đà Lạt',
        slug: 'dau-tay-da-lat',
        price: '85.000 ₫',
        priceNumber: 85000,
        image: 'https://images.unsplash.com/photo-1464965911861-746a04b4bca6?w=600&q=80',
        category: 'Trái cây tươi',
        categoryVi: 'Trái cây Đà Lạt',
        description: 'Dâu tây giống Nhật trồng nhà kính tại Đà Lạt, quả đỏ mọng thơm lừng, giàu Vitamin C và chất chống oxy hóa.',
        weight: 'Hộp 250g',
        packSize: '250g',
        isActive: true,
        stock: 100,
      },
      {
        name: 'Xoài Cát Hòa Lộc',
        slug: 'xoai-cat-hoa-loc',
        price: '55.000 ₫',
        priceNumber: 55000,
        image: 'https://images.unsplash.com/photo-1553279768-865429fa0078?w=600&q=80',
        category: 'Trái cây tươi',
        categoryVi: 'Trái cây miền Tây',
        description: 'Xoài cát Hòa Lộc chín cây thịt vàng ươm, ngọt thơm dẻo mịn, giàu Vitamin A, C và enzyme tiêu hóa tự nhiên.',
        weight: 'Trái 500g',
        packSize: '500g',
        isActive: true,
        stock: 110,
      },
      {
        name: 'Nấm Đông Cô Đà Lạt',
        slug: 'nam-dong-co-da-lat',
        price: '42.000 ₫',
        priceNumber: 42000,
        image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&q=80',
        category: 'Rau củ hữu cơ',
        categoryVi: 'Nấm tươi hữu cơ',
        description: 'Nấm đông cô tươi Đà Lạt mũ dày thơm ngọt, giàu đạm thực vật, Selen và Vitamin D tự nhiên.',
        weight: 'Khay 250g',
        packSize: '250g',
        isActive: true,
        stock: 110,
      },
      {
        name: 'Tôm Sú Tươi Sống Cà Mau',
        slug: 'tom-su-tuoi-song-ca-mau',
        price: '125.000 ₫',
        priceNumber: 125000,
        image: 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=600&q=80',
        category: 'Thịt & Hải sản',
        categoryVi: 'Hải sản tươi sống',
        description: 'Tôm sú sinh thái Cà Mau thịt săn ngọt, giàu Canxi, Kẽm, I-ốt và Protein biển ít béo.',
        weight: 'Khay 350g',
        packSize: '350g',
        isActive: true,
        stock: 95,
      },
      {
        name: 'Rau Cải Ngọt',
        slug: 'rau-cai-ngot-huu-co',
        price: '18.000 ₫',
        priceNumber: 18000,
        image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&q=80',
        category: 'Rau củ hữu cơ',
        categoryVi: 'Rau ăn lá hữu cơ',
        description: 'Rau cải ngọt VietGAP cọng non mềm ngọt, giàu chất xơ hòa tan, Canxi và Folate.',
        weight: 'Bó 350g',
        packSize: '350g',
        isActive: true,
        stock: 150,
      },
      {
        name: 'Sả Tươi Bến Tre',
        slug: 'sa-tuoi-ben-tre',
        price: '12.000 ₫',
        priceNumber: 12000,
        image: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=600&q=80',
        category: 'Rau củ hữu cơ',
        categoryVi: 'Rau gia vị',
        description: 'Sả cây tươi Bến Tre giàu tinh dầu Citral thơm nồng, giúp khử mùi tanh hải sản và làm ấm cơ thể.',
        weight: 'Bó 200g',
        packSize: '200g',
        isActive: true,
        stock: 200,
      },
      {
        name: 'Bơ Sáp Đắk Lắk',
        slug: 'bo-sap-dak-lak',
        price: '48.000 ₫',
        priceNumber: 48000,
        image: 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=600&q=80',
        category: 'Trái cây tươi',
        categoryVi: 'Trái cây Tây Nguyên',
        description: 'Bơ sáp Đắk Lắk cơm vàng dẻo quánh, giàu chất béo không bão hòa đơn (Omega-9), Vitamin E và Kali.',
        weight: 'Túi 500g',
        packSize: '500g',
        isActive: true,
        stock: 115,
      },
      {
        name: 'Bí Đỏ Hồ Lô Đà Lạt',
        slug: 'bi-do-ho-lo-da-lat',
        price: '24.000 ₫',
        priceNumber: 24000,
        image: 'https://images.unsplash.com/photo-1570586437263-ab629fccc818?w=600&q=80',
        category: 'Rau củ hữu cơ',
        categoryVi: 'Rau củ Đà Lạt',
        description: 'Bí đỏ hồ lô Đà Lạt dẻo bùi thơm ngậy, giàu Vitamin A, Lutein và chất xơ tốt cho thị lực và hệ tiêu hóa.',
        weight: 'Trái 600g',
        packSize: '600g',
        isActive: true,
        stock: 130,
      },
      {
        name: 'Thịt Ba Rọi Heo Thảo Mộc',
        slug: 'thit-ba-roi-heo-thao-moc',
        price: '88.000 ₫',
        priceNumber: 88000,
        image: 'https://images.unsplash.com/photo-1602470520998-f4a52199a3d6?w=600&q=80',
        category: 'Thịt & Hải sản',
        categoryVi: 'Thịt heo thảo mộc',
        description: 'Thịt heo chăn nuôi bằng thức ăn thảo mộc tự nhiên, thớ thịt thơm ngọt, giàu Vitamin nhóm B và Protein.',
        weight: 'Khay 350g',
        packSize: '350g',
        isActive: true,
        stock: 100,
      },
      {
        name: 'Cải Thìa Baby',
        slug: 'cai-thia-baby-da-lat',
        price: '20.000 ₫',
        priceNumber: 20000,
        image: 'https://images.unsplash.com/photo-1518843875459-f738682238a6?w=600&q=80',
        category: 'Rau củ hữu cơ',
        categoryVi: 'Rau ăn lá hữu cơ',
        description: 'Cải thìa baby Đà Lạt bẹ trắng xanh giòn ngọt, giàu Canxi thực vật, Vitamin C và chất xơ.',
        weight: 'Túi 350g',
        packSize: '350g',
        isActive: true,
        stock: 140,
      },
      {
        name: 'Ớt Chuông 3 Màu',
        slug: 'ot-chuong-3-mau-da-lat',
        price: '35.000 ₫',
        priceNumber: 35000,
        image: 'https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?w=600&q=80',
        category: 'Rau củ hữu cơ',
        categoryVi: 'Rau củ Đà Lạt',
        description: 'Bộ ớt chuông đỏ, vàng, xanh Đà Lạt giòn ngọt không hăng, hàm lượng Vitamin C gấp 3 lần cam.',
        weight: 'Túi 400g',
        packSize: '400g',
        isActive: true,
        stock: 120,
      },
      {
        name: 'Cam Sành Vĩnh Long',
        slug: 'cam-sanh-vinh-long',
        price: '36.000 ₫',
        priceNumber: 36000,
        image: 'https://images.unsplash.com/photo-1547514701-42782101795e?w=600&q=80',
        category: 'Trái cây tươi',
        categoryVi: 'Trái cây miền Tây',
        description: 'Cam sành Vĩnh Long vỏ xanh ruột vàng mọng nước, vị ngọt thanh giàu Vitamin C tăng cường đề kháng.',
        weight: 'Túi 1kg',
        packSize: '1kg',
        isActive: true,
        stock: 160,
      },
    ];
    for (const cp of coreIngredientProducts) {
      await Product.findOneAndUpdate({ slug: cp.slug }, { $set: cp }, { upsert: true, new: true });
      // Also update any existing product with the exact same name so its image is 100% accurate
      await Product.updateMany({ name: cp.name }, { $set: { image: cp.image, priceNumber: cp.priceNumber, price: cp.price } });
    }
    const brokenDomains = [
      'thumb.wikimedia.org',
      'goce.vn',
      'dalatfarm.net',
      'kangaroovietnam.vn',
      'dacsanmientay.org',
      'traicaytonyteo.com',
      'vcdn1-giadinh.vnecdn.net',
    ];
    const fallbackImages = [
      'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&q=80',
      'https://images.unsplash.com/photo-1518843875459-f738682238a6?w=600&q=80',
      'https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=600&q=80',
      'https://images.unsplash.com/photo-1597362925123-77861d3fbac7?w=600&q=80',
      'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=600&q=80',
      'https://images.unsplash.com/photo-1550258987-190a2d41a8ba?w=600&q=80',
    ];
    const allProds = await Product.find({}).lean();
    let fixedCount = 0;
    for (let i = 0; i < allProds.length; i++) {
      const p = allProds[i];
      const img = String(p.image || '');
      if (!img || brokenDomains.some(d => img.includes(d))) {
        const replacement = fallbackImages[i % fallbackImages.length];
        await Product.updateOne({ _id: p._id }, { $set: { image: replacement } });
        fixedCount++;
      }
    }
    if (fixedCount > 0) {
      console.log(`✅ Fixed ${fixedCount} broken product image URLs`);
    }

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

    if (connectedToAtlas) {
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
    }

    console.log('🎉 Seed completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed error:', err);
    process.exit(1);
  }
}

runSeed();
