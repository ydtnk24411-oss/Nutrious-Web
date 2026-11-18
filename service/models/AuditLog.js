const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    actorName: {
      type: String,
      required: true,
      trim: true,
    },
    actorEmail: {
      type: String,
      default: '',
      trim: true,
    },
    actorRole: {
      type: String,
      default: 'admin',
      trim: true,
    },
    action: {
      type: String,
      required: true,
      trim: true,
      index: true,
      comment: 'Tên hành động e.g. STAFF_ROLE_UPDATE, ORDER_STATUS_CHANGE, VOUCHER_CREATE...',
    },
    category: {
      type: String,
      enum: ['STAFF', 'ORDER', 'INVENTORY', 'VOUCHER', 'PRODUCT', 'FINANCE', 'SYSTEM'],
      default: 'SYSTEM',
      index: true,
    },
    targetType: {
      type: String,
      default: '',
    },
    targetId: {
      type: String,
      default: '',
    },
    details: {
      type: String,
      required: true,
      trim: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    ipAddress: {
      type: String,
      default: '127.0.0.1',
    },
    userAgent: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['SUCCESS', 'FAILED'],
      default: 'SUCCESS',
      index: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ category: 1, createdAt: -1 });
auditLogSchema.index({ actorRole: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
