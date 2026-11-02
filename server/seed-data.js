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
    name: 'Giảm 20% Đơn Đầu Tiên',
    description: 'Ưu đãi chào mừng khách hàng mới tại Xanh Lá. Giảm tối đa 50.000đ cho đơn từ 150.000đ.',
    discountType: 'percent',
    discountValue: 20,
    minOrderValue: 150000,
    maxDiscountValue: 50000,
    usageLimit: 500,
    pointsRequired: 0,
    startDate: START_DATE,
    endDate: END_DATE,
    isActive: true,
  },
  {
    code: 'FREESHIP',
    name: 'Miễn Phí Vận Chuyển 30K',
    description: 'Miễn phí giao hàng tối đa 30.000đ cho đơn hàng từ 250.000đ trên toàn hệ thống.',
    discountType: 'fixed',
    discountValue: 30000,
    minOrderValue: 250000,
    maxDiscountValue: 30000,
    usageLimit: 1000,
    pointsRequired: 0,
    startDate: START_DATE,
    endDate: END_DATE,
    isActive: true,
  },
  {
    code: 'XANHLA30',
    name: 'Combo Rau Củ Hữu Cơ - Giảm 30%',
    description: 'Mua từ 3 sản phẩm rau củ hữu cơ bất kỳ, giảm ngay 30% tổng giá trị đơn hàng (tối đa 90.000đ).',
    discountType: 'percent',
    discountValue: 30,
    minOrderValue: 200000,
    maxDiscountValue: 90000,
    usageLimit: 300,
    pointsRequired: 0,
    startDate: START_DATE,
    endDate: END_DATE,
    isActive: true,
  },
  {
    code: 'XANHLA20',
    name: 'Giảm 20% Trái Cây Nhập Khẩu',
    description: 'Áp dụng cho tất cả các loại trái cây nhập khẩu và nội địa đạt chuẩn VietGAP cho đơn từ 200.000đ.',
    discountType: 'percent',
    discountValue: 20,
    minOrderValue: 200000,
    maxDiscountValue: 60000,
    usageLimit: 300,
    pointsRequired: 0,
    startDate: START_DATE,
    endDate: END_DATE,
    isActive: true,
  },
  {
    code: 'WEEKEND50',
    name: 'Ưu Đãi Cuối Tuần Giảm 50K',
    description: 'Giảm trực tiếp 50.000đ cho đơn hàng từ 300.000đ dịp cuối tuần xanh.',
    discountType: 'fixed',
    discountValue: 50000,
    minOrderValue: 300000,
    maxDiscountValue: 50000,
    usageLimit: 300,
    pointsRequired: 0,
    startDate: START_DATE,
    endDate: END_DATE,
    isActive: true,
  },
  {
    code: 'NUTRITION10',
    name: 'Giảm 10% Thực Đơn Dinh Dưỡng',
    description: 'Giảm 10% tối đa 40.000đ khi mua nguyên liệu theo gợi ý mâm cơm dinh dưỡng cho đơn từ 120.000đ.',
    discountType: 'percent',
    discountValue: 10,
    minOrderValue: 120000,
    maxDiscountValue: 40000,
    usageLimit: 500,
    pointsRequired: 0,
    startDate: START_DATE,
    endDate: END_DATE,
    isActive: true,
  },
  {
    code: 'COMBO30',
    name: 'Combo Gia Đình Tiết Kiệm 30%',
    description: 'Giảm 30% tối đa 100.000đ cho đơn hàng combo gia đình từ 350.000đ.',
    discountType: 'percent',
    discountValue: 30,
    minOrderValue: 350000,
    maxDiscountValue: 100000,
    usageLimit: 200,
    pointsRequired: 0,
    startDate: START_DATE,
    endDate: END_DATE,
    isActive: true,
  },
  {
    code: 'MEAT25',
    name: 'Thịt Cá Tươi Sống Giảm 25K',
    description: 'Giảm ngay 25.000đ cho đơn hàng có sản phẩm thịt heo thảo mộc, bò hoặc cá hồi từ 200.000đ.',
    discountType: 'fixed',
    discountValue: 25000,
    minOrderValue: 200000,
    maxDiscountValue: 25000,
    usageLimit: 400,
    pointsRequired: 0,
    startDate: START_DATE,
    endDate: END_DATE,
    isActive: true,
  },
  {
    code: 'GOLD15',
    name: 'Đặc Quyền Thành Viên Giảm 15%',
    description: 'Giảm 15% tối đa 75.000đ cho đơn hàng từ 250.000đ dành cho khách hàng thân thiết.',
    discountType: 'percent',
    discountValue: 15,
    minOrderValue: 250000,
    maxDiscountValue: 75000,
    usageLimit: 300,
    pointsRequired: 0,
    startDate: START_DATE,
    endDate: END_DATE,
    isActive: true,
  },
  {
    code: 'BIRTHDAY30',
    name: 'Quà Sinh Nhật Xanh Lá - Giảm 30%',
    description: 'Ưu đãi mừng sinh nhật giảm 30% tối đa 80.000đ cho đơn hàng từ 200.000đ.',
    discountType: 'percent',
    discountValue: 30,
    minOrderValue: 200000,
    maxDiscountValue: 80000,
    usageLimit: 200,
    pointsRequired: 0,
    startDate: START_DATE,
    endDate: END_DATE,
    isActive: true,
  },
  {
    code: 'POINT100',
    name: 'Voucher Đổi Điểm Giảm 100K',
    description: 'Giảm trực tiếp 100.000đ cho đơn hàng từ 500.000đ.',
    discountType: 'fixed',
    discountValue: 100000,
    minOrderValue: 500000,
    maxDiscountValue: 100000,
    usageLimit: 200,
    pointsRequired: 0,
    startDate: START_DATE,
    endDate: END_DATE,
    isActive: true,
  },
  {
    code: 'BIG500K',
    name: 'Siêu Sale Đơn Lớn Giảm 80K',
    description: 'Giảm ngay 80.000đ cho đơn hàng thực phẩm sạch từ 500.000đ.',
    discountType: 'fixed',
    discountValue: 80000,
    minOrderValue: 500000,
    maxDiscountValue: 80000,
    usageLimit: 200,
    pointsRequired: 0,
    startDate: START_DATE,
    endDate: END_DATE,
    isActive: true,
  },
  {
    code: 'NOV2026',
    name: 'Lễ Hội Ẩm Thực Xanh Giảm 40K',
    description: 'Giảm 40.000đ cho đơn hàng từ 220.000đ nhân dịp tuần lễ sống xanh.',
    discountType: 'fixed',
    discountValue: 40000,
    minOrderValue: 220000,
    maxDiscountValue: 40000,
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
];

const footerConfigData = {
  key: 'main',
  brandName: 'Xanh Lá',
  brandDesc: 'Tự hào mang nông sản Việt đạt chuẩn VietGAP, GlobalGAP và Organic từ các nông trại xanh đến tận bàn ăn gia đình bạn mỗi ngày.',
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
  paymentMethods: ['COD', 'Momo', 'VNPay', 'Visa/Master'],
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
    await mongoose.connect(process.env.MONGODB_URI);
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

    // 2. Upsert Recipes
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

    await mongoose.disconnect();
    console.log('🎉 Seed completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed error:', err);
    process.exit(1);
  }
}

runSeed();
