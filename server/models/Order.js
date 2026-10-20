const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema(
  {
    product:        { type: String, default: '' },  // MongoDB _id hoặc slug — optional snapshot
    productName:    { type: String, required: true },
    productImage:   { type: String, default: '' },
    productPrice:   { type: String, default: '' },
    priceNumber:    { type: Number, required: true },
    quantity:       { type: Number, required: true, min: 1 },
    selectedOption: { type: String, default: '' },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderCode:   { type: String, unique: true },
    user:        { type: mongoose.Schema.Types.ObjectId, ref: 'User' },  // nullable (guest)
    guestName:   { type: String, default: '' },
    guestEmail:  { type: String, default: '' },
    guestPhone:  { type: String, default: '' },
    items:       [orderItemSchema],
    subtotal:    { type: Number, required: true, min: 0 },
    discount:    { type: Number, default: 0 },
    voucherCode: { type: String, default: '' },
    shippingFee: { type: Number, default: 0 },
    total:       { type: Number, required: true, min: 0 },
    shippingMethod: {
      type: String, enum: ['pickup', 'delivery'], default: 'pickup',
    },
    shippingAddress: { type: String, default: '' },
    paymentMethod: {
      type: String, enum: ['cod', 'bank_transfer'], default: 'cod',
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'preparing', 'shipping', 'delivered', 'cancelled'],
      default: 'pending',
    },
    estimatedPoints: { type: Number, default: 0 },
    note: { type: String, default: '' },
  },
  { timestamps: true }
);

// Auto-generate orderCode before save
orderSchema.pre('save', function (next) {
  if (!this.orderCode) {
    this.orderCode = 'XL-' + Math.floor(100000 + Math.random() * 900000);
  }
  next();
});

module.exports = mongoose.model('Order', orderSchema);
