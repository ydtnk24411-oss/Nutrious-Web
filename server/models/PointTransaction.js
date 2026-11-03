const mongoose = require('mongoose');

// Lịch sử cộng/trừ điểm của từng tài khoản (server là nguồn dữ liệu duy nhất).
const pointTransactionSchema = new mongoose.Schema(
  {
    user:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type:         { type: String, enum: ['earned', 'redeemed', 'adjusted'], required: true },
    amount:       { type: Number, required: true },        // dương = cộng, âm = trừ
    description:  { type: String, default: '' },
    order:        { type: String, default: '' },           // orderCode (nếu từ đơn hàng)
    rewardId:     { type: String, default: '' },
    voucherCode:  { type: String, default: '' },
    balanceAfter: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PointTransaction', pointTransactionSchema);

