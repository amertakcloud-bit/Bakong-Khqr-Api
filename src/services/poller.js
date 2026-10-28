'use strict';

/**
 * Optional background checker. ONLY for long-running servers (Render).
 * Vercel serverless functions are frozen between requests, so this does not
 * run there; on Vercel the browser's polling drives the checks.
 *
 * It uses the same throttled checkOrder(), so it can never make more than
 * one Bakong call per order per CHECK_MIN_INTERVAL_SECONDS.
 */

const Order = require('../models/Order');
const config = require('../config/env');
const payment = require('./payment');

const STOP_ON = new Set(['BAKONG_AUTH', 'BAKONG_FORBIDDEN', 'BAKONG_RATE_LIMIT', 'BAKONG_TOKEN_MISSING']);
const TAIL_MS = 5 * 60 * 1000; // keep checking this long after expiry
let timer = null;
let running = false;

async function tick() {
  if (running) return;
  running = true;
  try {
    const cutoff = new Date(Date.now() - TAIL_MS);

    // Orders nobody could check in time: close them so they don't stay PENDING forever.
    await Order.updateMany(
      { status: 'PENDING', expiresAt: { $lt: cutoff } },
      { $set: { status: 'EXPIRED', failureReason: 'expired_unchecked' } }
    );

    const orders = await Order.find({ status: 'PENDING', expiresAt: { $gt: cutoff } })
      .sort({ createdAt: 1 })
      .limit(25)
      .select('orderId')
      .lean();

    for (const o of orders) {
      try {
        await payment.checkOrder(o.orderId);
      } catch (err) {
        if (STOP_ON.has(err.code)) break; // config/limit problem: don't hammer the API
      }
    }
  } catch (err) {
    console.error('[poller] tick failed:', err && err.message);
  } finally {
    running = false;
  }
}

function start() {
  if (!config.poller.enabled || timer) return false;
  timer = setInterval(tick, config.poller.intervalMs);
  if (timer.unref) timer.unref();
  console.log(`[poller] started, every ${config.poller.intervalMs / 1000}s`);
  return true;
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = { start, stop, tick };
