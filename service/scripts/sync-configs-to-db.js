/**
 * Đẩy toàn bộ cấu hình / danh mục kiến thức trước đây từng hardcode trong các file .js
 * lên MongoDB (NutritionConfig, ChatbotKnowledge, LoyaltyConfig, FooterConfig, ShippingConfig, Conversation).
 *
 * Chạy: cd service && node scripts/sync-configs-to-db.js
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const mongoose = require('mongoose');
const NutritionConfig = require('../models/NutritionConfig');
const ChatbotKnowledge = require('../models/ChatbotKnowledge');
const LoyaltyConfig = require('../models/LoyaltyConfig');
const ShippingConfig = require('../models/ShippingConfig');
const Conversation = require('../models/Conversation');

const NUTRITION_CONFIG_DATA = {
  key: 'main',
  hero: {
    kicker: '🥗 Trợ Lý Thực Đơn Khoa Học - Dữ Liệu Trực Tuyến',
    title: 'Dinh dưỡng thông minh & Thực đơn chuẩn vị',
    subtitle:
      'Khám phá các gói thực đơn dinh dưỡng tiết kiệm, xem chi tiết công thức chế biến từng bước, bảng thành phần vi chất và thêm trọn bộ nguyên liệu tươi sạch vào giỏ hàng chỉ với một chạm.',
    bannerImage: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=800&h=520&fit=crop',
  },
  goals: [
    { id: 'protein', label: 'Bổ sung protein', icon: '🥩', unit: 'g', min: 0, max: 200, step: 5, default: 50 },
    { id: 'fiber', label: 'Bổ sung chất xơ', icon: '🥦', unit: 'g', min: 0, max: 50, step: 1, default: 10 },
    { id: 'vitamin', label: 'Bổ sung vitamin', icon: '🍊', unit: 'mg', min: 0, max: 500, step: 10, default: 50 },
    { id: 'mineral', label: 'Bổ sung khoáng chất', icon: '💊', unit: 'mg', min: 0, max: 1000, step: 50, default: 200 },
    { id: 'variety', label: 'Đa dạng thực phẩm', icon: '🌈', unit: '', min: 0, max: 0, step: 0, default: 0 },
    { id: 'balance', label: 'Bữa ăn cân bằng', icon: '⚖️', unit: '', min: 0, max: 0, step: 0, default: 0 },
  ],
  mealPlans: [
    {
      id: 'plan-eat-clean',
      name: 'Gói Eat Clean Giữ Dáng & Đẹp Da',
      image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=700&q=80',
      badge: 'Deal Thực Đơn -15%',
      discountPercent: 15,
      voucherCode: 'NUTRITION10',
      calories: '1.350 – 1.500 kcal/ngày',
      targetAudience: 'Phù hợp người giảm mỡ, giữ dáng, nhân viên văn phòng',
      description: 'Kết hợp Salad gà nướng Đà Lạt, Salad bơ cá hồi và Bát sữa chua Hy Lạp trái cây giàu lợi khuẩn Probiotics, ít tinh bột xấu.',
      goals: ['fiber', 'vitamin', 'balance'],
      servings: 2,
      mealsCount: 2,
      recipeIds: ['salad-ga-nuong', 'salad-bo-ca-hoi', 'sua-chua-hy-lap-trai-cay'],
    },
    {
      id: 'plan-high-protein',
      name: 'Gói Tăng Cơ & Phục Hồi Năng Lượng',
      image: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=700&q=80',
      badge: 'Deal Thực Đơn -20%',
      discountPercent: 20,
      voucherCode: 'COMBO30',
      calories: '1.800 – 2.100 kcal/ngày',
      targetAudience: 'Phù hợp người tập Gym, chơi thể thao, lao động cường độ cao',
      description: 'Bổ sung đạm chất lượng cao từ Cá hồi Na Uy áp chảo, Thăn bò Mỹ bông cải xanh và Tôm sú hấp sả.',
      goals: ['protein', 'mineral', 'balance'],
      servings: 2,
      mealsCount: 2,
      recipeIds: ['ca-hoi-ap-chao', 'bo-ap-chao-bong-cai', 'tom-su-hap-cai-ngot'],
    },
    {
      id: 'plan-family-balance',
      name: 'Gói Mâm Cơm Gia Đình Đủ Chất',
      image: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=700&q=80',
      badge: 'Deal Gia Đình -18%',
      discountPercent: 18,
      voucherCode: 'COMBO30',
      calories: '1.600 – 1.850 kcal/người',
      targetAudience: 'Phù hợp gia đình 3–4 người, có trẻ nhỏ và người lớn tuổi',
      description: 'Thực đơn truyền thống đủ canh – mặn – xào: Canh cải xanh thịt bò, Gà xào nấm đông cô & Heo thảo mộc cuốn rau.',
      goals: ['protein', 'fiber', 'variety', 'balance'],
      servings: 4,
      mealsCount: 2,
      recipeIds: ['canh-cai-xanh-thit-bo', 'ca-rot-xao-thit-ga', 'heo-thao-moc-cuon-rau'],
    },
    {
      id: 'plan-detox-vegan',
      name: 'Gói Thanh Lọc Cơ Thể & Tăng Đề Kháng',
      image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=700&q=80',
      badge: 'Deal Xanh -15%',
      discountPercent: 15,
      voucherCode: 'NUTRITION10',
      calories: '1.200 – 1.400 kcal/ngày',
      targetAudience: 'Phù hợp ngày ăn thanh đạm, bổ sung vitamin & chống oxy hóa',
      description: 'Nhẹ bụng với Đậu hũ non sốt nấm, Súp bí đỏ Đà Lạt và Detox cam sành táo đỏ cà rốt tươi mát.',
      goals: ['vitamin', 'fiber', 'variety'],
      servings: 2,
      mealsCount: 1,
      recipeIds: ['dau-hu-sot-nam-chay', 'sup-bi-do-hat-sen', 'detox-cam-tao-ca-rot'],
    },
  ],
  ingredientAliases: [
    { keyword: 'cá hồi', slug: 'ca-hoi-na-uy-fillet-tuoi', excludeKeyword: '' },
    { keyword: 'bông cải xanh', slug: 'bong-cai-xanh-da-lat', excludeKeyword: '' },
    { keyword: 'cà rốt', slug: 'ca-rot-baby-da-lat', excludeKeyword: '' },
    { keyword: 'gà ta thả vườn nguyên con', slug: 'ga-ta-tha-vuon-nguyen-con', excludeKeyword: '' },
    { keyword: 'gà ta', slug: 'ga-ta-tha-vuon-nguyen-con', excludeKeyword: '' },
    { keyword: 'thịt gà', slug: 'ga-ta-tha-vuon-nguyen-con', excludeKeyword: '' },
    { keyword: 'ức gà', slug: 'ga-ta-tha-vuon-nguyen-con', excludeKeyword: '' },
    { keyword: 'gà', slug: 'ga-ta-tha-vuon-nguyen-con', excludeKeyword: '' },
    { keyword: 'dưa leo', slug: 'dua-leo-baby-da-lat', excludeKeyword: '' },
    { keyword: 'cà chua bi', slug: 'ca-chua-bi-da-lat', excludeKeyword: '' },
    { keyword: 'cà chua', slug: 'ca-chua-bi-da-lat', excludeKeyword: '' },
    { keyword: 'thịt bò bắp mỹ nhập khẩu', slug: 'thit-bo-bap-my-nhap-khau', excludeKeyword: '' },
    { keyword: 'thịt bò', slug: 'thit-bo-bap-my-nhap-khau', excludeKeyword: '' },
    { keyword: 'bò bắp', slug: 'thit-bo-bap-my-nhap-khau', excludeKeyword: '' },
    { keyword: 'bò', slug: 'thit-bo-bap-my-nhap-khau', excludeKeyword: '' },
    { keyword: 'cải xanh', slug: 'cai-xanh-da-lat', excludeKeyword: 'bông cải' },
    { keyword: 'sữa chua hy lạp', slug: 'sua-chua-hy-lap-huu-co', excludeKeyword: '' },
    { keyword: 'sữa chua men sống', slug: 'sua-chua-men-song-da-lat', excludeKeyword: '' },
    { keyword: 'sữa chua', slug: 'sua-chua-hy-lap-huu-co', excludeKeyword: '' },
    { keyword: 'dâu tây', slug: 'dau-tay-da-lat', excludeKeyword: '' },
    { keyword: 'xoài cát', slug: 'xoai-cat-hoa-loc', excludeKeyword: '' },
    { keyword: 'xoài', slug: 'xoai-cat-hoa-loc', excludeKeyword: '' },
    { keyword: 'nấm đông cô', slug: 'nam-dong-co-da-lat', excludeKeyword: '' },
    { keyword: 'tôm sú', slug: 'tom-su-tuoi-song-ca-mau', excludeKeyword: '' },
    { keyword: 'tôm', slug: 'tom-su-tuoi-song-ca-mau', excludeKeyword: '' },
    { keyword: 'rau cải ngọt', slug: 'rau-cai-ngot-huu-co', excludeKeyword: 'bông cải' },
    { keyword: 'cải ngọt', slug: 'rau-cai-ngot-huu-co', excludeKeyword: 'bông cải' },
    { keyword: 'sả tươi', slug: 'sa-tuoi-ben-tre', excludeKeyword: '' },
    { keyword: 'sả', slug: 'sa-tuoi-ben-tre', excludeKeyword: '' },
    { keyword: 'bơ sáp', slug: 'bo-sap-dak-lak', excludeKeyword: 'bò' },
    { keyword: 'quả bơ', slug: 'bo-sap-dak-lak', excludeKeyword: 'bò' },
    { keyword: 'bơ', slug: 'bo-sap-dak-lak', excludeKeyword: 'bò' },
    { keyword: 'bí đỏ', slug: 'bi-do-ho-lo-da-lat', excludeKeyword: '' },
    { keyword: 'ba rọi heo', slug: 'thit-ba-roi-heo-thao-moc', excludeKeyword: '' },
    { keyword: 'heo thảo mộc', slug: 'thit-ba-roi-heo-thao-moc', excludeKeyword: '' },
    { keyword: 'thịt heo', slug: 'thit-ba-roi-heo-thao-moc', excludeKeyword: '' },
    { keyword: 'cải thìa', slug: 'cai-thia-baby-da-lat', excludeKeyword: '' },
    { keyword: 'ớt chuông 3 màu', slug: 'ot-chuong-3-mau-da-lat', excludeKeyword: '' },
    { keyword: 'ớt chuông', slug: 'ot-chuong-3-mau-da-lat', excludeKeyword: '' },
    { keyword: 'cam sành', slug: 'cam-sanh-vinh-long', excludeKeyword: '' },
    { keyword: 'cam', slug: 'cam-sanh-vinh-long', excludeKeyword: '' },
  ],
  recipeDefaults: {
    cookTime: '15 phút',
    difficulty: 'Dễ chế biến',
    calories: 420,
    macros: {
      protein: '32g',
      carbs: '24g',
      fat: '14g',
      fiber: '8g',
      vitamins: 'Vitamin A, C, B6, Omega-3, Sắt, Canxi',
    },
    chefTips:
      'Sử dụng nông sản tươi thu hoạch trong ngày từ Evergreen Mart và chế biến ở nhiệt độ vừa phải để giữ trọn vẹn lượng vitamin tự nhiên.',
    steps: [
      {
        stepNumber: 1,
        title: 'Sơ chế nguyên liệu tươi sạch',
        detail: 'Rửa sạch rau củ hữu cơ dưới vòi nước chảy, để ráo. Thấm khô phần thịt/hải sản tươi bằng khăn giấy bếp.',
      },
      {
        stepNumber: 2,
        title: 'Tẩm ướp gia vị tự nhiên',
        detail: 'Ướp nguyên liệu chính với một chút muối hồng, tiêu đen xay và dầu ô liu nguyên chất trong 10 phút.',
      },
      {
        stepNumber: 3,
        title: 'Chế biến giữ trọn vi chất',
        detail: 'Nấu hoặc áp chảo ở lửa vừa để thực phẩm chín mềm tự nhiên, giữ được màu xanh giòn của rau củ.',
      },
      {
        stepNumber: 4,
        title: 'Trình bày & Thưởng thức',
        detail: 'Bày món ăn ra đĩa, rắc thêm hạt dinh dưỡng hoặc rau thơm và thưởng thức ngay khi còn nóng.',
      },
    ],
  },
  cookConfig: {
    unitOptions: [
      { value: 'g', label: 'g' },
      { value: 'kg', label: 'kg' },
      { value: 'quả', label: 'quả' },
      { value: 'củ', label: 'củ' },
      { value: 'bó', label: 'bó' },
      { value: 'gói', label: 'gói' },
      { value: 'phần', label: 'phần' },
    ],
    categoryHints: {
      vegetables: ['vegetables', 'rau cu', 'rau xanh', 'cu qua', 'nam'],
      fruits: ['fruits', 'trai cay'],
      meat: ['meat', 'thit'],
      seafood: ['seafood', 'hai san', 'ca'],
      dairy: ['dairy', 'sua', 'sua chua', 'che pham sua', 'bo pho mai'],
    },
    quickIngredients: [
      { query: 'Cà chua', label: '+ Cà chua' },
      { query: 'Bò Mỹ thăn', label: '+ Thịt bò' },
      { query: 'Cá hồi tươi', label: '+ Cá hồi' },
      { query: 'Gà ta thả vườn', label: '+ Thịt gà' },
      { query: 'Rau cải', label: '+ Cải thìa' },
      { query: 'Cà rốt', label: '+ Cà rốt' },
      { query: 'Quả bơ Hass', label: '+ Bơ Hass' },
    ],
  },
};

const CHATBOT_KNOWLEDGE_DATA = {
  key: 'main',
  orderStatusMap: {
    pending: 'Chờ xử lý',
    confirmed: 'Đã xác nhận',
    preparing: 'Đang chuẩn bị hàng',
    shipping: 'Đang giao hàng xe lạnh',
    delivered: 'Đã giao thành công',
    cancelled: 'Đã hủy',
  },
  personaPrompts: {
    nutribot: `You are NutriBot, a helpful, respectful, honest and world-renowned nutritionist assistant.
Bạn cung cấp lời khuyên chuyên sâu về thực phẩm, dinh dưỡng và lối sống lành mạnh (Eat-Clean, Giảm mỡ, Tăng cơ, Cắt nét, Huyết áp, Tiểu đường, Ăn chay).
Bạn có khả năng nhận diện hình ảnh món ăn & đồ uống, bóc tách nguyên liệu, ước tính chính xác lượng Calo (kcal), Macro (Đạm, Tinh bột, Chất béo, Chất xơ) và đưa ra lời khuyên cá nhân hóa dựa trên thể trạng của người dùng.`,
    chef: 'Bạn đóng vai trò Bếp trưởng Evergreen Mart, chuyên gia ẩm thực hữu cơ, hướng dẫn công thức nấu ăn sáng tạo, cách kết hợp rau củ thịt cá thành món ngon chuẩn vị gia đình.',
    nutritionist: 'Bạn đóng vai trò Chuyên gia Dinh dưỡng Evergreen Mart, tư vấn thực phẩm giàu vitamin, thực đơn eat-clean, kiểm soát calo và lợi ích sức khỏe từ rau củ quả tươi.',
    support: 'Bạn đóng vai trò Hỗ trợ viên chăm sóc khách hàng Evergreen Mart, giải đáp về vận chuyển xe lạnh, kiểm tra đơn hàng, chính sách 1 đổi 1 và voucher ưu đãi.',
    default: 'Bạn là Trợ lý AI Nông sản Evergreen Mart thông thái và thân thiện, hỗ trợ khách hàng tìm kiếm nông sản sạch, gợi ý thực đơn, tư vấn mua sắm và giải đáp thắc mắc.',
  },
  systemPromptMeta: {
    ecosystemInfo: `THÔNG TIN HỆ SINH THÁI NÔNG SẢN EVERGREEN MART:
- Nông sản 100% hữu cơ chuẩn VietGAP & GlobalGAP từ Đà Lạt và Ba Vì.
- Thu hoạch sớm mỗi ngày, vận chuyển bằng xe lạnh chuyên dụng 0°C – 4°C.
- Miễn phí giao hàng (0₫) cho đơn từ 300.000₫. Đơn dưới 300.000₫ đồng giá 25.000₫.
- Đổi trả 1-1 trong 24 giờ nếu rau củ quả không đạt độ tươi giòn.`,
    responseRules: `YÊU CẦU PHẢN HỒI:
- Trả lời bằng tiếng Việt lịch thiệp, khoa học, ấm áp, dùng các emoji tươi mát (🩺, 🥗, 🍎, 🥩, 🌿, ✨).
- Định dạng Markdown rõ ràng (tiêu đề, in đậm, danh sách gạch đầu dòng).
- Khi gợi ý món hoặc nguyên liệu thay thế lành mạnh, ưu tiên nhắc các sản phẩm sạch đang có tại Evergreen Mart.`,
    visionUserPromptDefault:
      'Khách hàng vừa tải lên một hình ảnh đồ ăn/thức uống. Hãy phân tích chi tiết tên món, thành phần, calo và dinh dưỡng theo chuẩn NutriBot.',
    detectIngredientsPrompt: `You are a culinary vision AI for "Evergreen Mart" organic supermarket.
Analyze this photo carefully and identify ONLY the real food or cooking ingredients actually visible in the image (do NOT guess or invent ingredients that are not visible).
Use clear Vietnamese names (e.g., "Chuối", "Táo", "Cà chua", "Thịt bò", "Ức gà", "Cà rốt").
Use "category" from ["vegetables", "fruits", "meat", "seafood", "dairy", "pantry", "bakery", "beverages", "other"].
Estimate "qty" (positive number) and "unit" using ONLY one of ["g", "kg", "quả", "củ", "bó", "gói", "phần"] (use "quả" for whole fruits like chuối, táo, cam, cà chua).
If no food ingredients are visible in the photo, return [].
Return ONLY a valid JSON array without markdown code fence or extra explanation, e.g.:
[{"name": "Chuối", "category": "fruits", "qty": 5, "unit": "quả"}]`,
  },
  preferredGeminiModels: [
    'gemini-3.5-flash-lite',
    'gemini-flash-lite-latest',
    'gemini-3.1-flash-lite',
    'gemini-3.1-flash-lite-preview',
    'gemini-3.5-flash',
    'gemini-3.8-flash',
    'gemini-flash-latest',
    'gemini-3-flash-preview',
    'gemini-3.6-flash',
    'gemini-3.7-flash',
  ],
  excludedGeminiModelTokens: [
    '-tts', '-image', 'image-preview', 'lyria', 'robotics',
    'computer-use', 'deep-research', 'nano-banana', 'transcribe',
    'gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-pro', 'pro-latest', '3.1-pro', '4-',
  ],
  productKeywords: [
    'cai thia', 'cai ngot', 'cai cuc', 'mong toi', 'rau muong', 'bo xoi', 'xa lach', 'bap cai', 'ca chua', 'dua leo',
    'khoai tay', 'ca rot', 'nam', 'bap', 'bi do', 'su hao', 'khoai lang', 'bong cai', 'mang tay',
    'tao', 'chuoi', 'cam', 'nho', 'le', 'xoai', 'bo', 'buoi', 'dau tay', 'viet quat',
    'thit bo', 'ba chi', 'than ngoai', 'thit heo', 'thit ga', 'uc ga', 'suon',
    'ca hoi', 'phi le', 'tom', 'muc', 'ca thu', 'hai san',
    'sua tuoi', 'sua hat', 'sua chua', 'pho mai', 'dau phu', 'gao lut',
  ],
  categoryFallbackRules: [
    { keywords: ['rau', 'cu', 'salad'], category: 'vegetables' },
    { keywords: ['trai cay', 'hoa qua', 'bo'], category: 'fruits' },
    { keywords: ['thit', 'bo', 'uc ga'], category: 'meat' },
    { keywords: ['ca', 'hai san', 'ca hoi'], category: 'seafood' },
  ],
  ingredientCategoryHints: {
    vegetables: ['vegetables', 'rau cu'],
    fruits: ['fruits', 'trai cay'],
    meat: ['meat', 'thit'],
    seafood: ['seafood', 'hai san', 'ca'],
    dairy: ['dairy', 'sua'],
    pantry: ['pantry', 'do kho', 'gia vi'],
    bakery: ['bakery', 'banh'],
    beverages: ['beverages', 'thuc uong', 'do uong'],
  },
  mealProfiles: [
    {
      keywords: ['salad', 'rau', 'uc ga', 'tron', 'dia rau'],
      mealName: 'Salad Ức Gà Rau Củ Hữu Cơ Sốt Mè Rang',
      ingredients: 'Ức gà phi lê áp chảo, xà lách Lô Tô xanh, cà chua bi, dưa leo Đà Lạt, ngô ngọt, sốt mè rang.',
      calories: '280 - 350 kcal',
      protein: '28g', carbs: '18g', fat: '10g', fiber: '6g',
      isHealthy: true,
      advice: 'Đây là một bữa ăn Eat-Clean lý tưởng! Giàu đạm nạc giúp no lâu, nhiều chất xơ hỗ trợ tiêu hóa. Lưu ý không dùng quá nhiều sốt mè để kiểm soát chất béo.',
      searchKeywords: ['xa lach', 'uc ga', 'ca chua', 'dua leo'],
    },
    {
      keywords: ['pho', 'bun', 'mi', 'nuoc dung', 'pho bo', 'pho ga'],
      mealName: 'Bát Phở Bò Tái Nước Dùng Thanh',
      ingredients: 'Bánh phở tươi, thịt bò bắp nạc thái mỏng, nước dùng hầm xương quế hồi, hành hoa, rau mùi, chanh ớt.',
      calories: '420 - 520 kcal',
      protein: '26g', carbs: '65g', fat: '12g', fiber: '2.5g',
      isHealthy: true,
      advice: 'Món ăn truyền thống giàu năng lượng. Nếu bạn đang muốn giảm mỡ, nên vớt bớt lớp váng dầu, ăn kèm nhiều rau thơm giá đỗ và hạn chế húp hết nước dùng để giảm natri.',
      searchKeywords: ['thit bo', 'hanh hoa', 'chanh'],
    },
    {
      keywords: ['burger', 'hamburger', 'banh mi kep'],
      mealName: 'Bánh Hamburger Thịt Bò & Rau Củ',
      ingredients: 'Vỏ bánh mì tròn mè, bò bằm nướng áp chảo, phô mai lát, cà chua, hành tây, xà lách.',
      calories: '550 - 750 kcal',
      protein: '32g', carbs: '52g', fat: '28g', fiber: '3g',
      isHealthy: false,
      advice: 'Bữa ăn giàu đạm nhưng có hàm lượng chất béo bão hòa và tinh bột nhanh khá cao. Nên ăn kèm một đĩa rau xà lách tươi Evergreen Mart không sốt để cân bằng vi chất.',
      searchKeywords: ['thit bo', 'ca chua', 'xa lach'],
    },
    {
      keywords: ['pizza'],
      mealName: 'Bánh Pizza Nướng Phô Mai Rau Củ',
      ingredients: 'Đế bột mì nướng giòn, sốt cà chua cô đặc, phô mai mozzarella, ớt chuông, nấm rơm, thịt xông khói.',
      calories: '700 - 950 kcal (cho 2-3 miếng)',
      protein: '24g', carbs: '85g', fat: '32g', fiber: '4g',
      isHealthy: false,
      advice: 'Lượng calo và muối (natri) tương đối cao. Hãy thưởng thức điều độ, uống nhiều nước và bổ sung thêm rau xanh cho các bữa còn lại trong ngày.',
      searchKeywords: ['ca chua', 'nam', 'ot chuong'],
    },
    {
      keywords: ['sinh to', 'nuoc ep', 'smoothie', 'tra', 'bo', 'chuoi'],
      mealName: 'Sinh Tố Bơ Chuối Sữa Hạt Nguyên Chất',
      ingredients: 'Bơ sáp Đắk Lắk, chuối chín Laba, sữa hạt điều không đường, hạt chia hữu cơ.',
      calories: '220 - 320 kcal',
      protein: '7g', carbs: '36g', fat: '14g', fiber: '8g',
      isHealthy: true,
      advice: 'Thức uống dinh dưỡng dồi dào chất béo tốt không bão hòa đơn, kali và chất chống oxy hóa, hỗ trợ tim mạch và làn da tươi trẻ.',
      searchKeywords: ['bo', 'chuoi', 'sua hat'],
    },
    {
      keywords: ['ca hoi', 'ca', 'hai san', 'fish'],
      mealName: 'Phi Lê Cá Hồi Áp Chảo Bơ Tỏi Kèm Măng Tây',
      ingredients: 'Phi lê cá hồi tươi, măng tây xanh Đà Lạt, bơ lạt, tỏi băm, muối hồng, tiêu đen, chanh vàng.',
      calories: '360 - 450 kcal',
      protein: '34g', carbs: '8g', fat: '22g', fiber: '4.5g',
      isHealthy: true,
      advice: 'Cực kỳ tốt cho não bộ và cơ bắp! Nguồn Axit béo Omega-3 dồi dào giúp kháng viêm, rất thích hợp cho chế độ Keto hoặc Eat-Clean.',
      searchKeywords: ['ca hoi', 'mang tay', 'bo'],
    },
    {
      keywords: ['com', 'com tam', 'com ga', 'rice'],
      mealName: 'Cơm Gạo Lứt Kèm Đậu Phụ & Rau Củ Xào',
      ingredients: 'Cơm gạo lứt Ba Vì dẻo ngọt, đậu phụ áp chảo vàng, nấm hương, ớt chuông, bông cải xanh.',
      calories: '320 - 420 kcal',
      protein: '16g', carbs: '56g', fat: '9g', fiber: '8.5g',
      isHealthy: true,
      advice: 'Bữa ăn thực dưỡng thanh đạm, chỉ số đường huyết (GI) thấp, giúp no lâu và không làm tăng đột ngột đường huyết sau ăn.',
      searchKeywords: ['gao lut', 'bong cai', 'nam'],
    },
  ],
  bmiConfig: {
    guideReply: `🩺 **Cách tính chỉ số BMI & Nhu cầu Calo từ NutriBot:**\n\n` +
      `Công thức chuẩn: **BMI = Cân nặng (kg) / [Chiều cao (m)]²**\n\n` +
      `- **< 18.5:** Thiếu cân (Cần bổ sung đạm, chất béo tốt và tinh bột chậm)\n` +
      `- **18.5 – 22.9:** Thể trạng Chuẩn lý tưởng cho người Châu Á\n` +
      `- **23.0 – 24.9:** Tiền béo phì (Thừa cân nhẹ, nên áp dụng thâm hụt calo)\n` +
      `- **≥ 25.0:** Béo phì (Cần chế độ Eat-Clean nghiêm ngặt & tập luyện)\n\n` +
      `👉 *Bạn có thể nhập chiều cao và cân nặng (ví dụ: "Em cao 1m65 nặng 58kg") hoặc điền trực tiếp trong phần Cài đặt (⚙️) để NutriBot tính tự động nhé!*`,
    bands: [
      {
        maxBmi: 18.5,
        status: 'Thiếu cân (Gầy)',
        advice: 'Bạn nên tăng nhẹ lượng calo nạp vào (+300 - 500 kcal/ngày). Ưu tiên các loại hạt giàu calo tốt (hạt điều, óc chó), sữa hạt, bơ sáp và thịt cá tươi từ Evergreen Mart.',
      },
      {
        maxBmi: 23,
        status: 'Thể trạng Chuẩn (Lý tưởng)',
        advice: 'Chúc mừng bạn! Chỉ số hình thể rất tuyệt vời. Hãy duy trì chế độ ăn Eat-Clean giàu rau xanh và uống đủ nước để giữ vững phong độ nhé.',
      },
      {
        maxBmi: 25,
        status: 'Tiền béo phì (Thừa cân nhẹ)',
        advice: 'Bạn nên tạo mức thâm hụt calo vừa phải (-300 kcal/ngày). Tăng cường rau họ cải (cải thìa, cải bó xôi) để no lâu và giảm tinh bột nhanh.',
      },
      {
        maxBmi: null,
        status: 'Béo phì',
        advice: 'NutriBot khuyên bạn nên kiểm soát khẩu phần chặt chẽ, cắt giảm hoàn toàn nước ngọt và đồ chiên rán, thay bằng 50% đĩa ăn là rau củ hữu cơ Evergreen Mart luộc/hấp.',
      },
    ],
  },
  cannedReplies: {
    voucherFallback:
      '🌿 Hiện tại Evergreen Mart đang áp dụng chính sách **Miễn phí vận chuyển xe lạnh toàn thành phố cho đơn hàng từ 300.000₫** và tích điểm thành viên hạng Kim cương nhận chiết khấu đến 10%!',
    shippingPolicy: `🚚 **Chính sách Giao nhận & Bảo quản tại Evergreen Mart:**\n\n` +
      `1. **Giao hàng xe lạnh chuyên dụng:** Toàn bộ rau củ, quả, thịt cá tươi sống được vận chuyển ở nhiệt độ chuẩn 0°C – 4°C, cam kết độ giòn ngọt nguyên bản như vừa hái tại vườn.\n` +
      `2. **Tốc độ giao hàng:** Giao hỏa tốc 2 giờ tại nội thành Hà Nội & TP. Hồ Chí Minh.\n` +
      `3. **Phí vận chuyển:**\n` +
      ` - **Miễn phí ship (0₫)** cho đơn hàng từ **300.000₫** trở lên.\n` +
      ` - Đơn dưới 300.000₫: Đồng giá hỗ trợ 25.000₫ nội thành.\n` +
      `4. **Bảo hành 1 đổi 1 trong 24 giờ:** Nếu sản phẩm bị dập hỏng hoặc không đạt cam kết tươi sạch, Evergreen Mart đổi mới ngay lập tức!`,
    healthySnack: `🍎 **Giải pháp ăn vặt lành mạnh & kiểm soát cơn thèm ăn đêm từ NutriBot:**\n\n` +
      `1. **Nguyên nhân thèm ăn đêm:** Thường do bữa tối thiếu đạm (protein) hoặc chất xơ, hoặc do căng thẳng, thiếu ngủ làm tăng hormone *ghrelin* gây đói.\n` +
      `2. **Gợi ý món ăn vặt ít calo (< 150 kcal):**\n` +
      ` - 1/2 quả táo giòn chấm 1 thìa bơ đậu phộng không đường.\n` +
      ` - 1 hũ sữa chua Hy Lạp rắc vài hạt chia hoặc việt quất.\n` +
      ` - Dưa chuột, cà rốt baby cắt thanh giòn ngọt, giàu nước và chất xơ.\n` +
      ` - 1 ly nước ấm pha mật ong chanh hoặc trà hoa cúc giúp thư giãn thần kinh.\n\n` +
      `*NutriBot gợi ý một số nông sản tươi giòn sẵn có tại nông trại giúp bạn xoa dịu dạ dày an toàn:*`,
    eatCleanMenuTemplate: `🩺 **NutriBot gợi ý thực đơn Eat-Clean tươi lành chuẩn khoa học:**\n` +
      `*(Áp dụng cho: {{targetNote}})*\n\n` +
      `🍲 **Bữa trưa năng lượng:**\n` +
      `- Đạm sạch: 150g Phi lê cá hồi áp chảo sốt bơ chanh hoặc Ức gà nướng thảo mộc.\n` +
      `- Tinh bột chậm: 1 chén cơm gạo lứt Ba Vì hoặc khoai lang hấp.\n` +
      `- Rau củ chất xơ: Salad xà lách Lô Tô xanh, cà chua bi sốt dầu giấm nguyên chất.\n\n` +
      `🥗 **Bữa tối nhẹ bụng:**\n` +
      `- Canh cải thìa baby non ngọt nấu thịt bằm.\n` +
      `- Đậu phụ luộc chấm sốt tương mè đen.\n` +
      `- 1 ly nước ép cần tây táo xanh thanh lọc cơ thể.\n\n` +
      `*Bạn có thể bấm vào thẻ bên dưới để xem hoặc thêm nguyên liệu vào giỏ hàng ngay:*`,
    defaultWelcome: `Xin chào bạn! Tôi là **NutriBot — Chuyên gia Dinh dưỡng & Trợ lý Nông sản Evergreen Mart** 🩺🌿\n\n` +
      `Tôi có thể hỗ trợ bạn:\n` +
      `- 📷 **Nhận diện món ăn qua ảnh:** Tải ảnh đĩa ăn hoặc đồ uống lên, tôi sẽ phân tích nguyên liệu, tính lượng Calo và đưa ra lời khuyên dinh dưỡng tức thì!\n` +
      `- 🩺 **Cá nhân hóa thực đơn:** Tính toán chỉ số BMI, TDEE, thiết kế thực đơn Eat-Clean, giảm mỡ, tăng cơ hoặc ăn kiêng theo bệnh lý.\n` +
      `- 🥗 **Nông sản hữu cơ:** Tìm kiếm rau củ quả, thịt cá chuẩn VietGAP & GlobalGAP từ nông trại Evergreen Mart.\n` +
      `- 🚚 **Đơn hàng & Giao vận:** Tra cứu lộ trình xe lạnh bảo quản 0°C – 4°C.\n\n` +
      `*Hôm nay bạn cần NutriBot phân tích món ăn hay tư vấn dinh dưỡng gì nào?*`,
    macroAdvice: `📊 **Hướng dẫn chia tỷ lệ Macro (Dinh dưỡng đa lượng) chuẩn NutriBot:**\n\n` +
      `Macro bao gồm 3 nhóm chất sinh năng lượng chính:\n` +
      `1. **Protein (Chất đạm):** 1g = 4 kcal — Xây dựng cơ bắp, hỗ trợ trao đổi chất (Ức gà, cá hồi, thịt bò nạc, đậu phụ).\n` +
      `2. **Carbohydrate (Tinh bột):** 1g = 4 kcal — Cung cấp năng lượng chính (Gạo lứt Ba Vì, khoai lang, yến mạch, hoa quả).\n` +
      `3. **Fat (Chất béo tốt):** 1g = 9 kcal — Cân bằng hormone, hòa tan vitamin A, D, E, K (Bơ, dầu ô-liu, các loại hạt).\n\n` +
      `🎯 **Tỷ lệ phân chia khuyến nghị theo mục tiêu:**\n` +
      `- **Giảm mỡ & Cắt nét:** 40% Carb – 40% Protein – 20% Fat (Thâm hụt 300-500 kcal)\n` +
      `- **Duy trì & Eat-Clean:** 50% Carb – 25% Protein – 25% Fat\n` +
      `- **Tăng cơ nạc:** 45% Carb – 30% Protein – 25% Fat\n\n` +
      `💡 *Nguyên tắc vàng: Luôn ưu tiên nguyên liệu hữu cơ tươi mới để cơ thể hấp thu tối đa dưỡng chất mà không bị nạp tạp chất độc hại.*`,
    switchToAiGreeting:
      'NutriBot đã quay trở lại đồng hành cùng bạn 🌿! Bạn có câu hỏi gì về dinh dưỡng hoặc nông sản không?',
    transferExplicitReply:
      'NutriBot đã chuyển yêu cầu của bạn đến chuyên viên tư vấn Evergreen Mart. Bạn vui lòng đợi trong giây lát, chuyên viên sẽ tham gia hỗ trợ trực tiếp tại đây! 🌿',
    detectIngredientErrors: {
      NO_API_KEY:
        'Gemini hiện tại chưa được cấu hình API key trên máy chủ nên chưa nhận diện được ảnh. Bạn vui lòng thêm nguyên liệu thủ công nhé.',
      INVALID_API_KEY:
        'Gemini API key hiện tại không hợp lệ hoặc đã bị thu hồi nên chưa nhận diện được ảnh. Bạn vui lòng thêm nguyên liệu thủ công nhé.',
      QUOTA_EXCEEDED:
        'Gemini hiện tại đang vượt hạn mức yêu cầu (quota), không nhận diện được ảnh. Bạn đợi ít phút rồi thử lại hoặc thêm nguyên liệu thủ công nhé.',
      DEFAULT:
        'Gemini hiện tại đang gặp vấn đề, không nhận diện được ảnh. Bạn đợi ít phút rồi thử lại hoặc thêm nguyên liệu thủ công bên trên nhé.',
    },
  },
};

const LOYALTY_CONFIG_DATA = {
  key: 'main',
  tiers: [
    { tier: 'platinum', minPoints: 15000, minSpent: 30000000 },
    { tier: 'gold', minPoints: 5000, minSpent: 10000000 },
    { tier: 'silver', minPoints: 1000, minSpent: 2000000 },
    { tier: 'bronze', minPoints: 0, minSpent: 0 },
  ],
  rewards: [
    { id: 'r1', name: 'Voucher 50.000đ', pointsRequired: 500, type: 'voucher', value: 50000 },
    { id: 'r2', name: 'Miễn phí giao hàng', pointsRequired: 300, type: 'shipping', value: 25000 },
    { id: 'r3', name: 'Voucher 100.000đ', pointsRequired: 1000, type: 'voucher', value: 100000 },
    { id: 'r4', name: 'Giỏ quà sinh nhật', pointsRequired: 2000, type: 'gift' },
  ],
};

function sanitizeBrandText(str) {
  if (!str || typeof str !== 'string') return str;
  return str
    .replace(/Xanh Lá Official/gi, 'Evergreen Mart Official')
    .replace(/chamsoc@xanhla\.vn/gi, 'chamsoc@evergreenmart.vn')
    .replace(/privacy@xanhla\.vn/gi, 'privacy@evergreenmart.vn')
    .replace(/support@xanhla\.vn/gi, 'support@evergreenmart.vn')
    .replace(/Xanh Lá/gi, 'Evergreen Mart')
    .replace(/1900\s*6789/g, '1800 6999');
}

const WAREHOUSE_HOURS_METADATA = {
  'store-thuduc': { openingHours: '07:00 - 21:30', readyTime: 'Chuẩn bị hàng: 15 - 30 phút' },
  'store-q1': { openingHours: '07:30 - 21:30', readyTime: 'Chuẩn bị hàng: 15 - 30 phút' },
  'store-binhthanh': { openingHours: '07:00 - 21:00', readyTime: 'Chuẩn bị hàng: 15 - 30 phút' },
  'store-q7': { openingHours: '07:30 - 21:30', readyTime: 'Chuẩn bị hàng: 15 - 30 phút' },
  'store-tanbinh': { openingHours: '07:00 - 21:00', readyTime: 'Chuẩn bị hàng: 15 - 30 phút' },
  'store-govap': { openingHours: '07:00 - 21:30', readyTime: 'Chuẩn bị hàng: 15 - 30 phút' },
  'store-binhtan': { openingHours: '07:00 - 21:30', readyTime: 'Chuẩn bị hàng: 15 - 30 phút' },
  'store-dian': { openingHours: '07:00 - 21:30', readyTime: 'Chuẩn bị hàng: 15 - 30 phút' },
  'store-thudaumot': { openingHours: '07:00 - 21:30', readyTime: 'Chuẩn bị hàng: 15 - 30 phút' },
  'store-bienhoa': { openingHours: '07:00 - 21:30', readyTime: 'Chuẩn bị hàng: 15 - 30 phút' },
  'store-dongda': { openingHours: '07:00 - 21:30', readyTime: 'Chuẩn bị hàng: 15 - 30 phút' },
  'store-caugiay': { openingHours: '07:00 - 21:30', readyTime: 'Chuẩn bị hàng: 15 - 30 phút' },
  'store-danang': { openingHours: '07:00 - 21:30', readyTime: 'Chuẩn bị hàng: 15 - 30 phút' },
  'store-nhatrang': { openingHours: '07:00 - 21:30', readyTime: 'Chuẩn bị hàng: 15 - 30 phút' },
  'store-daklak': { openingHours: '07:00 - 21:30', readyTime: 'Chuẩn bị hàng: 15 - 30 phút' },
  'store-cantho': { openingHours: '07:00 - 21:30', readyTime: 'Chuẩn bị hàng: 15 - 30 phút' },
  'store-vungtau': { openingHours: '07:00 - 21:30', readyTime: 'Chuẩn bị hàng: 15 - 30 phút' },
  'store-dalat': { openingHours: '07:00 - 21:30', readyTime: 'Chuẩn bị hàng: 15 - 30 phút' },
};

const SUPPORT_AVATAR_BACKFILL = {
  'Nguyễn Thị Mai': 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&auto=format&fit=crop&q=80',
  'Phạm Quốc Tuấn': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
};

async function syncConfigsToDb() {
  await NutritionConfig.findOneAndUpdate(
    { key: 'main' },
    { $set: NUTRITION_CONFIG_DATA },
    { upsert: true, new: true }
  );
  console.log('Upserted nutritionconfigs (main).');

  await ChatbotKnowledge.findOneAndUpdate(
    { key: 'main' },
    { $set: CHATBOT_KNOWLEDGE_DATA },
    { upsert: true, new: true }
  );
  console.log('Upserted chatbotknowledges (main).');

  await LoyaltyConfig.findOneAndUpdate(
    { key: 'main' },
    { $set: LOYALTY_CONFIG_DATA },
    { upsert: true, new: true }
  );
  console.log('Upserted loyaltyconfigs (main).');

  const shipCfg = await ShippingConfig.findOne({ key: 'default' });
  if (shipCfg) {
    shipCfg.warehouses = (shipCfg.warehouses || []).map((w) => {
      const obj = w.toObject ? w.toObject() : { ...w };
      const extra = WAREHOUSE_HOURS_METADATA[obj.id] || {
        openingHours: '07:00 - 21:30',
        readyTime: 'Chuẩn bị hàng: 15 - 30 phút',
      };
      return {
        ...obj,
        openingHours: obj.openingHours || extra.openingHours,
        readyTime: obj.readyTime || extra.readyTime,
      };
    });
    if (!Array.isArray(shipCfg.orderDiscounts) || shipCfg.orderDiscounts.length === 0) {
      shipCfg.orderDiscounts = [
        { minOrderValue: 300000, discountAmount: 25000, label: 'Đơn từ 300.000đ: giảm 25.000đ phí ship (Freeship)' },
        { minOrderValue: 150000, discountAmount: 10000, label: 'Đơn từ 150.000đ: giảm 10.000đ phí ship' },
      ];
    }
    await shipCfg.save();
    console.log('Updated shippingconfigs (default) with warehouse hours & orderDiscounts.');
  }

  for (const [customerName, avatarUrl] of Object.entries(SUPPORT_AVATAR_BACKFILL)) {
    const res = await Conversation.updateMany(
      { customerName, $or: [{ customerAvatar: '' }, { customerAvatar: { $exists: false } }] },
      { $set: { customerAvatar: avatarUrl } }
    );
    console.log(`Updated support avatar for ${customerName}: modified=${res.modifiedCount}`);
  }
}

async function runSync() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB.');
  await syncConfigsToDb();
  await mongoose.disconnect();
  console.log('Done syncing configs to MongoDB!');
}

if (require.main === module) {
  runSync().catch((err) => {
    console.error('Sync failed:', err);
    process.exit(1);
  });
}

module.exports = { syncConfigsToDb };
