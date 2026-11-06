const mongoose = require('mongoose');

const otpVerificationSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    code: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['register', 'change_phone'],
      required: true,
    },
    // Dữ liệu đăng ký tạm thời khi chưa hoàn tất OTP
    registrationData: {
      name: { type: String, default: '' },
      password: { type: String, default: '' },
      userId: { type: String, default: '' },
    },
    attempts: {
      type: Number,
      default: 0,
    },
    maxAttempts: {
      type: Number,
      default: 5,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // TTL index: MongoDB tự động dọn dẹp khi hết hạn
    },
    isUsed: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('OtpVerification', otpVerificationSchema);
