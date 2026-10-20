# TEAM WORKFLOW - Hướng dẫn làm việc chung

Hướng dẫn cho team Xanh Lá Website về cách collaborate, git workflow, và quy trình phát triển.

## 📋 Mục lục

1. [Khởi đầu cho thành viên mới](#khởi-đầu-cho-thành-viên-mới)
2. [Git Workflow](#git-workflow)
3. [Quy tắc Branch](#quy-tắc-branch)
4. [Quy trình Commit](#quy trình-commit)
5. [Pull Request (PR)](#pull-request-pr)
6. [Xử lý Conflict](#xử-lý-conflict)
7. [Code Review](#code-review)
8. [Quy tắc Coding](#quy-tắc-coding)

---

## Khởi đầu cho thành viên mới

### 1. Fork Repository (tùy chọn)

Nếu bạn có quyền push trực tiếp vào main repo, skip bước này.

Nếu không:
1. Vào https://github.com/ydtnk24411-oss/Nutrious-Web
2. Click "Fork" để tạo repo riêng của bạn

### 2. Clone Repository

**Clone từ main repo (nếu có quyền):**
```bash
git clone https://github.com/ydtnk24411-oss/Nutrious-Web.git
cd Nutrious-Web
```

**Hoặc clone từ fork của bạn:**
```bash
git clone https://github.com/YOUR_USERNAME/Nutrious-Web.git
cd Nutrious-Web
git remote add upstream https://github.com/ydtnk24411-oss/Nutrious-Web.git
```

### 3. Setup Development Environment

Xem file [SETUP.md](SETUP.md) để cài đặt môi trường.

### 4. Cấu hình Git

```bash
git config user.name "Your Name"
git config user.email "your.email@example.com"
```

---

## Git Workflow

Chúng ta sử dụng **Feature Branch Workflow**:

```
main (production-ready)
  ↑
  ↑ merge PR
  ↑
feature/feature-name (development)
```

### Quy trình cơ bản:

1. Tạo branch mới từ `main`
2. Thực hiện changes trên branch đó
3. Commit changes
4. Push branch lên GitHub
5. Tạo Pull Request
6. Code review
7. Merge vào `main`
8. Xóa branch sau khi merge

---

## Quy tắc Branch

### Branch Names

Sử dụng prefix rõ ràng:

- `feature/` - Cho tính năng mới
  - Ví dụ: `feature/add-voucher-system`
  - Ví dụ: `feature/user-profile-page`

- `bugfix/` - Cho sửa lỗi
  - Ví dụ: `bugfix/login-error`
  - Ví dụ: `bugfix/cart-calculation`

- `hotfix/` - Cho sửa lỗi urgent trên production
  - Ví dụ: `hotfix/security-patch`

- `refactor/` - Cho refactor code
  - Ví dụ: `refactor/cleanup-api-service`

### Quy tắc:
- Mỗi task = 1 branch
- Branch name phải viết thường, dùng dấu `-` thay vì space
- Branch name phải mô tả rõ task

---

## Quy trình Commit

### Commit Message Format

Sử dụng conventional commits:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: Tính năng mới
- `fix`: Sửa lỗi
- `docs`: Thay đổi documentation
- `style`: Thay đổi format code (không ảnh hưởng logic)
- `refactor`: Refactor code
- `test`: Thêm/ sửa test
- `chore`: Thay đổi build process, tools, v.v.

**Ví dụ:**

```bash
git commit -m "feat(auth): add JWT refresh token implementation"
```

```bash
git commit -m "fix(cart): fix total calculation when applying discount"
```

```bash
git commit -m "docs(readme): update setup instructions for Windows"
```

### Quy tắc Commit:
1. Commit nhỏ, thường xuyên (đừng commit quá nhiều file cùng lúc)
2. Commit message phải rõ ràng, mô tả được thay đổi
3. Không commit code chưa chạy được
4. Không commit sensitive data (API keys, passwords)
5. Chạy test trước khi commit (nếu có)

### Ví dụ Workflow:

```bash
# 1. Pull latest changes từ main
git checkout main
git pull origin main

# 2. Tạo branch mới
git checkout -b feature/add-voucher-system

# 3. Làm thay đổi
# ... code ...

# 4. Thêm files vào staging
git add .

# 5. Commit
git commit -m "feat(voucher): add voucher listing page"

# 6. Push branch
git push origin feature/add-voucher-system

# 7. Tạo PR trên GitHub
```

---

## Pull Request (PR)

### Khi nào tạo PR:
- Khi task hoàn thành và đã test
- Khi cần review code
- Khi cần feedback từ team

### Title của PR:
Sử dụng format tương tự commit message:
```
feat: add voucher system
fix: resolve login timeout issue
```

### Description của PR:
```markdown
## Changes
- Add voucher listing page
- Implement voucher claim functionality
- Add voucher details modal

## Testing
- Tested voucher listing with sample data
- Tested claim flow for logged-in users
- Verified discount calculation

## Screenshots (nếu có UI changes)
[Attach screenshots]

## Checklist
- [ ] Code follows project style
- [ ] Self-reviewed code
- [ ] Tested locally
- [ ] No console errors
- [ ] Updated documentation (nếu cần)
```

### Quy tắc PR:
1. PR phải nhỏ (tối đa 300-500 lines changed)
2. Nếu PR lớn, chia thành nhiều PR nhỏ hơn
3. Chỉ merge sau khi được ít nhất 1 person approve
4. Resolve tất cả conflicts trước khi merge
5. Delete branch sau khi merge

---

## Xử lý Conflict

### Khi conflict xảy ra:

```bash
# 1. Pull latest changes từ main
git checkout main
git pull origin main

# 2. Merge main vào feature branch
git checkout feature/your-branch
git merge main

# 3. Resolve conflicts (mở file và sửa)
# Git sẽ đánh dấu conflicts với <<<<<, =====, >>>>>

# 4. Add resolved files
git add <resolved-files>

# 5. Complete merge
git commit -m "merge: resolve conflicts with main"

# 6. Push
git push origin feature/your-branch
```

### Tips:
- Luôn pull main trước khi bắt đầu làm việc
- Communicate với team nếu conflict phức tạp
- Đừng force push vào main branch

---

## Code Review

### Mục đích Code Review:
- Tìm bug
- Đảm bảo code quality
- Chia sẻ kiến thức
- Giữ consistency

### Khi Review:
- Kiểm tra logic correctness
- Kiểm tra security issues
- Kiểm tra performance issues
- Kiểm tra code style
- Đưa ra constructive feedback

### Khi được Review:
- Đừng take feedback cá nhân
- Discuss nếu không đồng ý
- Fix issues nhanh chóng
- Học từ feedback

---

## Quy tắc Coding

### Frontend (Angular):
- Sử dụng Angular conventions
- Component files: `.component.ts`, `.component.html`, `.component.css`
- Service files: `.service.ts`
- Type-safe: Luôn dùng TypeScript types
- Clean code: Function nhỏ, single responsibility

### Backend (Node.js):
- Sử dụng Express conventions
- Route files: `/routes/*.js`
- Model files: `/models/*.js`
- Middleware: `/middleware/*.js`
- Error handling: Sử dụng error handler middleware

### General:
- Đ viết comments trừ khi logic phức tạp
- Đ dùng magic numbers, dùng constants
- Đ hardcode URLs, dùng environment variables
- Log errors để debug dễ hơn

---

## Daily Workflow

### Mỗi ngày bắt đầu làm:

```bash
# 1. Pull latest changes
git checkout main
git pull origin main

# 2. Checkout feature branch của bạn
git checkout feature/your-branch

# 3. Merge latest main vào branch
git merge main

# 4. Bắt đầu coding
```

### Khi kết thúc ngày:

```bash
# 1. Commit changes
git add .
git commit -m "feat: your changes"

# 2. Push
git push origin feature/your-branch
```

---

## Troubleshooting

### Branch bị落后 (behind):

```bash
git checkout main
git pull origin main
git checkout feature/your-branch
git merge main
```

### Push bị rejected:

```bash
git pull origin feature/your-branch
# Resolve conflicts nếu có
git push origin feature/your-branch
```

### Xóa local branch:

```bash
git branch -d feature/your-branch
```

### Xóa remote branch:

```bash
git push origin --delete feature/your-branch
```

---

## Emergency Situations

### Cần revert commit:

```bash
# Revert 1 commit (tạo commit mới để undo)
git revert <commit-hash>

# Hoặc reset (cẩn thận - chỉ khi chưa push)
git reset --hard <commit-hash>
```

### Cần rollback production:

```bash
# Checkout commit trước đó
git checkout <commit-hash>
git checkout -b hotfix/emergency-fix
# ... làm fix ...
git push origin hotfix/emergency-fix
# Tạo PR và merge nhanh
```

---

## Communication

### Channels:
- **GitHub Issues**: Report bugs, discuss features
- **GitHub PRs**: Code review
- **Slack/Team Chat**: Quick questions, sync up

### Sync meetings:
- Daily standup (nếu có)
- Weekly planning
- Sprint review

---

## Resources

- [Git Documentation](https://git-scm.com/doc)
- [GitHub Flow](https://guides.github.com/introduction/flow/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Angular Style Guide](https://angular.io/guide/styleguide)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)

---

## Questions?

Nếu có questions về workflow, hãy:
1. Check file này trước
2. Ask trong team chat
3. Tạo GitHub Issue nếu cần discussion lâu dài

Happy coding! 🚀
