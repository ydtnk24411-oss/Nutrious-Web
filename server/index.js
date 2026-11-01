require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');

const productRoutes    = require('./routes/products');
const orderRoutes      = require('./routes/orders');
const userRoutes       = require('./routes/users');
const eventRoutes      = require('./routes/events');
const serviceRoutes    = require('./routes/services');
const bookingRoutes    = require('./routes/bookings');
const authRoutes       = require('./routes/auth');
const dashboardRoutes  = require('./routes/dashboard');
const categoryRoutes   = require('./routes/categories');
const accountRoutes    = require('./routes/account');
const voucherRoutes    = require('./routes/vouchers');
const loyaltyRoutes    = require('./routes/loyalty');
const { errorHandler } = require('./middleware/errorHandler');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────
app.use(cors({ origin: 'http://localhost:4200', credentials: true }));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Routes ────────────────────────────────────────────────
app.use('/api/auth',       authRoutes);
app.use('/api/products',   productRoutes);
app.use('/api/orders',     orderRoutes);
app.use('/api/users',      userRoutes);
app.use('/api/events',     eventRoutes);
app.use('/api/services',   serviceRoutes);
app.use('/api/bookings',   bookingRoutes);
app.use('/api/dashboard',  dashboardRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/account',    accountRoutes);
app.use('/api/vouchers',   voucherRoutes);
app.use('/api/loyalty',    loyaltyRoutes);

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
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });
