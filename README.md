# Evergreen Mart - Project Architecture

Hệ thống được tổ chức thành 3 ứng dụng độc lập:

```text
Nutrious-Web/
│
├── service/          # Backend REST API (Node.js + Express + MongoDB)
│   ├── package.json
│   ├── server.js     # Entry point khởi chạy
│   ├── index.js      # Khởi tạo server & routes
│   ├── models/       # Mongoose schemas
│   ├── routes/       # API endpoints (/api/products, /api/orders, /api/complaints, ...)
│   ├── middleware/   # Auth & error handling
│   ├── data/         # Mock data & seeds
│   └── utils/
│
├── my-app/           # Frontend Người dùng (Storefront) - Angular 19
│   ├── angular.json
│   ├── package.json
│   ├── tsconfig.json
│   ├── public/       # Logo, avatars, static images
│   └── src/          # Source code người dùng (Pages, Components, Services)
│
├── admin/            # Frontend Quản trị (Admin Dashboard) - Angular 19
│   ├── angular.json
│   ├── package.json
│   ├── tsconfig.json
│   ├── public/       # Logo, avatars, static images
│   └── src/          # Source code trang quản trị (Admin Dashboard, Orders, Products, ...)
│
└── README.md
```

---

## Hướng dẫn khởi chạy từng ứng dụng độc lập

### 1. Backend Service (`service/`)

Backend đã tích hợp sẵn **`nodemon`** trong `service/package.json` (`devDependencies`) để tự động restart server mỗi khi code thay đổi.

1. Cài đặt dependencies (đã bao gồm `nodemon`):

```bash
cd service
npm install
```

*(Khuyến nghị nếu muốn dùng lệnh `nodemon` trực tiếp ở mọi thư mục trên máy: `npm install -g nodemon`)*

2. Tạo file `service/.env` từ `service/.env.example` và điền các biến môi trường cần thiết (`PORT`, `MONGODB_URI`, `JWT_SECRET`, `GEMINI_API_KEY`, `GOOGLE_CLIENT_ID`).

3. Chạy API server tại cổng `http://localhost:3000` ở chế độ **dev với `nodemon`** (khuyến nghị khi phát triển & test):

```bash
npm run dev
```

Hoặc chạy chế độ thường không tự reload (`node index.js`):
```bash
npm start
```

### 2. Frontend Người dùng (`my-app/`)

Chạy ứng dụng khách hàng tại cổng `http://localhost:4200`:

```bash
cd my-app
npm install
ng serve
```
Hoặc:
```bash
npm start
```

### 3. Frontend Quản trị (`admin/`)

Chạy ứng dụng quản trị tại cổng `http://localhost:4201`:

```bash
cd admin
npm install
ng serve
```
Hoặc:
```bash
npm start
```

---

## Bảng tra cứu cổng & dịch vụ

| Ứng dụng | Thư mục | Lệnh khởi chạy | Cổng truy cập |
|---|---|---|---|
| **Backend REST API** | `service/` | `npm run dev` (`nodemon`, khuyến nghị) / `npm start` | `http://localhost:3000` |
| **Storefront (Khách hàng)** | `my-app/` | `ng serve` | `http://localhost:4200` |
| **Admin Dashboard (Quản trị)** | `admin/` | `ng serve` | `http://localhost:4201` |
