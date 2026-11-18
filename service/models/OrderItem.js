const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
    },
    orderCode: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    product: {
      type: String,
      default: '',
      index: true,
    },
    productName: {
      type: String,
      required: true,
      trim: true,
    },
    categoryName: {
      type: String,
      default: '',
    },
    productImage: {
      type: String,
      default: '',
    },
    priceNumber: {
      type: Number,
      required: true,
      min: 0,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    selectedOption: {
      type: String,
      default: '',
    },
    isCombo: {
      type: Boolean,
      default: false,
    },
    itemType: {
      type: String,
      enum: ['regular', 'combo', 'addon'],
      default: 'regular',
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { timestamps: true }
);

orderItemSchema.index({ orderId: 1, product: 1 });

module.exports = mongoose.model('OrderItem', orderItemSchema);
