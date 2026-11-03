const router = require('express').Router();
const Recipe = require('../models/Recipe');
const Product = require('../models/Product');
const Order = require('../models/Order');

function normalizeVi(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .trim();
}

function findExactProductForIngredient(ingName, products) {
  if (!Array.isArray(products) || products.length === 0) return null;
  const rawLower = String(ingName || '').toLowerCase().trim();
  const target = normalizeVi(ingName);

  // 1. Exact case-insensitive Vietnamese name match (preserves diacritics so "Bơ" != "Bò")
  let found = products.find((p) => String(p.name || '').toLowerCase().trim() === rawLower);
  if (found) return found;

  // 2. Exact slug mapping for all core ingredients
  const exactSlugMap = [
    ['cá hồi', 'ca-hoi-na-uy-fillet-tuoi'],
    ['bông cải xanh', 'bong-cai-xanh-da-lat'],
    ['cà rốt', 'ca-rot-baby-da-lat'],
    ['gà ta', 'ga-ta-tha-vuon-nguyen-con'],
    ['thịt gà', 'ga-ta-tha-vuon-nguyen-con'],
    ['ức gà', 'ga-ta-tha-vuon-nguyen-con'],
    ['dưa leo', 'dua-leo-baby-da-lat'],
    ['cà chua bi', 'ca-chua-bi-da-lat'],
    ['thịt bò', 'thit-bo-bap-my-nhap-khau'],
    ['bò bắp', 'thit-bo-bap-my-nhap-khau'],
    ['cải xanh', 'cai-xanh-da-lat'],
    ['sữa chua hy lạp', 'sua-chua-hy-lap-huu-co'],
    ['sữa chua men sống', 'sua-chua-men-song-da-lat'],
    ['sữa chua', 'sua-chua-hy-lap-huu-co'],
    ['dâu tây', 'dau-tay-da-lat'],
    ['xoài cát', 'xoai-cat-hoa-loc'],
    ['nấm đông cô', 'nam-dong-co-da-lat'],
    ['tôm sú', 'tom-su-tuoi-song-ca-mau'],
    ['rau cải ngọt', 'rau-cai-ngot-huu-co'],
    ['cải ngọt', 'rau-cai-ngot-huu-co'],
    ['sả tươi', 'sa-tuoi-ben-tre'],
    ['bơ sáp', 'bo-sap-dak-lak'],
    ['quả bơ', 'bo-sap-dak-lak'],
    ['bí đỏ', 'bi-do-ho-lo-da-lat'],
    ['ba rọi heo', 'thit-ba-roi-heo-thao-moc'],
    ['heo thảo mộc', 'thit-ba-roi-heo-thao-moc'],
    ['cải thìa', 'cai-thia-baby-da-lat'],
    ['ớt chuông', 'ot-chuong-3-mau-da-lat'],
    ['cam sành', 'cam-sanh-vinh-long'],
  ];

  for (const [vnKw, slug] of exactSlugMap) {
    if (rawLower.includes(vnKw)) {
      found = products.find((p) => p.slug === slug);
      if (found) return found;
    }
  }

  return products.find((p) => normalizeVi(p.name) === target) || null;
}

const NUTRITION_HERO = {
  kicker: '🥗 Trợ Lý Thực Đơn Khoa Học · Dữ Liệu Trực Tuyến',
  title: 'Dinh dưỡng thông minh & Thực đơn chuẩn vị',
  subtitle:
    'Khám phá các gói thực đơn dinh dưỡng tiết kiệm, xem chi tiết công thức chế biến từng bước, bảng thành phần vi chất và thêm trọn bộ nguyên liệu tươi sạch vào giỏ hàng chỉ với một chạm.',
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
];

function mapRecipeDoc(r, products = []) {
  const mappedIngredients = (r.ingredients || []).map((ing) => {
    const rawIng = ing.toObject ? ing.toObject() : ing;
    const matchedProd = findExactProductForIngredient(rawIng.name, products);
    return {
      ...rawIng,
      product: matchedProd || null,
    };
  });

  return {
    id: r.recipeId,
    name: r.name,
    image: r.image,
    gallery: r.gallery || [r.image],
    description: r.description,
    prepTime: r.prepTime,
    cookTime: r.cookTime || '15 phút',
    difficulty: r.difficulty || 'Dễ chế biến',
    calories: r.calories || 420,
    macros: r.macros || {
      protein: '32g',
      carbs: '24g',
      fat: '14g',
      fiber: '8g',
      vitamins: 'Vitamin A, C, B6, Omega-3, Sắt, Canxi',
    },
    servingBase: r.servingBase,
    nutritionNote: r.nutritionNote,
    chefTips:
      r.chefTips ||
      'Sử dụng nông sản tươi thu hoạch trong ngày từ Xanh Lá và chế biến ở nhiệt độ vừa phải để giữ trọn vẹn lượng vitamin tự nhiên.',
    steps: r.steps?.length
      ? r.steps
      : [
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
    goalsTags: r.goalsTags,
    ingredients: mappedIngredients,
  };
}

// GET /api/nutrition — Lấy cấu hình hero, gói thực đơn mẫu, mục tiêu dinh dưỡng và danh sách công thức từ MongoDB
router.get('/', async (req, res, next) => {
  try {
    const [recipes, products, recentOrders] = await Promise.all([
      Recipe.find({ isActive: true }).sort({ createdAt: 1 }),
      Product.find({ isActive: { $ne: false } }).lean().catch(() => []),
      Order.find({}).sort({ createdAt: -1 }).limit(12).lean().catch(() => []),
    ]);

    const recentOrderedItems = [];
    for (const ord of recentOrders || []) {
      for (const it of ord.items || []) {
        if (it.name) {
          recentOrderedItems.push({
            name: it.name,
            orderedAt: ord.createdAt || new Date(),
          });
        }
      }
    }

    res.json({
      success: true,
      data: {
        hero: NUTRITION_HERO,
        goals: NUTRITION_GOALS,
        mealPlans: NUTRITION_MEAL_PLANS,
        recipes: recipes.map((r) => mapRecipeDoc(r, products)),
        recentOrderedItems,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/nutrition/:id — Lấy chi tiết 1 món ăn từ MongoDB
router.get('/:id', async (req, res, next) => {
  try {
    const [recipe, products] = await Promise.all([
      Recipe.findOne({ recipeId: req.params.id, isActive: true }),
      Product.find({ isActive: { $ne: false } }).lean().catch(() => []),
    ]);
    if (!recipe) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy công thức món ăn.' });
    }
    res.json({ success: true, data: mapRecipeDoc(recipe, products) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
