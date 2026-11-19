const mongoose = require('mongoose');

const transferItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    productName: {
      type: String,
      required: true,
      trim: true,
    },
    sku: {
      type: String,
      default: '',
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    unitPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: true }
);

const stockTransferSchema = new mongoose.Schema(
  {
    transferCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    sourceStoreId: {
      type: String,
      required: true,
      index: true,
    },
    sourceStoreName: {
      type: String,
      default: 'Tổng kho Evergreen Mart Thủ Đức',
    },
    targetStoreId: {
      type: String,
      required: true,
      index: true,
    },
    targetStoreName: {
      type: String,
      required: true,
    },
    items: [transferItemSchema],
    totalAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ['pending', 'in_transit', 'completed', 'cancelled'],
      default: 'completed',
      index: true,
    },
    sourceTicketId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StockAdjustmentTicket',
      default: null,
      index: true,
    },
    transferredAt: {
      type: Date,
      default: Date.now,
    },
    note: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

stockTransferSchema.index({ sourceStoreId: 1, targetStoreId: 1 });

module.exports = mongoose.model('StockTransfer', stockTransferSchema);
