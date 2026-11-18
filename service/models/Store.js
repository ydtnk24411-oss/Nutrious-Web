const mongoose = require('mongoose');

const pointSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number], // [longitude (kinh độ), latitude (vĩ độ)]
      required: true,
    },
  },
  { _id: false }
);

const operatingHoursSchema = new mongoose.Schema(
  {
    open: { type: String, default: '06:30' },
    close: { type: String, default: '21:30' },
  },
  { _id: false }
);

const storeSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true }, // Mã định danh e.g. 'store-thuduc', 'store-q1'
    code: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    province: { type: String, default: '' },
    district: { type: String, default: '' },
    phone: { type: String, default: '' },
    location: {
      type: pointSchema,
      required: true,
      index: '2dsphere',
    },
    deliveryRadiusMeters: { type: Number, default: 5000 }, // Bán kính giao tối đa (mét)
    maxActiveOrders: { type: Number, default: 40 }, // Ngưỡng chịu tải đơn đồng thời
    currentActiveOrders: { type: Number, default: 0 },
    operatingHours: {
      type: operatingHoursSchema,
      default: () => ({ open: '06:30', close: '21:30' }),
    },
    isAcceptingOnlineOrders: { type: Boolean, default: true },
    isHeadquarter: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Store', storeSchema);
