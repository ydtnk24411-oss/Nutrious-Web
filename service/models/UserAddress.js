const mongoose = require('mongoose');

const userAddressSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    label: {
      type: String,
      default: 'Nhà riêng',
    },
    fullName: {
      type: String,
      default: 'Khách hàng',
      trim: true,
    },
    phone: {
      type: String,
      default: '',
      trim: true,
    },
    address: {
      type: String,
      required: true,
      trim: true,
    },
    city: {
      type: String,
      default: 'TP. Hồ Chí Minh',
    },
    province: {
      type: String,
      default: '',
    },
    provinceCode: {
      type: Number,
      default: null,
    },
    ward: {
      type: String,
      default: '',
    },
    wardCode: {
      type: Number,
      default: null,
    },
    street: {
      type: String,
      default: '',
    },
    lat: {
      type: Number,
      default: null,
    },
    lng: {
      type: Number,
      default: null,
    },
    isDefault: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

userAddressSchema.index({ userId: 1, isDefault: 1 });

module.exports = mongoose.model('UserAddress', userAddressSchema);
