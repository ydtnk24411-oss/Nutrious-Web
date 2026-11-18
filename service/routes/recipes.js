const router = require('express').Router();
const Recipe = require('../models/Recipe');
const NutritionConfig = require('../models/NutritionConfig');
const { protect, adminOnly } = require('../middleware/auth');
const { cacheMiddleware, clearCache } = require('../utils/cache');

function parseMinutes(val, fallback = 0) {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  const m = String(val || '').match(/\d+/);
  return m ? Number(m[0]) : fallback;
}

function mapCookRecipe(doc) {
  const prepTime = Number.isFinite(doc.prepMinutes)
    ? doc.prepMinutes
    : parseMinutes(doc.prepTime, 10);
  const cookTime = Number.isFinite(doc.cookMinutes)
    ? doc.cookMinutes
    : parseMinutes(doc.cookTime, 0);

  const steps = (doc.steps || [])
    .map((s) => (typeof s === 'string' ? s : (s?.detail || s?.title || '')))
    .filter(Boolean);

  const ingredients = (doc.ingredients || []).map((ing) => ({
    name: ing.name,
    amountPer1Serving: ing.amountPer1Serving,
    unit: ing.unit,
    keywords: Array.isArray(ing.keywords) ? ing.keywords : [],
    ...(ing.categoryHint ? { categoryHint: ing.categoryHint } : {}),
    ...(ing.productId ? { productId: ing.productId } : {}),
  }));

  return {
    id: doc.recipeId,
    name: doc.name,
    image: doc.image,
    description: doc.description,
    prepTime,
    cookTime,
    servingBase: doc.servingBase || 1,
    steps,
    ingredients,
    sources: doc.sources || [],
  };
}

// GET /api/recipes — Public list of recipes and cook assistant configuration from MongoDB
router.get('/', cacheMiddleware(60), async (req, res, next) => {
  try {
    const filter = { isActive: true };
    if (req.query.source) {
      filter.sources = String(req.query.source).trim();
    }

    const [recipes, config] = await Promise.all([
      Recipe.find(filter).sort({ createdAt: 1 }).lean(),
      NutritionConfig.findOne({ key: 'main' }).lean(),
    ]);

    const mapped = recipes.map(mapCookRecipe);
    res.json({
      success: true,
      total: mapped.length,
      data: mapped,
      config: {
        unitOptions: config?.cookConfig?.unitOptions || [],
        categoryHints: config?.cookConfig?.categoryHints || {},
        quickIngredients: config?.cookConfig?.quickIngredients || [],
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/recipes/:id — Public detail for a single recipe by recipeId
router.get('/:id', async (req, res, next) => {
  try {
    const doc = await Recipe.findOne({ recipeId: req.params.id, isActive: true }).lean();
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy công thức nấu ăn.' });
    }
    res.json({ success: true, data: mapCookRecipe(doc) });
  } catch (err) {
    next(err);
  }
});

// POST /api/recipes — Admin create recipe
router.post('/', protect, adminOnly, async (req, res, next) => {
  try {
    const recipe = await Recipe.create(req.body);
    clearCache();
    res.status(201).json({ success: true, data: mapCookRecipe(recipe) });
  } catch (err) {
    next(err);
  }
});

// PUT /api/recipes/:id — Admin update recipe by recipeId or _id
router.put('/:id', protect, adminOnly, async (req, res, next) => {
  try {
    const query = req.params.id.match(/^[0-9a-fA-F]{24}$/)
      ? { _id: req.params.id }
      : { recipeId: req.params.id };
    const recipe = await Recipe.findOneAndUpdate(query, req.body, { new: true, runValidators: true });
    if (!recipe) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy công thức nấu ăn.' });
    }
    clearCache();
    res.json({ success: true, data: mapCookRecipe(recipe) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
module.exports.mapCookRecipe = mapCookRecipe;

