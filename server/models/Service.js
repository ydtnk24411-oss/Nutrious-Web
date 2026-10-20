const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema(
  {
    name:        { type: String, required: true, trim: true },
    slug:        { type: String, required: true, unique: true, lowercase: true },
    subtitle:    { type: String, default: '' },
    price:       { type: String, required: true },
    priceNumber: { type: Number, required: true, min: 0 },
    description: { type: String, default: '' },
    status:      { type: String, default: '' },   // e.g. "Đã kết thúc"
    action:      { type: String, default: 'Đặt ngay' },
    isActive:    { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Service', serviceSchema);
