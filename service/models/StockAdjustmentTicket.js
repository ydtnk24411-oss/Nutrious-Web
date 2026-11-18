const mongoose = require('mongoose');

const ticketItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    productName: { type: String, required: true },
    sku: { type: String, default: '' },
    quantityDelta: {
      type: Number,
      required: true,
      comment: 'Số lượng thay đổi: Dương nếu nhập/tái nhập, Âm nếu hủy/hụt',
    },
    unitPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    lossValue: {
      type: Number,
      default: 0,
      min: 0,
      comment: 'Giá trị thiệt hại ước tính = |quantityDelta * unitPrice| khi hụt/hỏng',
    },
    batchCode: { type: String, default: '' },
    expDate: { type: Date, default: null },
    reason: { type: String, default: '' },
  },
  { _id: true }
);

const stockAdjustmentTicketSchema = new mongoose.Schema(
  {
    ticketCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    storeId: {
      type: String,
      required: true,
      index: true,
      comment: 'Mã chi nhánh phát sinh nghiệp vụ kho (hoặc kho xuất)',
    },
    storeName: {
      type: String,
      default: 'Kho Nông Sản Evergreen Mart',
    },
    targetStoreId: {
      type: String,
      default: '',
      index: true,
      comment: 'Mã chi nhánh nhận khi điều chuyển liên kho (store_transfer)',
    },
    targetStoreName: {
      type: String,
      default: '',
    },
    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      default: null,
    },
    supplierName: {
      type: String,
      default: '',
    },
    type: {
      type: String,
      enum: ['goods_receipt', 'spoilage_writeoff', 'cycle_count', 'boris_return', 'store_transfer'],
      required: true,
      comment:
        'goods_receipt: Nhập từ NCC | spoilage_writeoff: Xuất hủy hàng dập nát | cycle_count: Kiểm kê thực tế | boris_return: Tái nhập đổi trả | store_transfer: Điều chuyển liên kho',
    },
    items: [ticketItemSchema],
    totalAmount: {
      type: Number,
      default: 0,
      min: 0,
      comment: 'Tổng giá trị nhập kho từ NCC hoặc giá trị hàng điều chuyển',
    },
    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
      comment: 'Số tiền đã thanh toán cho NCC trong đợt nhập này',
    },
    paymentStatus: {
      type: String,
      enum: ['unpaid', 'partial', 'paid'],
      default: 'unpaid',
      comment: 'Tình trạng công nợ NCC: Chưa thanh toán / Một phần / Đã thanh toán đủ',
    },
    totalLossValue: {
      type: Number,
      default: 0,
      min: 0,
      comment: 'Tổng giá trị hàng hụt/hỏng của phiếu',
    },
    maxShortageQuantity: {
      type: Number,
      default: 0,
      min: 0,
      comment: 'Mức hụt sản phẩm lớn nhất của 1 mặt hàng trong phiếu',
    },
    requiresApproval: {
      type: Boolean,
      default: false,
      comment:
        'Bắt buộc Quản lý (Manager) duyệt nếu hụt > 3 sản phẩm HOẶC tổng thiệt hại > 500.000đ',
    },
    status: {
      type: String,
      enum: ['pending_approval', 'approved', 'rejected', 'in_transit', 'completed', 'cancelled'],
      default: 'approved',
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    creatorName: { type: String, default: '' },
    creatorRole: { type: String, default: 'warehouse' },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    approverName: { type: String, default: '' },
    approvedAt: { type: Date, default: null },
    rejectedReason: { type: String, default: '' },
    note: { type: String, default: '' },
    evidenceImages: { type: [String], default: [] },
  },
  { timestamps: true }
);

stockAdjustmentTicketSchema.index({ storeId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model(
  'StockAdjustmentTicket',
  stockAdjustmentTicketSchema
);
