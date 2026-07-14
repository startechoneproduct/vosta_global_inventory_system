require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const connectDB = require('./src/config/database');
const authRoutes = require('./src/routes/authRoute.js');
const salesRoute = require('./src/routes/salesRoute.js');
const stockRoute = require('./src/routes/stockRoute.js');
const expensesRoute = require('./src/routes/expensesRoute.js');
const attendanceRoute = require('./src/routes/attendanceRoute.js');
const productRoute = require('./src/routes/productRoute.js');
const storeRoute = require('./src/routes/storeRoute.js');
const activityLogRoute = require('./src/routes/activityLog.js');
const customerRoute = require('./src/routes/customersRoute.js');
const dashboardRoute = require('./src/routes/dashboardRoute.js');
const driverLocationRoute = require('./src/routes/driverLocationRoute.js');
const returnRoute = require('./src/routes/returnRoute.js');
const staffRoute = require('./src/routes/staffRoute.js');
const equipmentRoute = require('./src/routes/equipmentRoute.js');
const damageRoute = require('./src/routes/damageRoutes.js');
const axios = require('axios');

const app = express();
const NODE_ENV = process.env.NODE_ENV || 'development';

// ============ MIDDLEWARE ============

app.use(morgan('dev'));

app.use(
  cors({
    origin:
      process.env.CORS_ORIGIN ||
      'http://vostainventory.com.ng' ||
      'https://vosta-global-inventory-system.vercel.app' ||
      'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cookieParser());

// ============ DATABASE ============

connectDB();

// ============ ROUTES ============

app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
  });
});


app.get('/keep-alive', (_, res) => res.status(204).end());

const keepAlive =
  process.env.KEEP_ALIVE === 'true' || process.env.NODE_ENV === 'production';

const PING_URL =
  process.env.KEEP_ALIVE_URL || 'https://vosta-global-inventory-system.onrender.com/keep-alive';

const PING_INTERVAL_MS = 14 * 60 * 1000; // 14 minutes

if (keepAlive) {
  setInterval(async () => {
    try {
      await axios.get(PING_URL);
    } catch (error) {
      console.error('Error pinging keep-alive URL:', error.message);
    }
  }, PING_INTERVAL_MS);
}


app.use('/api/auth', authRoutes);
app.use('/api/sales', salesRoute);
app.use('/api/stock', stockRoute);
app.use('/api/expenses', expensesRoute);
app.use('/api/attendance', attendanceRoute);
app.use('/api/products', productRoute);
app.use('/api/stores', storeRoute);
app.use('/api/activity-log', activityLogRoute);
app.use('/api/customers', customerRoute);
app.use('/api/dashboard', dashboardRoute);
app.use('/api/driver-location', driverLocationRoute);
app.use('/api/returns', returnRoute);
app.use('/api/staff', staffRoute);
app.use('/api/equipment', equipmentRoute);
app.use('/api/damages', damageRoute);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    path: req.originalUrl,
  });
});

// ============ ERROR HANDLER ============

app.use((err, req, res, _next) => {
  console.error('Error:', err);

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: Object.values(err.errors).map((e) => e.message),
    });
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return res.status(400).json({
      success: false,
      message: `${field} already exists`,
    });
  }

  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token',
    });
  }

  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// ============ START SERVER ============

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`Stacey POS server running in ${NODE_ENV} on port ${PORT}`);
  console.log(`Health: GET http://localhost:${PORT}/api/health`);
  console.log(`Auth: POST http://localhost:${PORT}/api/auth/login`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

module.exports = app;
