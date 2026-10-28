'use strict';

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const config = require('./config/env');
const { connectDB } = require('./config/database');
const { AppError } = require('./utils/errors');
const healthRoutes = require('./routes/health');
const paymentRoutes = require('./routes/payment');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

// Render and Vercel sit behind a proxy: needed for the real client IP (rate limits).
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'"],
        'style-src': ["'self'"],
        'img-src': ["'self'", 'data:'],
        'connect-src': ["'self'"],
        'object-src': ["'none'"],
        // Safari upgrades http://localhost to https if this is on; only enable in production.
        'upgrade-insecure-requests': config.isProd ? [] : null,
      },
    },
  })
);

// Frontend is served from the same origin, so CORS is only needed when the
// page is hosted elsewhere. CLIENT_URL may hold several origins, comma separated.
app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true); // same-origin / curl
      if (config.clientUrls.includes(origin.replace(/\/+$/, ''))) return cb(null, true);
      return cb(null, false); // no CORS headers -> browser blocks it
    },
    methods: ['GET', 'POST'],
    maxAge: 600,
  })
);

app.use('/api/health', healthRoutes);

// Every other API route needs the database (cached connection for serverless).
app.use('/api', async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    next(err instanceof AppError ? err : new AppError(503, 'DB_UNAVAILABLE', 'មិនអាចភ្ជាប់មូលដ្ឋានទិន្នន័យបាន'));
  }
});
app.use('/api/payment', paymentRoutes);
app.use('/api', notFound);

app.use(express.static(path.join(__dirname, '..', 'public'), { maxAge: config.isProd ? '5m' : 0 }));
app.use(notFound);
app.use(errorHandler);

module.exports = app;
