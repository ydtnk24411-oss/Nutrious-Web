const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    paymentCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
    },
    orderCode: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: ['cod', 'bank_transfer', 'loyalty_points', 'vnpay', 'momo'],
      required: true,
      default: 'cod',
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'VND',
    },
    pointsUsed: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ['pending', 'success', 'failed', 'refunded', 'expired', 'cancelled'],
      default: 'pending',
      index: true,
    },
    transactionReference: {
      type: String,
      default: '',
      trim: true,
    },
    qrUrl: {
      type: String,
      default: '',
    },
    paidAt: {
      type: Date,
      default: null,
    },
    settled: {
      type: Boolean,
      default: false,
      index: true,
    },
    settledAt: {
      type: Date,
      default: null,
    },
    settledBy: {
      type: String,
      default: '',
    },
    note: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

paymentSchema.index({ orderCode: 1, paymentMethod: 1 });
paymentSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Payment', paymentSchema);
