// Evergreen Mart API Service
const path = require('path');
const fs = require('fs');
const serviceEnvPath = path.join(__dirname, '.env');
const legacyEnvPath = path.join(__dirname, '..', 'server', '.env');
const envPath = fs.existsSync(serviceEnvPath) ? serviceEnvPath : legacyEnvPath;
require('dotenv').config({ path: envPath });
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const compression = require('compression');

const productRoutes = require('./routes/products');
const comboRoutes = require('./routes/combos');
const orderRoutes = require('./routes/orders');
const userRoutes = require('./routes/users');
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const categoryRoutes = require('./routes/categories');
const accountRoutes = require('./routes/account');
const voucherRoutes = require('./routes/vouchers');
const loyaltyRoutes = require('./routes/loyalty');
const reviewRoutes = require('./routes/reviews');
const chatbotRoutes = require('./routes/chatbot');
const inventoryRoutes = require('./routes/inventory');
const supportRoutes = require('./routes/support');
const complaintRoutes = require('./routes/complaints');
const nutritionRoutes = require('./routes/nutrition');
const recipeRoutes = require('./routes/recipes');
const footerRoutes = require('./routes/footer');
const flashSaleRoutes = require('./routes/flashSales');
const shippingRoutes = require('./routes/shipping');
const storeRoutes = require('./routes/stores');
const locationRoutes = require('./routes/locations');
const analyticsRoutes = require('./routes/analytics');
const cartRoutes = require('./routes/cart');
const notificationRoutes = require('./routes/notifications');
const auditLogRoutes = require('./routes/auditLogs');
const bannerRoutes = require('./routes/banners');
const { errorHandler, notFound } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;
const allowedOrigins = new Set([
  'http://localhost:4200',
  'http://127.0.0.1:4200',
  'http://[::1]:4200',
  'http://localhost:4201',
  'http://127.0.0.1:4201',
  'http://[::1]:4201',
    'https://evergreen-client.pages.dev',
  'https://evergreen-admin.pages.dev',

]);

// ── Middleware ────────────────────────────────────────────
app.use(compression());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.has(origin) || /^http:\/\/(localhost|127\.0\.0\.1|\[::1\]):(4200|4201|3000)$/.test(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
  })
);
app.use(morgan('dev'));
app.use(cookieParser(process.env.SESSION_SECRET || 'evergreen_secret_key'));
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'evergreen_session_secret',
    resave: false,
    saveUninitialized: false,
    name: 'evergreen_sid',
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 24 giờ kiểm soát vòng đời phiên Session Timeout
      httpOnly: true,
      secure: false, // Để chạy được qua http://localhost chéo cổng
      sameSite: 'lax',
    },
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static images from frontend public/images directly as fallback/live disk source
const frontendImagesDir = path.join(__dirname, '..', 'my-app', 'public', 'images');
if (fs.existsSync(frontendImagesDir)) {
  app.use('/images', express.static(frontendImagesDir));
}

// Fail API requests clearly while MongoDB is disconnected instead of leaving
// Mongoose queries buffered until they time out.
app.use('/api', (req, res, next) => {
  if (req.path === '/health') return next();
  if (mongoose.connection.readyState === 1) return next();
  return res.status(503).json({
    success: false,
    message: 'Cơ sở dữ liệu đang mất kết nối. Vui lòng thử lại sau.',
  });
});

// ── Routes ────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/combos', comboRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/users', userRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/account', accountRoutes);
app.use('/api/vouchers', voucherRoutes);
app.use('/api/loyalty', loyaltyRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/nutrition', nutritionRoutes);
app.use('/api/recipes', recipeRoutes);
app.use('/api/footer', footerRoutes);
app.use('/api/flash-sales', flashSaleRoutes);
app.use('/api/shipping', shippingRoutes);
app.use('/api/stores', storeRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/banners', bannerRoutes);

// ── Health check ──────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  const connected = mongoose.connection.readyState === 1;
  res.status(connected ? 200 : 503).json({
    status: connected ? 'ok' : 'degraded',
    database: connected ? 'connected' : 'disconnected',
    time: new Date().toISOString(),
  });
});

// ── 404 Handler cho endpoint không tồn tại ────────────────
app.use(notFound);

// ── Error handler ─────────────────────────────────────────
app.use(errorHandler);

// ── Database + Start ──────────────────────────────────────
async function startServer() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/xanh-la';
    mongoose.connection.on('disconnected', () => {
      console.error('[WARN] MongoDB connection lost; waiting for Mongoose to reconnect');
    });
    mongoose.connection.on('reconnected', () => {
      console.log('[OK] MongoDB connection restored');
    });

    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 12000,
    });
    console.log('[OK] MongoDB connected');

    // Khởi động tiến trình tự động xả hàng cuối ngày (18:00) và reset giá gốc (05:00)
    const { initClearanceScheduler } = require('./utils/clearanceScheduler');
    initClearanceScheduler();

    // Khởi động tiến trình tự động hủy đơn VietQR quá hạn 15 phút và hoàn kho tức thì
    const { startOrderExpiryScheduler } = require('./utils/orderExpiryScheduler');
    startOrderExpiryScheduler(30000);

    // Dọn dẹp các bản ghi SearchLog rác do bắt sự kiện gõ phím ở frontend trước đó
    const SearchLog = require('./models/SearchLog');
    SearchLog.deleteMany({
      $or: [
        { normalizedKeyword: { $regex: /^.{1,2}$/ } },
        { keyword: { $in: ['c', 'r', 'ca', 'ra', 'cà', 'cà c', 'cà ch', 'ca·', 'cà chu'] } },
      ],
    }).catch(() => {});
  } catch (err) {
    console.error('[ERROR] MongoDB connection error:', err.message);
    console.error(`   Environment file loaded from: ${envPath}`);
    console.error('   Check MONGODB_URI, Atlas network access, and database credentials.');
    process.exit(1);
  }
  app.listen(PORT, () =>
    console.log(`[OK] Server running at http://localhost:${PORT}`)
  );
}

startServer();
