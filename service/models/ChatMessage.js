const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    sessionId: {
      type: String,
      default: '',
      index: true,
    },
    sender: {
      type: String,
      enum: ['customer', 'ai', 'admin'],
      required: true,
      index: true,
    },
    senderName: {
      type: String,
      default: '',
    },
    staffName: {
      type: String,
      default: '',
    },
    senderAvatar: {
      type: String,
      default: '',
    },
    content: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

chatMessageSchema.index({ conversationId: 1, timestamp: 1 });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
