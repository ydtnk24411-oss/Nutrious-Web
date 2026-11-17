const mongoose = require('mongoose');

const loyaltyTierSchema = new mongoose.Schema(
  {
    tier: { type: String, required: true },
    minPoints: { type: Number, default: 0 },
    minSpent: { type: Number, default: 0 },
  },
  { _id: false }
);

const loyaltyRewardSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    pointsRequired: { type: Number, required: true },
    type: { type: String, required: true },
    value: { type: Number },
  },
  { _id: false }
);

const loyaltyConfigSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'main', unique: true },
    tiers: [loyaltyTierSchema],
    rewards: [loyaltyRewardSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model('LoyaltyConfig', loyaltyConfigSchema);

