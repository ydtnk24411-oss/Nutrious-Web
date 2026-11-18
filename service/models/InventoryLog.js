const mongoose = require('mongoose');

const inventoryLogSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String, required: true },
    type: {
      type: String,
      enum: ['import', 'export', 'adjustment', 'order_cancel', 'order_confirmed', 'pos_sale'],
      default: 'adjustment',
    },
    storeId: { type: String, default: 'default' },
    referenceId: { type: String, default: '' },
    delta: { type: Number, required: true },
    oldStock: { type: Number, required: true },
    newStock: { type: Number, required: true },
    reason: { type: String, required: true },
    note: { type: String, default: '' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

inventoryLogSchema.index({ createdAt: -1 });
inventoryLogSchema.index({ storeId: 1, createdAt: -1 });
inventoryLogSchema.index({ product: 1, createdAt: -1 });
inventoryLogSchema.index({ type: 1, createdAt: -1 });

module.exports = mongoose.model('InventoryLog', inventoryLogSchema);

