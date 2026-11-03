require('dotenv').config();
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
const inventoryRoutes = require('./routes/inventory');
const supportRoutes = require('./routes/support');
const complaintRoutes = require('./routes/complaints');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      // Allow all localhost and 127.0.0.1 origins on any port
      if (
        origin.includes('localhost') ||
        origin.includes('127.0.0.1') ||
        origin.endsWith('.ngrok.io') ||
        origin.endsWith('.ngrok-free.app')
      ) {
        return callback(null, true);
      }
      return callback(null, true);
    },
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
app.use('/api/inventory', inventoryRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/complaints', complaintRoutes);

// ── Health check ──────────────────────────────────────────
app.get('/api/health', (_req, res) =>
  res.json({ status: 'ok', time: new Date().toISOString() })
);

// ── Error handler ─────────────────────────────────────────
app.use(errorHandler);

// ── Database + Start ──────────────────────────────────────
mongoose
  .connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/xanh-la')
  .then(() => {
    console.log('✅ MongoDB connected');
    app.listen(PORT, () =>
      console.log(`🚀 Server running at http://localhost:${PORT}`)
    );
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });
