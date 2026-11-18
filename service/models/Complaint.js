const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema(
  {
    complaintCode: { type: String, unique: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    customerName: { type: String, required: true },
    customerPhone: { type: String, default: '' },
    customerEmail: { type: String, default: '' },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
    warehouseId: { type: String, default: 'store-thuduc', index: true },
    type: {
      type: String,
      enum: ['product', 'delivery', 'order', 'payment', 'other'],
      default: 'product',
    },
    title: { type: String, required: true },
    description: { type: String, required: true },
    images: [{ type: String }],
    status: {
      type: String,
      enum: ['pending', 'processing', 'resolved', 'rejected'],
      default: 'pending',
      index: true,
    },
    resolutionNote: { type: String, default: '' },
    resolvedAt: { type: Date, default: null },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

complaintSchema.pre('save', function (next) {
  if (!this.complaintCode) {
    this.complaintCode = 'KN-' + Math.floor(10000 + Math.random() * 90000);
  }
  next();
});

complaintSchema.index({ createdAt: -1 });
complaintSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Complaint', complaintSchema);

