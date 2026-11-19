# Hướng Dẫn Thiết Lập Dữ Liệu & Khởi Chạy Dự Án — Evergreen Mart (Nutrious-Web)

Tài liệu này hướng dẫn Giảng viên nạp đầy đủ dữ liệu mẫu (`41` collections, toàn bộ sản phẩm, combo, tồn kho 8 chi nhánh, nhân sự phân quyền, đơn hàng, voucher, flash sale, banner, đánh giá, công thức dinh dưỡng...) để khởi chạy và kiểm thử đầy đủ cả **Storefront (Client)** và **Admin Portal**.

---

## 1. Yêu cầu cài đặt trên máy

- **Node.js** `18.x` hoặc `20.x LTS` (kèm `npm`)
- **Angular CLI** (`npm install -g @angular/cli` hoặc dùng `npm start` trong từng thư mục)
- **MongoDB Community Server** (nếu chạy **Cách 1 – Offline trên máy cá nhân**; không cần cài nếu dùng **Cách 2 – MongoDB Atlas**)

---

## 2. Cấu hình & Nạp Dữ Liệu Database (Chọn 1 trong 2 cách)

### Cách 1: Chạy Offline 100% trên MongoDB Local *(Khuyên dùng khi chấm bài, không cần `.env`, không lo mạng chặn Atlas)*

Dự án đã đóng gói sẵn toàn bộ snapshot dữ liệu mẫu trong [`service/data/xanh-la-snapshot.json.gz`](service/data/xanh-la-snapshot.json.gz) kèm script nạp 1 lệnh (`import-data`, không cần cài `mongorestore`). **Backend đã cấu hình sẵn giá trị mặc định** (`PORT=3000`, `MONGODB_URI=mongodb://127.0.0.1:27017/xanh-la`, `JWT_SECRET`, thông tin VietQR), nên chạy Offline **không cần tạo file `service/.env`**.

1. Đảm bảo **MongoDB Service** trên máy đang chạy ở cổng mặc định `27017` (`mongodb://127.0.0.1:27017`).
2. Mở terminal tại thư mục `service/`, cài đặt thư viện và nạp toàn bộ dữ liệu:
   ```bash
   cd service
   npm install
   npm run import-data
   ```
   *(Nếu trong máy có sẵn file `service/.env` đang trỏ đi nơi khác, chạy `npm run import-data -- --local` để ép nạp vào `mongodb://127.0.0.1:27017/xanh-la`)*

3. Khi terminal hiển thị `[OK] Da nap xong 19559 ban ghi vao 41 collections.` là dữ liệu đã sẵn sàng.

> *(Lưu ý: Không chạy lệnh `npm run seed` cũ khi dùng offline vì `seed-data.js` được viết để đồng bộ từ Atlas về).*

---

### Cách 2: Kết nối trực tiếp MongoDB Atlas chung của nhóm *(Không cần nạp dữ liệu)*

1. Mở terminal cài dependencies cho Backend:
   ```bash
   cd service
   npm install
   ```
2. Tạo file `service/.env` và dán nguyên bộ biến môi trường (`MONGODB_URI`, `JWT_SECRET`, `GEMINI_API_KEY`...) do nhóm đính kèm khi nộp đồ án (hoặc copy từ file `.env` nhóm gửi kèm).
3. Lưu ý: Nếu mạng trường/Wi-Fi nội bộ chặn cổng `27017` của MongoDB Atlas hoặc IP chưa được cấp phép trên Atlas, vui lòng chuyển sang **Cách 1 (Chạy Offline)**.

---

## 3. Khởi chạy toàn bộ hệ thống (3 Terminal)

Cần khởi chạy **Backend trước**, sau đó mới mở **Storefront** và **Admin Portal**:

### Terminal 1 — Backend REST API (`service/`, Port `3000`)
```bash
cd service
npm start
```
*(Hoặc `npm run dev` nếu muốn bật chế độ tự reload bằng Nodemon)*

Chờ terminal hiện:
`[OK] MongoDB connected` và `[OK] Server running at http://localhost:3000`

### Terminal 2 — Storefront Khách hàng (`my-app/`, Port `4200`)
```bash
cd my-app
npm install
npm start
```
Truy cập tại: **http://localhost:4200**

### Terminal 3 — Admin Portal Quản trị (`admin/`, Port `4201`)
```bash
cd admin
npm install
npm start
```
Truy cập tại: **http://localhost:4201**

---

## 4. Kiểm tra nhanh dữ liệu đã lên đủ chưa

Sau khi chạy Backend (`localhost:3000`), có thể mở nhanh trình duyệt kiểm tra 2 đường dẫn sau:
- **Kiểm tra kết nối DB:** http://localhost:3000/api/health → trả về `"status": "ok"`, `"database": "connected"`
- **Kiểm tra dữ liệu sản phẩm:** http://localhost:3000/api/products → trả về JSON danh sách sản phẩm/combo

---

## 5. Tài khoản Demo để kiểm thử chức năng

### A. Khách hàng (Storefront — `http://localhost:4200`)
- Bấm **Đăng nhập / Đăng ký** → chọn tab **Đăng ký** bằng số điện thoại bất kỳ (ví dụ `0901234567`).
- Khi chạy ở môi trường local (`NODE_ENV !== 'production'`), hệ thống tự bật OTP demo — nhập mã OTP mặc định **`123456`** để hoàn tất đăng ký và nhận ngay voucher bạn mới.

### B. Quản trị & Nhân viên theo phân quyền (Admin — `http://localhost:4201`)

| Vai trò (Role) | Mã NV | Email đăng nhập | Mật khẩu | Phạm vi truy cập |
| :--- | :--- | :--- | :--- | :--- |
| **Admin** | `NV-ADM01` | `admin@xanhla.farm` | `admin123` | Toàn quyền hệ thống & toàn chuỗi |
| **Manager (Thủ Đức)** | `NV-QL01` | `manager.thuduc@evergreen.vn` | `manager123` | Quản lý Tổng kho Thủ Đức |
| **Manager (Quận 1)** | `NV-QL02` | `manager.q1@evergreen.vn` | `manager123` | Quản lý chi nhánh Quận 1 |
| **Manager (Bình Thạnh)** | `NV-QL03` | `manager.binhthanh@evergreen.vn` | `manager123` | Quản lý chi nhánh Bình Thạnh |
| **Manager (Quận 7)** | `NV-QL04` | `manager.q7@evergreen.vn` | `manager123` | Quản lý chi nhánh Quận 7 |
| **Manager (Tân Bình)** | `NV-QL05` | `manager.tanbinh@evergreen.vn` | `manager123` | Quản lý chi nhánh Tân Bình |
| **Manager (Gò Vấp)** | `NV-QL06` | `manager.govap@evergreen.vn` | `manager123` | Quản lý chi nhánh Gò Vấp |
| **Manager (Bình Tân)** | `NV-QL07` | `manager.binhtan@evergreen.vn` | `manager123` | Quản lý chi nhánh Bình Tân |
| **Manager (Dĩ An)** | `NV-QL08` | `manager.dian@evergreen.vn` | `12345678` | Quản lý Kho Dĩ An |
| **Sales** | `NV-BH01` | `sales@evergreen.vn` | `staff123` | Xử lý đơn hàng, CSKH, khiếu nại, tra cứu |
| **Warehouse** | `NV-KHO01` | `warehouse@evergreen.vn` | `staff123` | Tồn kho FEFO/FIFO, vận chuyển, in phiếu |
| **Marketing** | `NV-MKT01` | `marketing@evergreen.vn` | `staff123` | Phân tích hành vi, Voucher, Flash Sale, Banner |

---

## 6. Xử lý nhanh các lỗi thường gặp

| Tình huống | Nguyên nhân | Cách khắc phục |
| :--- | :--- | :--- |
| API trả về `503 Cơ sở dữ liệu đang mất kết nối` | MongoDB Local chưa bật (Cách 1) hoặc `service/.env` chưa cấu hình đúng Atlas (Cách 2) | Bật MongoDB Service cổng `27017` (hoặc kiểm tra lại `MONGODB_URI` & mạng nếu dùng Atlas) |
| Chạy `import-data` báo `[ABORT] MONGODB_URI dang tro den MongoDB tu xa` | `.env` đang trỏ Atlas nên script chặn ghi đè | Chạy `npm run import-data -- --local` để ép nạp vào MongoDB local |
| Lỗi `Error: listen EADDRINUSE :::3000` | Cổng `3000` đang có tiến trình Node khác chạy sẵn | Tắt tiến trình Node cũ đang chiếm cổng `3000` rồi chạy lại `npm start` |
| Web lên nhưng không thấy sản phẩm / danh mục trống | Chưa nạp dữ liệu hoặc DB bị trống | Chạy `cd service && npm run import-data -- --local` |

