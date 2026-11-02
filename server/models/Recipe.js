const mongoose = require('mongoose');

const recipeSchema = new mongoose.Schema(
  {
    recipeId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    image: { type: String, required: true },
    description: { type: String, required: true },
    prepTime: { type: String, required: true },
    servingBase: { type: Number, default: 1 },
    nutritionNote: { type: String, required: true },
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
