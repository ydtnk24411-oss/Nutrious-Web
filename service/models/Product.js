const mongoose = require('mongoose');

const optionSchema = new mongoose.Schema(
  { name: String, values: [String] },
  { _id: false }
);

const comboItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, default: 1, min: 1 },
  },
  { _id: false }
);

const addOnDealSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    discountType: { type: String, enum: ['percent', 'fixed'], default: 'percent' },
    discountValue: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    price: { type: String, default: '' },
    priceNumber: { type: Number, required: true, min: 0 },
    costPrice: { type: Number, default: 0, min: 0, comment: 'Đơn giá vốn nhập hàng cơ sở (VNĐ)' },
    image: { type: String, default: '' },
    images: { type: [String], default: [] },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null, index: true },
    category: { type: String, default: '' },
    categoryVi: { type: String, default: '' },
    description: { type: String, default: '' },
    brand: { type: String, default: '' },
    manufacturer: { type: String, default: '' },
    origin: { type: String, default: '' },
    unit: { type: String, default: '' },
    storageInstructions: { type: String, default: '' },
    usageInstructions: { type: String, default: '' },
    specifications: { type: mongoose.Schema.Types.Mixed, default: {} },
    container: { type: String, default: '' },
    cutType: { type: String, default: '' },
    cutting: { type: String, default: '' },
    packSize: { type: String, default: '' },
    packaging: { type: String, default: '' },
    preparation: { type: String, default: '' },
    quantity: { type: String, default: '' },
    ripeness: { type: String, default: '' },
    sizeGroup: { type: String, default: '' },
    thickness: { type: String, default: '' },
    type: { type: String, default: '' },
    weight: { type: String, default: '' },
    options: [optionSchema],
    isActive: { type: Boolean, default: true },
    stock: { type: Number, default: 100, min: 0 },
    reservedStock: { type: Number, default: 0, min: 0 },
    safetyBuffer: { type: Number, default: 2, min: 0 },
    maxPurchaseQuotaPerDay: { type: Number, default: 0, min: 0, comment: 'Định mức tối đa mỗi khách được mua/ngày (Anti-Hoarding)' },
    isCombo: { type: Boolean, default: false },
    comboStatus: {
      type: String,
      enum: ['active', 'paused', 'hidden'],
      default: 'active',
    },
    comboItems: [comboItemSchema],
    originalPriceNumber: { type: Number, default: 0, min: 0 },
    // Mua kèm tiết kiệm hơn: danh sách sản phẩm đề xuất mua kèm độc lập với Combo
    addOnDeals: { type: [addOnDealSchema], default: [] },
    averageRating: { type: Number, default: 5, min: 1, max: 5 },
    reviewCount: { type: Number, default: 0, min: 0 },
    soldCount: { type: Number, default: 0, min: 0 },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

productSchema.virtual('availableOnlineStock').get(function () {
  const physical = this.stock ?? 0;
  const reserved = this.reservedStock ?? 0;
  const buffer = this.safetyBuffer ?? 0;
  return Math.max(0, physical - reserved - buffer);
});

productSchema.index({ name: 'text', description: 'text' });
productSchema.index({ categoryId: 1, stock: 1 });
productSchema.index({ isActive: 1, createdAt: -1 });
productSchema.index({ isActive: 1, category: 1 });
productSchema.index({ isCombo: 1, comboStatus: 1 });
productSchema.index({ soldCount: -1 });
productSchema.index({ priceNumber: 1 });

module.exports = mongoose.model('Product', productSchema);
