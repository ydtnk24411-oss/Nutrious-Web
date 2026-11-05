const mongoose = require('mongoose');

const flashSaleSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    name: {
      type: String,
      default: '',
    },
    slug: {
      type: String,
      default: '',
    },
    category: {
      type: String,
      default: 'Nông sản',
    },
    description: {
      type: String,
      default: '',
    },
    image: {
      type: String,
      default: '',
    },
    originalPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    flashSalePrice: {
      type: Number,
      required: true,
      min: 0,
    },
    discountPercent: {
      type: Number,
      default: 0,
    },
    totalQuantity: {
      type: Number,
      required: true,
      min: 1,
    },
    soldQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: {
      type: Date,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Virtual field for checking sold percentage
flashSaleSchema.virtual('soldPercent').get(function () {
  if (!this.totalQuantity || this.totalQuantity <= 0) return 0;
  return Math.min(100, Math.round((this.soldQuantity / this.totalQuantity) * 100));
});

// Virtual field for checking if sold out
flashSaleSchema.virtual('isSoldOut').get(function () {
  return this.soldQuantity >= this.totalQuantity;
});

flashSaleSchema.set('toJSON', { virtuals: true });
flashSaleSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('FlashSale', flashSaleSchema);

