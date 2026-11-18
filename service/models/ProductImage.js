const mongoose = require('mongoose');

const productImageSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    imageUrl: {
      type: String,
      required: true,
    },
    imageType: {
      type: String,
      enum: ['thumbnail', 'gallery', 'nutrition_facts', 'certification', 'packaging'],
      default: 'thumbnail',
      index: true,
    },
    caption: {
      type: String,
      default: '',
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    isPrimary: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

productImageSchema.index({ productId: 1, sortOrder: 1 });

module.exports = mongoose.model('ProductImage', productImageSchema);
