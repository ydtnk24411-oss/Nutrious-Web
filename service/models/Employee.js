const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema(
  {
    employeeCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      default: '',
      trim: true,
    },
    role: {
      type: String,
      required: true,
      index: true,
    },
    department: {
      type: String,
      default: 'Vận hành siêu thị',
    },
    assignedStore: {
      type: String,
      default: 'all',
      trim: true,
      index: true,
    },
    assignedStoreIds: {
      type: [String],
      default: ['all'],
    },
    storeName: {
      type: String,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

employeeSchema.index({ assignedStore: 1, role: 1 });

module.exports = mongoose.model('Employee', employeeSchema);
