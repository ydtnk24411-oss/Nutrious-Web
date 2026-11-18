const mongoose = require('mongoose');

const comboItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, default: 1, min: 1 },
  },
  { _id: false }
);

const comboSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    price: { type: String, required: true },
    priceNumber: { type: Number, required: true, min: 0 },
    originalPriceNumber: { type: Number, default: 0, min: 0 },
    image: { type: String, default: '' },
    images: { type: [String], default: [] },
    category: { type: String, default: 'combo' },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    categoryVi: { type: String, default: 'Combo tiết kiệm' },
    description: { type: String, default: '' },
    brand: { type: String, default: 'Evergreen Mart' },
    unit: { type: String, default: '' },
    comboStatus: {
      type: String,
      enum: ['active', 'paused', 'hidden'],
      default: 'active',
    },
    isActive: { type: Boolean, default: true },
    stock: { type: Number, default: 0, min: 0 },
    comboItems: { type: [comboItemSchema], default: [] },
    averageRating: { type: Number, default: 5, min: 1, max: 5 },
    reviewCount: { type: Number, default: 0, min: 0 },
    soldCount: { type: Number, default: 0, min: 0 },
  },
  {
    timestamps: true,
    collection: 'combos',
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

comboSchema.index({ name: 'text', description: 'text' });
comboSchema.index({ categoryId: 1, stock: 1 });
comboSchema.index({ 'comboItems.product': 1 });

module.exports = mongoose.model('Combo', comboSchema);

