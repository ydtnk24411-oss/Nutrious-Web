const mongoose = require('mongoose');

const batchSchema = new mongoose.Schema(
  {
    batchCode: { type: String, required: true, trim: true },
    expDate: { type: Date, required: true },
    quantity: { type: Number, required: true, min: 0 },
    receivedDate: { type: Date, default: Date.now },
  },
  { _id: false }
);

const storeInventorySchema = new mongoose.Schema(
  {
    storeId: {
      type: String,
      required: true,
      trim: true,
      index: true,
      default: 'default',
    },
    storeName: {
      type: String,
      default: 'Kho Nông Sản Evergreen Mart',
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    sku: {
      type: String,
      default: '',
      trim: true,
    },
    physicalStock: {
      type: Number,
      default: 0,
      min: 0,
      required: true,
      comment: 'Tồn kho thực tế trên kệ hoặc kho chi nhánh',
    },
    reservedStock: {
      type: Number,
      default: 0,
      min: 0,
      comment: 'Tồn kho đang giữ chỗ cho các đơn hàng Online chờ đóng gói',
    },
    safetyBuffer: {
      type: Number,
      default: 2,
      min: 0,
      comment: 'Ngưỡng đệm tồn kho an toàn để ưu tiên khách mua trực tiếp tại quầy POS',
    },
    damagedStock: {
      type: Number,
      default: 0,
      min: 0,
      comment: 'Số lượng hàng dập nát, hỏng, hết hạn đã hủy bỏ khỏi kệ',
    },
    storePrice: {
      type: Number,
      default: null,
      comment: 'Giá bán riêng tại chi nhánh (nếu null thì dùng giá niêm yết của Product)',
    },
    storeDiscountPrice: {
      type: Number,
      default: null,
      comment: 'Giá giảm xả hàng cuối ngày riêng của chi nhánh do Cửa hàng trưởng thiết lập',
    },
    batches: {
      type: [batchSchema],
      default: [],
      comment: 'Theo dõi các lô hàng và hạn sử dụng để hỗ trợ thuật toán FEFO',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound index đảm bảo 1 chi nhánh chỉ có 1 bản ghi tồn kho cho mỗi sản phẩm
storeInventorySchema.index({ storeId: 1, productId: 1 }, { unique: true });
storeInventorySchema.index({ storeId: 1, sku: 1 });

// Công thức tính Tồn kho hiển thị khả dụng cho kênh Online:
// availableOnlineStock = Math.max(0, physicalStock - reservedStock - safetyBuffer)
storeInventorySchema.virtual('availableOnlineStock').get(function () {
  const physical = this.physicalStock ?? 0;
  const reserved = this.reservedStock ?? 0;
  const buffer = this.safetyBuffer ?? 0;
  return Math.max(0, physical - reserved - buffer);
});

module.exports = mongoose.model('StoreInventory', storeInventorySchema);
