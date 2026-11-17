const mongoose = require('mongoose');

const mealProfileSchema = new mongoose.Schema(
  {
    keywords: [{ type: String }],
    mealName: { type: String, required: true },
    ingredients: { type: String, default: '' },
    calories: { type: String, default: '' },
    protein: { type: String, default: '' },
    carbs: { type: String, default: '' },
    fat: { type: String, default: '' },
    fiber: { type: String, default: '' },
    isHealthy: { type: Boolean, default: true },
    advice: { type: String, default: '' },
    searchKeywords: [{ type: String }],
  },
  { _id: false }
);

const categoryFallbackRuleSchema = new mongoose.Schema(
  {
    keywords: [{ type: String }],
    category: { type: String, required: true },
  },
  { _id: false }
);

const bmiBandSchema = new mongoose.Schema(
  {
    maxBmi: { type: Number, default: null },
    status: { type: String, required: true },
    advice: { type: String, required: true },
  },
  { _id: false }
);

const chatbotKnowledgeSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'main', unique: true },
    orderStatusMap: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
    personaPrompts: {
      nutribot: { type: String, default: '' },
      chef: { type: String, default: '' },
      nutritionist: { type: String, default: '' },
      support: { type: String, default: '' },
      default: { type: String, default: '' },
    },
    systemPromptMeta: {
      ecosystemInfo: { type: String, default: '' },
      responseRules: { type: String, default: '' },
      visionUserPromptDefault: { type: String, default: '' },
      detectIngredientsPrompt: { type: String, default: '' },
    },
    preferredGeminiModels: [{ type: String }],
    excludedGeminiModelTokens: [{ type: String }],
    productKeywords: [{ type: String }],
    categoryFallbackRules: [categoryFallbackRuleSchema],
    ingredientCategoryHints: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
    mealProfiles: [mealProfileSchema],
    bmiConfig: {
      guideReply: { type: String, default: '' },
      bands: [bmiBandSchema],
    },
    cannedReplies: {
      voucherFallback: { type: String, default: '' },
      shippingPolicy: { type: String, default: '' },
      healthySnack: { type: String, default: '' },
      eatCleanMenuTemplate: { type: String, default: '' },
      defaultWelcome: { type: String, default: '' },
      macroAdvice: { type: String, default: '' },
      switchToAiGreeting: { type: String, default: '' },
      transferExplicitReply: { type: String, default: '' },
      detectIngredientErrors: {
        NO_API_KEY: { type: String, default: '' },
        INVALID_API_KEY: { type: String, default: '' },
        QUOTA_EXCEEDED: { type: String, default: '' },
        DEFAULT: { type: String, default: '' },
      },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ChatbotKnowledge', chatbotKnowledgeSchema);
