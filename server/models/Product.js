const mongoose = require('mongoose');

const optionSchema = new mongoose.Schema(
  { name: String, values: [String] },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    name:        { type: String, required: true, trim: true },
    slug:        { type: String, required: true, unique: true, lowercase: true },
    price:       { type: String, required: true },           // display string "25 ₫"
    priceNumber: { type: Number, required: true, min: 0 },
    image:       { type: String, default: '' },
    category:    { type: String, enum: ['Vegetables', 'Fruits', 'Meat', 'Seafood', 'Dairy', 'Beverages', 'Bakery', 'Pantry', 'Personal', 'Household'], required: true },
    categoryVi:  { type: String, default: '' },
    description: { type: String, default: '' },
    container:   { type: String, default: '' },
    cutType:     { type: String, default: '' },
    cutting:     { type: String, default: '' },
    packSize:    { type: String, default: '' },
    packaging:   { type: String, default: '' },
    preparation: { type: String, default: '' },
    quantity:    { type: String, default: '' },
    ripeness:    { type: String, default: '' },
    sizeGroup:   { type: String, default: '' },
    thickness:   { type: String, default: '' },
    type:        { type: String, default: '' },
    weight:      { type: String, default: '' },
    options:     [optionSchema],
    isActive:    { type: Boolean, default: true },
    stock:       { type: Number, default: 100, min: 0 },
  },
  { timestamps: true }
);

productSchema.index({ name: 'text', description: 'text' });

module.exports = mongoose.model('Product', productSchema);
