const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');

const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');
const userRoutes = require('./routes/users');
const eventRoutes = require('./routes/events');
const serviceRoutes = require('./routes/services');
const bookingRoutes = require('./routes/bookings');
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const categoryRoutes = require('./routes/categories');
const accountRoutes = require('./routes/account');
const voucherRoutes = require('./routes/vouchers');
const loyaltyRoutes = require('./routes/loyalty');
const reviewRoutes = require('./routes/reviews');
const chatbotRoutes = require('./routes/chatbot');
const nutritionRoutes = require('./routes/nutrition');
const footerRoutes = require('./routes/footer');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────
app.use(
  cors({
    origin: ['http://localhost:4200', 'http://127.0.0.1:4200', 'http://localhost:4201', 'http://127.0.0.1:4201'],
    credentials: true
  })
);
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Routes ────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/users', userRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/account', accountRoutes);
app.use('/api/vouchers', voucherRoutes);
app.use('/api/loyalty', loyaltyRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/nutrition', nutritionRoutes);
app.use('/api/footer', footerRoutes);

// ── Health check ──────────────────────────────────────────
app.get('/api/health', (_req, res) =>
  res.json({ status: 'ok', time: new Date().toISOString() })
);

// ── Error handler ─────────────────────────────────────────
app.use(errorHandler);

// ── Database + Start ──────────────────────────────────────
async function startServer() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/xanh-la', {
      serverSelectionTimeoutMS: 12000,
    });
    console.log('✅ MongoDB connected');
  } catch (err) {
    console.warn('⚠️ Atlas connection failed, falling back to Local MongoDB (127.0.0.1:27017/xanh-la):', err.message);
    try {
      await mongoose.connect('mongodb://127.0.0.1:27017/xanh-la');
      console.log('✅ Connected to Local MongoDB (127.0.0.1:27017/xanh-la)');
    } catch (localErr) {
      console.error('❌ MongoDB connection error:', localErr.message);
      process.exit(1);
    }
  }
  app.listen(PORT, () =>
    console.log(`🚀 Server running at http://localhost:${PORT}`)
  );
}

startServer();
