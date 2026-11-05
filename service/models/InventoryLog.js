const mongoose = require('mongoose');

const inventoryLogSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String, required: true },
    type: {
      type: String,
      enum: ['import', 'export', 'adjustment', 'order_cancel', 'order_confirmed'],
      default: 'adjustment',
    },
    delta: { type: Number, required: true },
    oldStock: { type: Number, required: true },
    newStock: { type: Number, required: true },
    reason: { type: String, required: true },
    note: { type: String, default: '' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('InventoryLog', inventoryLogSchema);

