const mongoose = require('mongoose');

const userVoucherSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    voucher: { type: mongoose.Schema.Types.ObjectId, ref: 'Voucher', required: true },
    status: { type: String, enum: ['available', 'used', 'expired'], default: 'available' },
    receivedAt: { type: Date, default: Date.now },
    usedAt: { type: Date },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  },
  { timestamps: true }
);

// Index để nhanh khi tìm kiếm voucher của user
userVoucherSchema.index({ user: 1, status: 1 });
userVoucherSchema.index({ voucher: 1 });

module.exports = mongoose.model('UserVoucher', userVoucherSchema);
