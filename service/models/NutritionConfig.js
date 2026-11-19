const mongoose = require('mongoose');

const nutritionGoalSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    label: { type: String, required: true },
    icon: { type: String, default: '' },
    unit: { type: String, default: '' },
    min: { type: Number, default: 0 },
    max: { type: Number, default: 0 },
    step: { type: Number, default: 0 },
    default: { type: Number, default: 0 },
  },
  { _id: false }
);

const nutritionMealPlanSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    image: { type: String, default: '' },
    badge: { type: String, default: '' },
    discountPercent: { type: Number, default: 0 },
    voucherCode: { type: String, default: '' },
    calories: { type: String, default: '' },
    targetAudience: { type: String, default: '' },
    description: { type: String, default: '' },
    goals: [{ type: String }],
    servings: { type: Number, default: 2 },
    mealsCount: { type: Number, default: 2 },
    recipeIds: [{ type: String }],
  },
  { _id: false }
);

const ingredientAliasSchema = new mongoose.Schema(
  {
    keyword: { type: String, required: true },
    slug: { type: String, required: true },
    excludeKeyword: { type: String, default: '' },
  },
  { _id: false }
);

const nutritionConfigSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'main', unique: true },
    hero: {
      kicker: { type: String, default: '' },
      title: { type: String, default: '' },
      subtitle: { type: String, default: '' },
      bannerImage: { type: String, default: '' },
      fallbackFoodImage: { type: String, default: '' },
    },
    goals: [nutritionGoalSchema],
    mealPlans: [nutritionMealPlanSchema],
    ingredientAliases: [ingredientAliasSchema],
    quickSearchTags: [
      {
        label: { type: String, required: true },
        query: { type: String, required: true },
      },
    ],
    plannerConfig: {
      weekDays: [
        {
          key: { type: String, required: true },
          label: { type: String, required: true },
          short: { type: String, required: true },
        },
      ],
      mealSlots: [
        {
          key: { type: String, required: true },
          label: { type: String, required: true },
          time: { type: String, required: true },
          icon: { type: String, default: '' },
        },
      ],
      lightRecipeIds: [{ type: String }],
      nutrientBoostOptions: [
        {
          id: { type: String, required: true },
          label: { type: String, required: true },
          desc: { type: String, default: '' },
        },
      ],
      healthGoals: [
        {
          id: { type: String, required: true },
          title: { type: String, required: true },
          subtitle: { type: String, default: '' },
          badge: { type: String, default: '' },
          metrics: { type: String, default: '' },
          mealsPerDay: { type: Number, default: 3 },
          targetDailyKcal: { type: Number, default: 1650 },
          targetProtein: { type: Number, default: 125 },
          targetFiber: { type: Number, default: 28 },
          targetCarbs: { type: Number, default: 130 },
          priorityNutrients: [{ type: String }],
          dayTheme: { type: String, default: '' },
          weekDayThemes: { type: mongoose.Schema.Types.Mixed, default: {} },
          defaultSingleDaySchedule: { type: mongoose.Schema.Types.Mixed, default: {} },
          weeklySchedule: { type: mongoose.Schema.Types.Mixed, default: {} },
        },
      ],
    },
    recipeDefaults: {
      cookTime: { type: String, default: '15 phút' },
      difficulty: { type: String, default: 'Dễ chế biến' },
      calories: { type: Number, default: 420 },
      macros: {
        protein: { type: String, default: '32g' },
        carbs: { type: String, default: '24g' },
        fat: { type: String, default: '14g' },
        fiber: { type: String, default: '8g' },
        vitamins: { type: String, default: '' },
      },
      chefTips: { type: String, default: '' },
      steps: [
        {
          stepNumber: { type: Number, required: true },
          title: { type: String, required: true },
          detail: { type: String, required: true },
        },
      ],
    },
    cookConfig: {
      unitOptions: [
        {
          value: { type: String, required: true },
          label: { type: String, required: true },
        },
      ],
      categoryHints: { type: mongoose.Schema.Types.Mixed, default: {} },
      quickIngredients: [
        {
          query: { type: String, required: true },
          label: { type: String, required: true },
        },
      ],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('NutritionConfig', nutritionConfigSchema);

