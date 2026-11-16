const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const addressSchema = new mongoose.Schema({
  label: { type: String, default: 'Nhà riêng' },
  fullName: { type: String, required: true },
  phone: { type: String, required: true },
  address: { type: String, required: true },
  city: { type: String, required: true },
  // Địa chỉ có cấu trúc theo đơn vị hành chính 2 cấp (Tỉnh/Thành → Phường/Xã)
  province: { type: String, default: '' },
  provinceCode: { type: Number, default: null },
  ward: { type: String, default: '' },
  wardCode: { type: Number, default: null },
  street: { type: String, default: '' },
  // Tọa độ ghim giao hàng do khách hàng xác nhận trên bản đồ
  lat: { type: Number, default: null },
  lng: { type: Number, default: null },
  isDefault: { type: Boolean, default: false },
}, { _id: true });

const viewedProductSchema = new mongoose.Schema(
  {
    product:     { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    slug:        { type: String, required: true },
    name:        { type: String, required: true },
    image:       { type: String, default: '' },
    price:       { type: String, required: true },
    priceNumber: { type: Number, required: true, min: 0 },
    weight:      { type: String, default: '' },
    unit:        { type: String, default: '' },
    categoryVi:  { type: String, default: '' },
    viewedAt:    { type: Date, default: Date.now },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name:      { type: String, required: true, trim: true },
    firstName: { type: String, default: '' },
    lastName:  { type: String, default: '' },
    title:     { type: String, default: '' },
    email:     { type: String, default: '', lowercase: true, trim: true },
    password:  { type: String, required: false, minlength: 8, select: false },
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
    // Danh sách sản phẩm yêu thích (Wishlist)
    wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    // Lịch sử sản phẩm đã xem (gắn riêng theo từng tài khoản)
    viewedProducts: { type: [viewedProductSchema], default: [], select: false },
  },
  { timestamps: true }
);

// Hash password before save
const crypto = require('crypto');

userSchema.pre('save', async function (next) {
  if (!this.password || !this.isModified('password')) return next();
  // Nếu mật khẩu đã là chuỗi băm một chiều SHA-256 (64 hex characters) hoặc bcrypt thì không băm lại
  if (/^[a-f0-9]{64}$/i.test(this.password)) {
    return next();
  }
  if (typeof this.password === 'string' && /^\$2[aby]\$\d{2}\$/.test(this.password) && this.password.length === 60) {
    return next();
  }
  // Mặc định băm bằng SHA-256 theo yêu cầu bảo mật nghiệp vụ
  this.password = crypto.createHash('sha256').update(this.password).digest('hex');
  next();
});

// Compare password (hỗ trợ cả bcrypt và SHA-256 đối chiếu)
userSchema.methods.comparePassword = async function (plain) {
  if (!this.password) return false;
  // 1. Kiểm tra đối chiếu bcrypt tiêu chuẩn
  if (this.password.startsWith('$2')) {
    const isBcryptMatch = await bcrypt.compare(plain, this.password);
    if (isBcryptMatch) return true;
  }
  // 2. Kiểm tra đối chiếu chuỗi băm một chiều SHA-256
  const sha256Hash = crypto.createHash('sha256').update(plain).digest('hex');
  if (this.password === sha256Hash) return true;

  // 3. Nếu dữ liệu lưu dạng plain text (dev seed) thì kiểm tra trực tiếp
  if (this.password === plain) return true;

  return false;
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
