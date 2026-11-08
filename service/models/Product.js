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
    price: { type: String, required: true },           // display string "25 ₫"
    priceNumber: { type: Number, required: true, min: 0 },
    image: { type: String, default: '' },
    category: { type: String, default: '' },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
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
    // Combo mua kèm tiết kiệm: combo là một sản phẩm riêng có giá ưu đãi
    isCombo: { type: Boolean, default: false },
    comboItems: [comboItemSchema],
    originalPriceNumber: { type: Number, default: 0, min: 0 }, // tổng giá mua lẻ
    // Mua kèm tiết kiệm hơn: danh sách sản phẩm đề xuất mua kèm độc lập với Combo
    addOnDeals: { type: [addOnDealSchema], default: [] },
  },
  { timestamps: true }
);

productSchema.index({ name: 'text', description: 'text' });

module.exports = mongoose.model('Product', productSchema);
