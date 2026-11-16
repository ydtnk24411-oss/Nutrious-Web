const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema(
  {
    product:      { type: String, required: true },
    productName:  { type: String, default: '' },
    productImage: { type: String, default: '' },
    price:        { type: Number, default: 0 },
    quantity:     { type: Number, default: 1, min: 1 },
    selectedOption:{ type: String, default: '' },
    isCombo:      { type: Boolean, default: false },
    addedAt:      { type: Date, default: Date.now },
  },
  { _id: false }
);

const cartSchema = new mongoose.Schema(
  {
    customerId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    sessionId:     { type: String, required: true, index: true },
    customerName:  { type: String, default: '' },
    customerEmail: { type: String, default: '' },
    customerPhone: { type: String, default: '' },
    items:         [cartItemSchema],
    totalAmount:   { type: Number, default: 0, min: 0 },
    itemCount:     { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ['Active', 'Abandoned', 'Converted'],
      default: 'Active',
      index: true,
    },
    lastUpdatedAt: { type: Date, default: Date.now, index: true },
    convertedOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Cart', cartSchema);
