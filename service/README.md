# Xanh Lá Backend API

REST API cho siêu thị Xanh Lá - Node.js + Express + MongoDB

## Cài đặt

```bash
cd server
npm install
```

## Cấu hình

Copy hoặc tạo file `.env`:

```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/xanh-la
JWT_SECRET=xanh-la-secret-key-2025
JWT_EXPIRE=7d
```

## Chạy MongoDB

Đảm bảo MongoDB đang chạy:

```bash
# Windows ( nếu dùng MongoDB service)
# MongoDB sẽ tự động chạy nếu đã cài đặt

# Hoặc dùng Docker
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

## Seed dữ liệu

Để chèn dữ liệu mẫu:

```bash
npm run seed
```

Dữ liệu bao gồm:
- Sản phẩm (Rau củ, Trái cây, Thịt, Hải sản, Sữa, v.v.)
- Categories
- Events
- Services
- Vouchers
- Admin user: `admin@xanhla.farm` / `admin123`
- Demo customer: `customer@example.com` / `customer123`

## Chạy server

Development mode (tự động restart khi code thay đổi):

```bash
npm run dev
```

Production mode:

```bash
npm start
```

Server sẽ chạy tại: `http://localhost:3000`

## API Endpoints

### Auth
- `POST /api/auth/register` - Đăng ký
- `POST /api/auth/login` - Đăng nhập

### Account
- `GET /api/account/me` - Lấy thông tin user hiện tại
- `PUT /api/account/me` - Cập nhật profile
- `PUT /api/account/me/password` - Đổi mật khẩu
- `GET /api/account/addresses` - Lấy danh sách địa chỉ
- `POST /api/account/addresses` - Thêm địa chỉ mới
- `PUT /api/account/addresses/:id` - Cập nhật địa chỉ
- `DELETE /api/account/addresses/:id` - Xóa địa chỉ
- `PUT /api/account/addresses/:id/default` - Đặt địa chỉ mặc định

### Vouchers
- `GET /api/vouchers` - Lấy danh sách voucher khả dụng
- `GET /api/vouchers/my` - Lấy voucher của user
- `POST /api/vouchers/:id/claim` - Nhận voucher

### Loyalty
- `GET /api/loyalty/my` - Lấy thông tin điểm và hạng thành viên
- `POST /api/loyalty/redeem` - Đổi điểm lấy quà

### Orders
- `POST /api/orders` - Tạo đơn hàng mới
- `GET /api/orders/track/:code` - Theo dõi đơn hàng (public)
- `GET /api/orders/my` - Lấy đơn hàng của user
- `GET /api/orders/:code` - Lấy chi tiết đơn hàng
- `PUT /api/orders/:id/status` - Cập nhật trạng thái đơn (admin)

### Products
- `GET /api/products` - Lấy danh sách sản phẩm
- `GET /api/products/:id` - Lấy chi tiết sản phẩm

### Admin
- `GET /api/users` - Quản lý users
- `GET /api/dashboard` - Dashboard stats
- v.v.

## Database Schema

### User
```javascript
{
  name: String,
  email: String (unique),
  password: String,
  phone: String,
  avatar: String,
  role: 'customer' | 'admin',
  isActive: Boolean,
  points: Number,
  tier: 'bronze' | 'silver' | 'gold' | 'platinum',
  totalSpent: Number,
  addresses: [{
    label: String,
    fullName: String,
    phone: String,
    address: String,
    city: String,
    isDefault: Boolean
  }]
}
```

### Voucher
```javascript
{
  code: String (unique),
  name: String,
  description: String,
  discountType: 'percentage' | 'fixed',
  discountValue: Number,
  minOrderValue: Number,
  maxDiscountValue: Number,
  pointsRequired: Number,
  startDate: Date,
  endDate: Date,
  usageLimit: Number,
  usedCount: Number,
  isActive: Boolean,
  applicableCategories: [String]
}
```

### Order
```javascript
{
  orderCode: String (unique),
  user: ObjectId (ref: User),
  guestName: String,
  guestEmail: String,
  guestPhone: String,
  items: [{
    productName: String,
    productImage: String,
    productPrice: String,
    priceNumber: Number,
    quantity: Number,
    selectedOption: String
  }],
  subtotal: Number,
  discount: Number,
  voucherCode: String,
  shippingFee: Number,
  total: Number,
  shippingMethod: 'pickup' | 'delivery',
  shippingAddress: String,
  paymentMethod: 'cod' | 'bank_transfer',
  status: 'pending' | 'confirmed' | 'preparing' | 'shipping' | 'delivered' | 'cancelled',
  estimatedPoints: Number,
  note: String
}
```
