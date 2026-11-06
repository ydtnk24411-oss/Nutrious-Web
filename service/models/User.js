const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const addressSchema = new mongoose.Schema({
  label: { type: String, default: 'Nhà riêng' },
  fullName: { type: String, required: true },
  phone: { type: String, required: true },
  address: { type: String, required: true },
  city: { type: String, required: true },
  isDefault: { type: Boolean, default: false },
}, { _id: true });

const userSchema = new mongoose.Schema(
  {
    name:      { type: String, required: true, trim: true },
    firstName: { type: String, default: '' },
    lastName:  { type: String, default: '' },
    title:     { type: String, default: '' },
    email:     { type: String, default: '', lowercase: true, trim: true },
    password:  { type: String, required: false, minlength: 6, select: false },
    phone:     { type: String, default: '', trim: true },
    avatar:    { type: String, default: '' },
    googleId:  { type: String, default: '' },
    googleEmail: { type: String, default: '' },
    googleLinkedAt: { type: Date, default: null },
    googleName: { type: String, default: '' },
    googleAvatar: { type: String, default: '' },
    authProvider: { type: String, enum: ['local', 'google'], default: 'local' },
    role:     { type: String, enum: ['customer', 'admin', 'sales', 'warehouse', 'support', 'content'], default: 'customer' },
    isActive: { type: Boolean, default: true },
    // Loyalty program
    points: { type: Number, default: 0 },
    tier: { type: String, enum: ['bronze', 'silver', 'gold', 'platinum'], default: 'bronze' },
    totalSpent: { type: Number, default: 0 },
    // Addresses
    addresses: [addressSchema],
  },
  { timestamps: true }
);

// Hash password before save
userSchema.pre('save', async function (next) {
  if (!this.password || !this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password
userSchema.methods.comparePassword = async function (plain) {
  if (!this.password) return false;
  return bcrypt.compare(plain, this.password);
};

// Partial unique indexes để bảo đảm tính duy nhất nhưng không xung đột với các bản ghi rỗng
userSchema.index(
  { phone: 1 },
  { unique: true, partialFilterExpression: { phone: { $type: 'string', $gt: '' } } }
);
userSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: 'string', $gt: '' } } }
);
userSchema.index(
  { googleId: 1 },
  { unique: true, partialFilterExpression: { googleId: { $type: 'string', $gt: '' } } }
);

module.exports = mongoose.model('User', userSchema);
