const mongoose = require('mongoose');

const voucherSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true },
    name: { type: String, required: true },
    description: { type: String },
    voucherType: {
      type: String,
      enum: ['ORDER_DISCOUNT', 'SHIPPING_DISCOUNT'],
      default: 'ORDER_DISCOUNT',
    },
    discountType: { type: String, enum: ['percentage', 'fixed'], required: true },
    discountValue: { type: Number, required: true },
    minOrderValue: { type: Number, default: 0 },
    maxDiscountValue: { type: Number, default: null },
    pointsRequired: { type: Number, default: 0 },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    usageLimit: { type: Number, default: 0 }, // 0 = unlimited
    usedCount: { type: Number, default: 0 },
    maxUsagePerUser: { type: Number, default: 0 }, // 0 = unlimited per user; >0 = trần số lần/khách (ví dụ 1, 3, 5)
    isFirstOrderOnly: { type: Boolean, default: false },
    isPublic: { type: Boolean, default: true },
    assignedCustomerIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    activeTimeWindow: {
      start: { type: String, default: null },
      end: { type: String, default: null },
    },
    activeDaysOfWeek: [{ type: Number }],
    applicableCategories: [{ type: String }],
    applicableProductIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    excludeSaleItems: { type: Boolean, default: false },
    requiredPaymentMethod: { type: String, default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Voucher', voucherSchema);
