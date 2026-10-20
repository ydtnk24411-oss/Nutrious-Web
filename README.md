# Nutrious Web - Xanh Lá Website

Website siêu thị Xanh Lá - Ứng dụng full-stack với Angular 19 + Node.js + MongoDB

## 📋 Tổng quan

Dự án bao gồm:
- **Frontend**: Angular 19 (TypeScript)
- **Backend**: Node.js + Express + MongoDB
- **Features**: Quản lý sản phẩm, giỏ hàng, đơn hàng, voucher, chương trình khách hàng thân thiết

## 🛠️ Tech Stack

### Frontend
- Angular 19
- TypeScript 5.6
- RxJS 7.8
- Angular CLI

### Backend
- Node.js
- Express 4.19
- MongoDB (Mongoose 8.5)
- JWT Authentication
- bcryptjs (mã hóa mật khẩu)

## 📦 Cài đặt môi trường

> **💡 Quick Setup**: Nếu bạn muốn hướng dẫn nhanh, xem file [SETUP.md](SETUP.md)

### Yêu cầu
- Node.js (>= 18.x)
- MongoDB (đang chạy tại localhost:27017)
- npm hoặc yarn

### Bước 1: Clone repository

```bash
git clone https://github.com/ydtnk24411-oss/Nutrious-Web.git
cd Nutrious-Web
```

### Bước 2: Cài đặt Backend

```bash
cd server
npm install
```

Tạo file `.env` trong thư mục `server` từ file `.env.example`:

```bash
cp .env.example .env
```

Hoặc tạo file `.env` với nội dung:

```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/xanh-la
JWT_SECRET=xanh-la-secret-key-2025
JWT_EXPIRE=7d
```

### Bước 3: Cài đặt Frontend

```bash
cd ..  # Quay về thư mục gốc
npm install
```

## 🚀 Chạy dự án

### Chạy MongoDB

Đảm bảo MongoDB đang chạy:

**Windows (sử dụng MongoDB service):**
```bash
# MongoDB sẽ tự động chạy nếu đã cài đặt
```

**Hoặc dùng Docker:**
```bash
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

### Seed dữ liệu mẫu (Backend)

Chạy script để chèn dữ liệu mẫu vào database:

```bash
cd server
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

### Chạy Backend

**Development mode (tự động restart):**
```bash
cd server
npm run dev
```

**Production mode:**
```bash
cd server
npm start
```

Backend sẽ chạy tại: `http://localhost:3000`

### Chạy Frontend

Mở terminal mới và chạy:

```bash
cd ..  # Quay về thư mục gốc
npm run dev
```

Frontend sẽ chạy tại: `http://localhost:4200`

## 📂 Cấu trúc dự án

```
Nutrious-Web/
├── src/                      # Frontend source
│   ├── app/                  # Angular components
│   ├── environments/         # Environment configs
│   ├── index.html            # Main HTML
│   ├── main.ts               # Entry point
│   └── styles.css            # Global styles
├── server/                   # Backend source
│   ├── src/
│   │   ├── index.js          # Server entry point
│   │   ├── seed.js           # Database seeding
│   │   ├── middleware/      # Express middleware
│   │   ├── models/           # Mongoose models
│   │   └── routes/           # API routes
│   ├── .env                  # Environment variables
│   └── package.json
├── angular.json              # Angular config
├── package.json              # Frontend dependencies
├── tsconfig.json             # TypeScript config
└── README.md                 # This file
```

## 🔌 API Endpoints

### Authentication
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

## 👤 Tài khoản demo

### Admin
- Email: `admin@xanhla.farm`
- Password: `admin123`

### Customer
- Email: `customer@example.com`
- Password: `customer123`

## 🏗️ Build cho Production

### Frontend
```bash
npm run build
```
Output sẽ được tạo trong thư mục `dist/xanh-la/`

### Backend
Backend không cần build, chỉ cần chạy:
```bash
cd server
npm start
```

## 🐛 Troubleshooting

### MongoDB không kết nối được
- Kiểm tra MongoDB đang chạy: `mongod` hoặc kiểm tra service
- Đảm bảo port 27017 không bị chặn
- Kiểm tra MONGODB_URI trong file `.env`

### Frontend không chạy được
- Xóa `node_modules` và cài lại: `rm -rf node_modules && npm install`
- Kiểm tra port 4200 không bị占用

### Backend không chạy được
- Xóa `node_modules` trong thư mục server và cài lại
- Kiểm tra file `.env` có tồn tại và đúng định dạng
- Đảm bảo JWT_SECRET được đặt

## 📝 License

© 2025 Xanh Lá. All rights reserved.
