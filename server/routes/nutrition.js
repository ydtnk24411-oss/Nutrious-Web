const router = require('express').Router();
const Recipe = require('../models/Recipe');

const NUTRITION_HERO = {
  kicker: '🥗 Trợ Lý Thực Đơn Khoa Học · Dữ Liệu Trực Tuyến',
  title: 'Dinh dưỡng thông minh & Thực đơn chuẩn vị',
  subtitle:
    'Khám phá các gói thực đơn dinh dưỡng tiết kiệm, cân đối vi chất theo thể trạng, tự động tính định lượng theo số người & số bữa ăn và thêm trọn bộ nguyên liệu tươi sạch vào giỏ hàng chỉ với một chạm.',
  bannerImage: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=800&h=520&fit=crop',
};

const NUTRITION_GOALS = [
  { id: 'protein', label: 'Bổ sung protein', icon: '🥩', unit: 'g', min: 0, max: 200, step: 5, default: 50 },
  { id: 'fiber',   label: 'Bổ sung chất xơ', icon: '🥦', unit: 'g', min: 0, max: 50, step: 1, default: 10 },
  { id: 'vitamin', label: 'Bổ sung vitamin', icon: '🍊', unit: 'mg', min: 0, max: 500, step: 10, default: 50 },
  { id: 'mineral', label: 'Bổ sung khoáng chất', icon: '💊', unit: 'mg', min: 0, max: 1000, step: 50, default: 200 },
  { id: 'variety', label: 'Đa dạng thực phẩm', icon: '🌈', unit: '', min: 0, max: 0, step: 0, default: 0 },
  { id: 'balance', label: 'Bữa ăn cân bằng', icon: '⚖️', unit: '', min: 0, max: 0, step: 0, default: 0 },
];

const NUTRITION_MEAL_PLANS = [
  {
    id: 'plan-eat-clean',
    name: 'Gói Eat Clean Giữ Dáng & Đẹp Da',
    badge: 'Deal Thực Đơn -15%',
    discountPercent: 15,
    voucherCode: 'NUTRITION10',
    calories: '1.350 – 1.500 kcal/ngày',
    targetAudience: 'Phù hợp người giảm mỡ, giữ dáng, nhân viên văn phòng',
    description: 'Kết hợp Salad gà nướng Đà Lạt, Salad bơ cá hồi và Sinh tố dâu xoài giàu chất xơ, ít tinh bột xấu.',
    goals: ['fiber', 'vitamin', 'balance'],
    servings: 2,
    mealsCount: 2,
    recipeIds: ['salad-ga-nuong', 'salad-bo-ca-hoi', 'sinh-to-dau-xoai'],
  },
  {
    id: 'plan-high-protein',
    name: 'Gói Tăng Cơ & Phục Hồi Năng Lượng',
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
];

// GET /api/nutrition — Lấy cấu hình hero, gói thực đơn mẫu, mục tiêu dinh dưỡng và danh sách công thức từ MongoDB
router.get('/', async (req, res, next) => {
  try {
    const recipes = await Recipe.find({ isActive: true }).sort({ createdAt: 1 });
    res.json({
      success: true,
      data: {
        hero: NUTRITION_HERO,
        goals: NUTRITION_GOALS,
        mealPlans: NUTRITION_MEAL_PLANS,
        recipes: recipes.map(r => ({
          id: r.recipeId,
          name: r.name,
          image: r.image,
          description: r.description,
          prepTime: r.prepTime,
          servingBase: r.servingBase,
          nutritionNote: r.nutritionNote,
          goalsTags: r.goalsTags,
          ingredients: r.ingredients,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
