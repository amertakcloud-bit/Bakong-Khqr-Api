'use strict';

const crypto = require('crypto');
const Order = require('../models/Order');
const config = require('../config/env');
const { AppError } = require('../utils/errors');
const { parseAmount, parseCurrency } = require('../utils/validate');
const bakong = require('./bakong');
const khqr = require('./khqr');
const fulfillment = require('./fulfillment');
const { verifyTransaction } = require('./verifyTransaction');

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function newOrderId() {
  const bytes = crypto.randomBytes(10);
  let s = '';
  for (const b of bytes) s += B32[b % 32]; // 256 % 32 === 0 -> uniform
  return `ORD-${s}`;
}

function hashIp(ip) {
  return crypto.createHash('sha256').update(`${config.payment.ipHashSalt}|${ip || ''}`).digest('hex').slice(0, 32);
}

const notFound = () => new AppError(404, 'ORDER_NOT_FOUND', 'រកមិនឃើញការបញ្ជាទិញនេះទេ');

function assertConfigured() {
  const m = require('../config/env').missingConfig();
  if (m.length) {
    throw new AppError(503, 'SERVICE_NOT_CONFIGURED', 'ប្រព័ន្ធទូទាត់មិនទាន់ត្រូវបានកំណត់រចនាសម្ព័ន្ធ', { missing: m });
  }
}

/** Public view of an order. Never exposes ipHash, raw Bakong data, or errors. */
function serialize(order, extra = {}) {
  return {
    orderId: order.orderId,
    amount: order.amount,
    currency: order.currency,
    status: order.status,
    expiresAt: order.expiresAt.toISOString(),
    createdAt: order.createdAt.toISOString(),
    paidAt: order.paidAt ? order.paidAt.toISOString() : null,
    serverTime: new Date().toISOString(),
    ...extra,
  };
}

async function createOrder({ amount, currency, ip }) {
  assertConfigured();
  const cur = parseCurrency(currency, config.payment.allowedCurrencies, config.payment.defaultCurrency);
  const amt = parseAmount(amount, cur, config.payment.limits);

  const ipHash = hashIp(ip);
  const pending = await Order.countDocuments({ ipHash, status: 'PENDING', expiresAt: { $gt: new Date() } });
  if (pending >= config.payment.maxPendingPerIp) {
    throw new AppError(429, 'TOO_MANY_PENDING', 'អ្នកមានការបញ្ជាទិញដែលកំពុងរង់ចាំច្រើនពេក សូមបង់ ឬរង់ចាំឱ្យផុតកំណត់សិន');
  }

  const orderId = newOrderId();
  const expiresAt = new Date(Date.now() + config.payment.expireMinutes * 60 * 1000);
  const { qr, md5 } = khqr.generate({ amount: amt, currency: cur, orderId, expiresAtMs: expiresAt.getTime() });

  const order = await Order.create({
    orderId,
    amount: amt,
    currency: cur,
    qr,
    md5,
    bakongAccountId: config.merchant.accountId,
    expiresAt,
    ipHash,
  });

  const qrImage = await khqr.toImage(qr);
  return serialize(order, { qr, qrImage });
}

async function getOrderDoc(orderId) {
  const order = await Order.findOne({ orderId });
  if (!order) throw notFound();
  return order;
}

/** Full order incl. QR image (used to resume after a page refresh). */
async function getOrderFull(orderId) {
  const order = await getOrderDoc(orderId);
  const qrImage = order.status === 'PENDING' ? await khqr.toImage(order.qr) : null;
  return serialize(order, { qr: order.status === 'PENDING' ? order.qr : null, qrImage });
}

async function getStatus(orderId) {
  return serialize(await getOrderDoc(orderId));
}

/** Verify the matched transaction, then move PENDING -> PAID/FAILED atomically. */
async function settle(order, tx) {
  const verdict = verifyTransaction(order, tx, {
    expectedAccountId: order.bakongAccountId,
    requireReceiverMatch: config.payment.requireReceiverMatch,
  });

  const txDoc = {
    hash: tx.hash ? String(tx.hash) : `md5:${order.md5}`,
    fromAccountId: tx.fromAccountId,
    toAccountId: tx.toAccountId,
    currency: tx.currency,
    amount: Number(tx.amount),
    description: tx.description,
    createdDateMs: Number(tx.createdDateMs) || undefined,
    acknowledgedDateMs: Number(tx.acknowledgedDateMs) || undefined,
    instructionRef: tx.instructionRef,
    externalRef: tx.externalRef,
  };

  const fail = async (reason) => {
    console.warn(`[payment] order ${order.orderId} FAILED: ${reason}`);
    const failed = await Order.findOneAndUpdate(
      { orderId: order.orderId, status: 'PENDING' },
      { $set: { status: 'FAILED', failureReason: reason, failedTransaction: txDoc } },
      { new: true }
    );
    return failed || (await Order.findOne({ orderId: order.orderId }));
  };

  if (!verdict.ok) return fail(verdict.reasons.join(','));

  let paid;
  try {
    paid = await Order.findOneAndUpdate(
      { orderId: order.orderId, status: 'PENDING' },
      { $set: { status: 'PAID', paidAt: new Date(), transaction: txDoc, lastError: null } },
      { new: true }
    );
  } catch (err) {
    if (err && err.code === 11000) return fail('duplicate_transaction');
    throw err;
  }

  if (!paid) return (await Order.findOne({ orderId: order.orderId })) || order; // someone else won
  console.log(`[payment] order ${paid.orderId} PAID`);
  await fulfillment.run(paid);
  return (await Order.findOne({ orderId: paid.orderId })) || paid;
}

/**
 * Check one order against Bakong. Safe to call from many places at once:
 * only one caller per `checkMinIntervalMs` actually talks to Bakong.
 */
async function checkOrder(orderId) {
  assertConfigured();
  const order = await getOrderDoc(orderId);
  if (order.status !== 'PENDING') return order;

  const now = Date.now();
  const claimed = await Order.findOneAndUpdate(
    {
      orderId,
      status: 'PENDING',
      $or: [{ lastCheckedAt: null }, { lastCheckedAt: { $lte: new Date(now - config.payment.checkMinIntervalMs) } }],
    },
    { $set: { lastCheckedAt: new Date(now) }, $inc: { checkCount: 1 } },
    { new: true }
  );
  if (!claimed) return (await Order.findOne({ orderId })) || order; // throttled / already settled

  let result;
  try {
    result = await bakong.checkTransactionByMd5(claimed.md5);
  } catch (err) {
    await Order.updateOne(
      { orderId, status: 'PENDING' },
      { $set: { lastError: { code: err.code || 'UNKNOWN', message: String(err.message).slice(0, 200), at: new Date() } } }
    );
    console.error(`[bakong] check failed for ${orderId}: ${err.code || ''} ${err.message}`, err.extra || '');
    if (now >= claimed.expiresAt.getTime() + config.payment.expireWithErrorsGraceMs) {
      await Order.updateOne(
        { orderId, status: 'PENDING' },
        { $set: { status: 'EXPIRED', failureReason: 'expired_with_check_errors' } }
      );
    }
    throw err;
  }

  if (result.found) return settle(claimed, result.transaction);

  await Order.updateOne({ orderId, status: 'PENDING' }, { $set: { lastError: null } });
  if (Date.now() >= claimed.expiresAt.getTime()) {
    // Expired AND a fresh "not found" answer from Bakong -> safe to expire.
    const expired = await Order.findOneAndUpdate(
      { orderId, status: 'PENDING' },
      { $set: { status: 'EXPIRED' } },
      { new: true }
    );
    if (expired) return expired;
  }
  return (await Order.findOne({ orderId })) || claimed;
}

module.exports = { createOrder, getStatus, getOrderFull, checkOrder, serialize, newOrderId };
