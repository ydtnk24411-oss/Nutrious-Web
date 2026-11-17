const router = require('express').Router();
const Recipe = require('../models/Recipe');
const Product = require('../models/Product');
const Order = require('../models/Order');
const NutritionConfig = require('../models/NutritionConfig');
const { cacheMiddleware } = require('../utils/cache');

function normalizeVi(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .trim();
}

function findExactProductForIngredient(ingName, products, aliases = []) {
  if (!Array.isArray(products) || products.length === 0) return null;
  const rawLower = String(ingName || '').toLowerCase().trim();
  const target = normalizeVi(ingName);

  // 1. Exact case-insensitive Vietnamese name match (preserves diacritics so "Bơ" != "Bò")
  let found = products.find((p) => String(p.name || '').toLowerCase().trim() === rawLower);
  if (found) return found;

  // 2. Database-configured ingredient alias mapping -> slug
  for (const entry of aliases || []) {
    const vnKw = entry.keyword;
    const slug = entry.slug;
    const excludeKw = entry.excludeKeyword;
    if (vnKw && rawLower.includes(vnKw)) {
      found = products.find((p) => p.slug === slug);
      if (found) return found;
      const targetNorm = normalizeVi(vnKw);
      const wordRegex = new RegExp(`(^|\\s)${targetNorm}(\\s|$)`, 'i');
      const foundByName = products.find((p) => {
        const pNorm = normalizeVi(p.name);
        if (excludeKw && pNorm.includes(normalizeVi(excludeKw))) return false;
        return targetNorm.length <= 3 ? wordRegex.test(pNorm) : pNorm.includes(targetNorm);
      });
      if (foundByName) return foundByName;
    }
  }

  return products.find((p) => normalizeVi(p.name) === target) || null;
}

function mapRecipeDoc(r, products = [], config = null) {
  const aliases = config?.ingredientAliases || [];
  const defaults = config?.recipeDefaults || {};

  const mappedIngredients = (r.ingredients || []).map((ing) => {
    const rawIng = ing.toObject ? ing.toObject() : ing;
    const matchedProd = findExactProductForIngredient(rawIng.name, products, aliases);
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
    cookTime: r.cookTime || defaults.cookTime || '15 phút',
    difficulty: r.difficulty || defaults.difficulty || 'Dễ chế biến',
    calories: r.calories || defaults.calories || 420,
    macros: r.macros || defaults.macros || {},
    servingBase: r.servingBase,
    nutritionNote: r.nutritionNote,
    chefTips: r.chefTips || defaults.chefTips || '',
    steps: r.steps?.length ? r.steps : (defaults.steps || []),
    goalsTags: r.goalsTags,
    ingredients: mappedIngredients,
  };
}

// GET /api/nutrition — Lấy toàn bộ cấu hình hero, gói thực đơn mẫu, mục tiêu dinh dưỡng và danh sách công thức từ MongoDB (cache 60s)
router.get('/', cacheMiddleware(60), async (req, res, next) => {
  try {
    const [config, recipes, products, recentOrders] = await Promise.all([
      NutritionConfig.findOne({ key: 'main' }).lean(),
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
        hero: config?.hero || {},
        goals: config?.goals || [],
        mealPlans: config?.mealPlans || [],
        recipes: recipes.map((r) => mapRecipeDoc(r, products, config)),
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
    const [config, recipe, products] = await Promise.all([
      NutritionConfig.findOne({ key: 'main' }).lean(),
      Recipe.findOne({ recipeId: req.params.id, isActive: true }),
      Product.find({ isActive: { $ne: false } }).lean().catch(() => []),
    ]);
    if (!recipe) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy công thức món ăn.' });
    }
    res.json({ success: true, data: mapRecipeDoc(recipe, products, config) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
