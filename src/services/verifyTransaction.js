'use strict';

const { toMinor } = require('../utils/validate');

// Allow for clock differences between this server and Bakong.
const CLOCK_SKEW_MS = 2 * 60 * 1000;

/**
 * Decide whether a transaction returned by Bakong really pays this order.
 * Pure function: no I/O, easy to test.
 *
 * @returns {{ok: boolean, reasons: string[]}}
 */
function verifyTransaction(order, tx, opts = {}) {
  if (!tx || typeof tx !== 'object') {
    return { ok: false, reasons: ['no_transaction_data'] };
  }
  const reasons = [];

  const currency = String(tx.currency || '').toUpperCase();
  if (currency !== order.currency) reasons.push('currency_mismatch');

  const amount = Number(tx.amount);
  if (!Number.isFinite(amount) || toMinor(amount, order.currency) !== toMinor(order.amount, order.currency)) {
    reasons.push('amount_mismatch');
  }

  const expected = String(opts.expectedAccountId || '').trim().toLowerCase();
  const receiver = tx.toAccountId ? String(tx.toAccountId).trim().toLowerCase() : '';
  if (receiver) {
    if (receiver !== expected) reasons.push('receiver_mismatch');
  } else if (opts.requireReceiverMatch) {
    reasons.push('receiver_missing');
  }

  const ts = Number(tx.acknowledgedDateMs || tx.createdDateMs);
  if (Number.isFinite(ts) && ts > 0) {
    const orderTime = new Date(order.createdAt).getTime();
    if (Number.isFinite(orderTime) && ts < orderTime - CLOCK_SKEW_MS) {
      reasons.push('transaction_before_order');
    }
  }

  return { ok: reasons.length === 0, reasons };
}

module.exports = { verifyTransaction };
