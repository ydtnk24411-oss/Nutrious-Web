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
    isCombo:        { type: Boolean, default: false },
    comboItems:     { type: Array, default: [] },
    originalPriceNumber: { type: Number, default: 0 },
    comboSaving:    { type: Number, default: 0 },
    itemType:       { type: String, enum: ['regular', 'combo', 'addon'], default: 'regular' },
    linkedMainProduct:     { type: String, default: '' },
    linkedMainProductName: { type: String, default: '' },
    addonDiscountType:     { type: String, default: '' },
    addonDiscountValue:    { type: Number, default: 0 },
    addonSaving:           { type: Number, default: 0 },
    discountedByAddon:     { type: Boolean, default: false },
    promoNote:             { type: String, default: '' },
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
    comboDiscount: { type: Number, default: 0 },
    addonDiscount: { type: Number, default: 0 },
    voucherCode: { type: String, default: '' },
    shippingVoucherCode: { type: String, default: '' },
    shippingVoucherDiscount: { type: Number, default: 0 },
    shippingFee: { type: Number, default: 0 },
    shippingDiscount: { type: Number, default: 0 },
    shippingDistanceKm: { type: Number, default: 0 },
    shippingCoordinates: {
      lat: { type: Number },
      lng: { type: Number },
    },
    estimatedDeliveryTime: { type: String, default: '' },
    shippingDetails: { type: Object },
    pickupStore: { type: Object, default: null },
    deliveryTimeSlot: { type: String, default: '' },
    deliveryType: { type: String, default: '' },
    total:       { type: Number, required: true, min: 0 },
    shippingMethod: {
      type: String, enum: ['pickup', 'delivery'], default: 'pickup',
    },
    shippingAddress: { type: String, default: '' },
    paymentMethod: {
      type: String, enum: ['cod', 'bank_transfer'], default: 'cod',
    },
    paymentStatus: {
      type: String,
      enum: ['unpaid', 'paid', 'expired'],
      default: 'unpaid',
    },
    paymentExpiresAt: { type: Date, default: null },
    paidAt:           { type: Date, default: null },
    paymentReference: { type: String, default: '' },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'preparing', 'shipping', 'delivered', 'cancelled'],
      default: 'pending',
    },
    estimatedPoints: { type: Number, default: 0 },
    pointsAwarded:   { type: Boolean, default: false }, // đã cộng điểm cho chủ đơn chưa
    inventoryDeducted: { type: Boolean, default: true },
    inventoryRestored: { type: Boolean, default: false }, // đảm bảo hoàn kho đúng 1 lần khi hủy
    // Quy chế không hủy/đổi/trả cho hàng tươi sống (rau củ, trái cây, thịt, cá & hải sản)
    hasNonRefundableItems: { type: Boolean, default: false },
    nonRefundableAccepted: { type: Boolean, default: false },
    nonRefundableItems:    { type: Array, default: [] },
    note: { type: String, default: '' },
  },
  { timestamps: true }
);

// Tự động sinh orderCode dạng chữ + số có dấu gạch ngang (ví dụ 'XL-394737')
orderSchema.pre('save', function (next) {
  if (!this.orderCode) {
    this.orderCode = 'XL-' + Math.floor(100000 + Math.random() * 900000);
  }
  next();
});

module.exports = mongoose.model('Order', orderSchema);
