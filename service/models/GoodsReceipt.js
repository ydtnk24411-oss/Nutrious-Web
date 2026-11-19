const mongoose = require('mongoose');

const goodsReceiptItemSchema = new mongoose.Schema(
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
    quantityReceived: {
      type: Number,
      required: true,
      min: 0,
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    batchCode: {
      type: String,
      default: '',
    },
    expDate: {
      type: Date,
      default: null,
    },
  },
  { _id: true }
);

const goodsReceiptSchema = new mongoose.Schema(
  {
    receiptCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      required: true,
      index: true,
    },
    supplierName: {
      type: String,
      required: true,
      trim: true,
    },
    warehouseId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    warehouseName: {
      type: String,
      default: 'Tổng kho Evergreen Mart Thủ Đức',
    },
    items: [goodsReceiptItemSchema],
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    debtAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    paymentStatus: {
      type: String,
      enum: ['unpaid', 'partial', 'paid'],
      default: 'partial',
      index: true,
    },
    status: {
      type: String,
      enum: ['draft', 'confirmed', 'completed', 'cancelled'],
      default: 'completed',
      index: true,
    },
    sourceTicketId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StockAdjustmentTicket',
      default: null,
      index: true,
    },
    receivedAt: {
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

goodsReceiptSchema.index({ supplierId: 1, paymentStatus: 1 });

module.exports = mongoose.model('GoodsReceipt', goodsReceiptSchema);
