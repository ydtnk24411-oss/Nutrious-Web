# QUICK SETUP GUIDE

Hướng dẫn nhanh để chạy dự án Xanh Lá Website

## 1. Clone Repository

```bash
git clone https://github.com/ydtnk24411-oss/Nutrious-Web.git
cd Nutrious-Web
```

## 2. Cài đặt MongoDB

**Option A: Dùng MongoDB Atlas (Khuyên dùng)**
1. Đăng ký tài khoản MongoDB Atlas miễn phí: https://www.mongodb.com/cloud/atlas
2. Tạo cluster mới (hoặc dùng cluster hiện có)
3. Trong dashboard Atlas:
   - Vào **Database Access** → tạo user admin
   - Vào **Network Access** → cho phép IP `0.0.0.0/0` (cho phép tất cả IP) hoặc IP của bạn
   - Vào **Database** → xem connection string

4. Copy MongoDB connection string của bạn (định dạng: `mongodb+srv://...`)

**Option B: Cài MongoDB trên máy**
|- Download MongoDB từ: https://www.mongodb.com/try/download/community
|- Cài đặt và đảm bảo MongoDB service đang chạy

**Option C: Dùng Docker**
```bash
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

## 3. Cài đặt Backend

```bash
cd server
npm install
cp .env.example .env
```

**Nếu dùng MongoDB Atlas:**
Cập nhật file `.env` với connection string của bạn:
```
PORT=3000
MONGODB_URI=mongodb+srv://k24411web2:NhomAcong@cluster0.ltnac9s.mongodb.net/
JWT_SECRET=xanh-la-secret-key-2025
JWT_EXPIRE=7d

```


**Nếu dùng MongoDB cài local:**
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
|- **Admin**: admin@xanhla.farm / admin123
|- **Customer**: customer@example.com / customer123

## Troubleshooting

**MongoDB Atlas không kết nối:**
- Kiểm tra Network Access đã cho phép IP của bạn
- Kiểm tra Database Access user có đúng quyền
- Đảm bảo connection string đúng (thay <password> bằng password thực)
- Đợi 2-3 phút cho cluster khởi động (nếu cluster mới tạo)

**MongoDB local không kết nối:**
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
