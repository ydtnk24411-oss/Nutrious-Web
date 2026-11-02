const router = require('express').Router();
const Recipe = require('../models/Recipe');

const NUTRITION_GOALS = [
  { id: 'protein', label: 'Bổ sung protein', icon: '🥩', unit: 'g', min: 0, max: 200, step: 5, default: 50 },
  { id: 'fiber',   label: 'Bổ sung chất xơ', icon: '🥦', unit: 'g', min: 0, max: 50, step: 1, default: 10 },
  { id: 'vitamin', label: 'Bổ sung vitamin', icon: '🍊', unit: 'mg', min: 0, max: 500, step: 10, default: 50 },
  { id: 'mineral', label: 'Bổ sung khoáng chất', icon: '💊', unit: 'mg', min: 0, max: 1000, step: 50, default: 200 },
  { id: 'variety', label: 'Đa dạng thực phẩm', icon: '🌈', unit: '', min: 0, max: 0, step: 0, default: 0 },
  { id: 'balance', label: 'Bữa ăn cân bằng', icon: '⚖️', unit: '', min: 0, max: 0, step: 0, default: 0 },
];

// GET /api/nutrition — Lấy danh sách mục tiêu dinh dưỡng và công thức món ăn từ MongoDB
router.get('/', async (req, res, next) => {
  try {
    const recipes = await Recipe.find({ isActive: true }).sort({ createdAt: 1 });
    res.json({
      success: true,
      data: {
        goals: NUTRITION_GOALS,
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
