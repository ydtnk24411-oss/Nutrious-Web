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

const productRoutes = require('./routes/products');
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
const footerRoutes = require('./routes/footer');
const flashSaleRoutes = require('./routes/flashSales');
const shippingRoutes = require('./routes/shipping');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;
const allowedOrigins = new Set([
  'http://localhost:4200',
  'http://127.0.0.1:4200',
  'http://localhost:4201',
  'http://127.0.0.1:4201',
]);

// ── Middleware ────────────────────────────────────────────
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.has(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Origin is not allowed by CORS'));
    },
    credentials: true,
  })
);
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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
app.use('/api/footer', footerRoutes);
app.use('/api/flash-sales', flashSaleRoutes);
app.use('/api/shipping', shippingRoutes);

// ── Health check ──────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  const connected = mongoose.connection.readyState === 1;
  res.status(connected ? 200 : 503).json({
    status: connected ? 'ok' : 'degraded',
    database: connected ? 'connected' : 'disconnected',
    time: new Date().toISOString(),
  });
});

// ── Error handler ─────────────────────────────────────────
app.use(errorHandler);

// ── Database + Start ──────────────────────────────────────
async function startServer() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/xanh-la';
    mongoose.connection.on('disconnected', () => {
      console.error('⚠️ MongoDB connection lost; waiting for Mongoose to reconnect');
    });
    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB connection restored');
    });

    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 12000,
    });
    console.log('✅ MongoDB connected');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    console.error(`   Environment file loaded from: ${envPath}`);
    console.error('   Check MONGODB_URI, Atlas network access, and database credentials.');
    process.exit(1);
  }
  app.listen(PORT, () =>
    console.log(`🚀 Server running at http://localhost:${PORT}`)
  );
}

startServer();
