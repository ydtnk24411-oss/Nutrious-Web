const mongoose = require('mongoose');

const distanceTierSchema = new mongoose.Schema(
  {
    minKm: { type: Number, required: true, min: 0 },
    maxKm: { type: Number, required: true },
    fee:   { type: Number, required: true, min: 0 },
    label: { type: String, default: '' },
  },
  { _id: false }
);

const orderDiscountSchema = new mongoose.Schema(
  {
    minOrderValue:  { type: Number, required: true, min: 0 },
    discountAmount: { type: Number, required: true, min: 0 },
    label:          { type: String, default: '' },
  },
  { _id: false }
);

const shippingConfigSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      unique: true,
      default: 'default',
    },
    warehouse: {
      name:    { type: String, default: 'Kho Nông Sản Evergreen Mart' },
      address: { type: String, default: 'Khu phố 6, Phường Linh Trung, TP. Thủ Đức, TP. Hồ Chí Minh' },
      lat:     { type: Number, default: 10.8703 }, // Tọa độ thực tế tại Việt Nam
      lng:     { type: Number, default: 106.7782 }, // Tọa độ thực tế tại Việt Nam
    },
    distanceTiers: {
      type: [distanceTierSchema],
      default: () => [
        { minKm: 0, maxKm: 2, fee: 15000, label: '0–2 km' },
        { minKm: 2, maxKm: 5, fee: 20000, label: 'Trên 2–5 km' },
        { minKm: 5, maxKm: 8, fee: 25000, label: 'Trên 5–8 km' },
        { minKm: 8, maxKm: 10, fee: 30000, label: 'Trên 8–10 km' },
      ],
    },
    maxDeliveryRadiusKm: {
      type: Number,
      default: 10, // Trên 10km không hỗ trợ giao thực phẩm tươi
    },
    orderDiscounts: {
      type: [orderDiscountSchema],
      default: () => [
        { minOrderValue: 499000, discountAmount: 15000, label: 'Đơn từ 499.000đ: giảm 15.000đ phí ship' },
        { minOrderValue: 299000, discountAmount: 10000, label: 'Đơn từ 299.000đ: giảm 10.000đ phí ship' },
        { minOrderValue: 199000, discountAmount: 5000,  label: 'Đơn từ 199.000đ: giảm 5.000đ phí ship' },
      ],
    },
    foodPreservationPolicy: {
      type: String,
      default: 'Ưu tiên giao nhanh trong ngày bằng xe bảo quản lạnh / túi giữ nhiệt thực phẩm. Không phụ thu phí bảo quản.',
    },
    isServiceActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ShippingConfig', shippingConfigSchema);

