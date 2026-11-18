const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null, // null nếu thông báo cho toàn bộ role (vd: Sales, Warehouse)
    },
    recipientRole: {
      type: String,
      enum: ['customer', 'admin', 'sales', 'warehouse', 'all'],
      default: null,
    },
    title: { type: String, required: true },
    body: { type: String, required: true },
    type: {
      type: String,
      enum: ['order', 'inventory', 'review', 'voucher', 'system'],
      default: 'system',
    },
    path: { type: String, default: '/account' },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
    unread: { type: Boolean, default: true },
  },
  { timestamps: true }
);

notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipientRole: 1, createdAt: -1 });
notificationSchema.index({ unread: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
