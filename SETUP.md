# QUICK SETUP GUIDE

Hướng dẫn nhanh để chạy dự án Xanh Lá Website

## 1. Clone Repository

```bash
git clone https://github.com/ydtnk24411-oss/Nutrious-Web.git
cd Nutrious-Web
```

## 2. Cài đặt MongoDB

**Option A: Cài MongoDB trên máy**
- Download MongoDB từ: https://www.mongodb.com/try/download/community
- Cài đặt và đảm bảo MongoDB service đang chạy

**Option B: Dùng Docker**
```bash
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

## 3. Cài đặt Backend

```bash
cd server
npm install
cp .env.example .env
```

Kiểm tra file `.env` có đúng:
```
PORT=3000
MONGODB_URI=mongodb://localhost:27017/xanh-la
JWT_SECRET=xanh-la-secret-key-2025
JWT_EXPIRE=7d
```

Seed dữ liệu mẫu:
```bash
npm run seed
```

Chạy backend:
```bash
npm run dev
```

Backend sẽ chạy tại: `http://localhost:3000`

## 4. Cài đặt Frontend

Mở terminal mới (giữ backend chạy):

```bash
cd ..  # Quay về thư mục gốc
npm install
npm run dev
```

Frontend sẽ chạy tại: `http://localhost:4200`

## 5. Test

Mở browser vào `http://localhost:4200`

Đăng nhập với tài khoản demo:
- **Admin**: admin@xanhla.farm / admin123
- **Customer**: customer@example.com / customer123

## Troubleshooting

**MongoDB không kết nối:**
- Kiểm tra MongoDB đang chạy: `mongod` hoặc service
- Đảm bảo port 27017 không bị chặn

**Frontend không chạy:**
```bash
rm -rf node_modules
npm install
npm run dev
```

**Backend không chạy:**
```bash
cd server
rm -rf node_modules
npm install
npm run dev
```

## Chi tiết

Xem file `README.md` để biết thêm về API endpoints, cấu trúc dự án, và tính năng chi tiết.
