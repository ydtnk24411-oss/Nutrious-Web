const mongoose = require('mongoose');

const shipmentSchema = new mongoose.Schema(
  {
    shipmentCode: {
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
    warehouseId: {
      type: String,
      default: 'store-thuduc',
      index: true,
    },
    shippingMethod: {
      type: String,
      enum: ['delivery', 'pickup'],
      default: 'delivery',
      index: true,
    },
    shippingAddress: {
      type: String,
      default: '',
    },
    shippingFee: {
      type: Number,
      default: 0,
      min: 0,
    },
    codAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    shipperName: {
      type: String,
      default: '',
    },
    shipperPhone: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['pending', 'assigned', 'picked_up', 'in_transit', 'delivered', 'failed', 'cancelled'],
      default: 'pending',
      index: true,
    },
    deliveryProofImage: {
      type: String,
      default: '',
    },
    deliveredAt: {
      type: Date,
      default: null,
    },
    estimatedDeliveryTime: {
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

shipmentSchema.index({ warehouseId: 1, status: 1 });

module.exports = mongoose.model('Shipment', shipmentSchema);
