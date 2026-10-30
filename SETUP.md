
# 🌿 XANH LÁ – PROJECT SETUP GUIDE

Tài liệu hướng dẫn thành viên thiết lập môi trường, kết nối MongoDB Atlas và chạy dự án **Nutrious-Web** trên máy cá nhân.

---

## 1. Tham gia MongoDB Atlas

1. Mở email nhận lời mời tham gia MongoDB Atlas Project `WEB2`.
2. Nhấn **Accept Invitation** để chấp nhận lời mời.
3. Đăng nhập MongoDB Atlas bằng tài khoản được mời.
4. Truy cập Project `WEB2` tại: https://cloud.mongodb.com/

Bạn đã được cấp quyền **Project Owner**, có thể truy cập và quản lý Project.

## 2. Cài đặt môi trường

Cài đặt các công cụ cần thiết:

- [Node.js](https://nodejs.org/) và npm.
- [Angular CLI](https://angular.dev/tools/cli).
- [Visual Studio Code](https://code.visualstudio.com/) (khuyến nghị).

Kiểm tra Node.js và npm sau khi cài đặt:

```bash
node -v
npm -v
```

Cài đặt Angular CLI:

```bash
npm install -g @angular/cli
```

Kiểm tra Angular CLI:

```bash
ng version
```

## 3. Clone source code từ GitHub

Mở terminal tại thư mục muốn lưu dự án và chạy:

```bash
git clone https://github.com/ydtnk24411-oss/Nutrious-Web.git
```

Di chuyển vào thư mục dự án:

```bash
cd Nutrious-Web
```

Chuyển sang nhánh `main` và cập nhật source code mới nhất:

```bash
git checkout main
git pull origin main
```

## 4. Cấu hình Backend

### 4.1. Cài đặt dependencies

Di chuyển vào thư mục `server`:

```bash
cd server
```

Cài đặt các thư viện cần thiết:

```bash
npm install
```

### 4.2. Tạo file môi trường `.env`

Tạo file `.env` trong thư mục `server`, cùng cấp với file `package.json`.

Cấu trúc file:

```env
PORT=3000
MONGODB_URI=mongodb+srv://k24411web2:NhomAcong@cluster0.ltnac9s.mongodb.net/
JWT_SECRET=xanh-la-secret-key-2025
JWT_EXPIRE=7d

```

Thay các giá trị mẫu bằng thông tin kết nối được sử dụng chung trong nhóm:

| Biến | Ý nghĩa |
|---|---|
| `PORT` | Cổng chạy Backend |
| `MONGODB_URI` | Connection string kết nối MongoDB Atlas |
| `JWT_SECRET` | Khóa bí mật dùng để xác thực JWT |
| `JWT_EXPIRE` | Thời hạn của JWT token |

**Thông tin MongoDB Atlas:**

- Project: `WEB2`
- Database: `xanh-la`
- Database User: sử dụng tài khoản được nhóm cung cấp.
- Tất cả thành viên sử dụng chung database Atlas.

Không cần chạy seed vì MongoDB Atlas đã có dữ liệu của dự án.

### 4.3. Khởi động Backend

Chạy lệnh:

```bash
npm start
```

Backend hoạt động tại:

```text
http://localhost:3000
```

Giữ terminal này hoạt động trong suốt quá trình sử dụng website.

## 5. Cấu hình Frontend Angular

Mở **terminal thứ hai** tại thư mục gốc `Nutrious-Web` (thư mục chứa file `angular.json`).

Cài đặt dependencies:

```bash
npm install
```

Khởi động Angular:

```bash
ng serve -o
```

Trình duyệt sẽ tự động mở website tại:

```text
http://localhost:4200
```

## 6. Hoàn tất thiết lập

Sau khi hoàn thành các bước trên, dự án sẽ hoạt động với các thành phần:

| Thành phần | Địa chỉ |
|---|---|
| Frontend Angular | http://localhost:4200 |
| Backend API | http://localhost:3000 |
| MongoDB | MongoDB Atlas – `xanh-la` |

**Lưu ý:** Mỗi thành viên chạy Frontend và Backend trên máy cá nhân, nhưng cùng kết nối đến một MongoDB Atlas database. Vì vậy, dữ liệu được sử dụng chung giữa các thành viên trong nhóm.

---

**XANH LÁ – NUTRIOUS WEB PROJECT**
