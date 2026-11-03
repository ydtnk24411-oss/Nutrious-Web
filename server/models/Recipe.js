const mongoose = require('mongoose');

const recipeSchema = new mongoose.Schema(
  {
    recipeId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    image: { type: String, required: true },
    gallery: [{ type: String }],
    description: { type: String, required: true },
    prepTime: { type: String, required: true },
    cookTime: { type: String, default: '15 phút' },
    difficulty: { type: String, default: 'Dễ nấu' },
    calories: { type: Number, default: 420 },
    macros: {
      protein: { type: String, default: '32g' },
      carbs: { type: String, default: '24g' },
      fat: { type: String, default: '14g' },
      fiber: { type: String, default: '8g' },
      vitamins: { type: String, default: 'Vitamin A, C, B6, Omega-3, Sắt, Canxi' },
    },
    servingBase: { type: Number, default: 1 },
    nutritionNote: { type: String, required: true },
    chefTips: { type: String },
    steps: [
      {
        stepNumber: { type: Number },
        title: { type: String },
        detail: { type: String },
      },
    ],
    goalsTags: [{ type: String }],
    ingredients: [
      {
        name: { type: String, required: true },
        amountPer1Serving: { type: Number, required: true },
        unit: { type: String, required: true },
      },
    ],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Recipe', recipeSchema);
