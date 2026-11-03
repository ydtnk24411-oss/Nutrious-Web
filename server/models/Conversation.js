const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: String,
      enum: ['customer', 'ai', 'admin'],
      required: true,
    },
    senderName: { type: String, default: '' },
    senderAvatar: { type: String, default: '' },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    isRead: { type: Boolean, default: false },
  },
  { _id: true }
);

const conversationSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, index: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    customerName: { type: String, default: 'Khách hàng' },
    customerEmail: { type: String, default: '' },
    customerPhone: { type: String, default: '' },
    status: {
      type: String,
      enum: ['AI_PROCESSING', 'WAITING_FOR_ADMIN', 'ADMIN_PROCESSING', 'RESOLVED'],
      default: 'AI_PROCESSING',
      index: true,
    },
    lastMessage: { type: String, default: '' },
    lastMessageAt: { type: Date, default: Date.now },
    unreadAdminCount: { type: Number, default: 0 },
    unreadCustomerCount: { type: Number, default: 0 },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    relatedOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
    messages: [messageSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Conversation', conversationSchema);

