'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const payment = require('../services/payment');
const { AppError } = require('../utils/errors');
const { ORDER_ID_RE } = require('../utils/validate');

const router = express.Router();

const limiter = (windowMs, limit) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (req, res, next) =>
      next(new AppError(429, 'RATE_LIMITED', 'អ្នកផ្ញើសំណើញឹកញាប់ពេក សូមរង់ចាំបន្តិច')),
  });

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

router.use(express.json({ limit: '5kb' }));

router.param('orderId', (req, res, next, value) => {
  if (!ORDER_ID_RE.test(value)) return next(new AppError(400, 'INVALID_ORDER_ID', 'លេខ Order មិនត្រឹមត្រូវ'));
  next();
});

// Create order + KHQR. Amount/currency are validated server-side.
router.post(
  '/create',
  limiter(60 * 1000, 10),
  wrap(async (req, res) => {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const data = await payment.createOrder({ amount: body.amount, currency: body.currency, ip: req.ip });
    res.status(201).json({ ok: true, data });
  })
);

// Read-only status (DB only, never calls Bakong).
router.get(
  '/status/:orderId',
  limiter(60 * 1000, 120),
  wrap(async (req, res) => {
    res.json({ ok: true, data: await payment.getStatus(req.params.orderId) });
  })
);

// Full order incl. QR image, to resume after a page refresh.
router.get(
  '/order/:orderId',
  limiter(60 * 1000, 30),
  wrap(async (req, res) => {
    res.json({ ok: true, data: await payment.getOrderFull(req.params.orderId) });
  })
);

// Ask the backend to check Bakong (throttled per order inside the service).
router.post(
  '/check/:orderId',
  limiter(60 * 1000, 40),
  wrap(async (req, res) => {
    const order = await payment.checkOrder(req.params.orderId);
    res.json({ ok: true, data: payment.serialize(order) });
  })
);

module.exports = router;
