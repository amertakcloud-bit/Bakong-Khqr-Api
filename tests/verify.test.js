'use strict';
// Pure-logic tests of the payment verification rules (MOCK transaction data).
const test = require('node:test');
const assert = require('node:assert/strict');
const { verifyTransaction } = require('../src/services/verifyTransaction');

const now = Date.now();
const order = { amount: 10000, currency: 'KHR', createdAt: new Date(now - 60000) };
const good = {
  hash: 'abc',
  currency: 'KHR',
  amount: 10000,
  toAccountId: 'Shop@ABAA',
  acknowledgedDateMs: now,
};
const opts = { expectedAccountId: 'shop@abaa', requireReceiverMatch: true };

test('accepts a matching transaction (case-insensitive receiver)', () => {
  assert.deepEqual(verifyTransaction(order, good, opts), { ok: true, reasons: [] });
});

test('rejects wrong amount, currency, receiver', () => {
  assert.deepEqual(verifyTransaction(order, { ...good, amount: 9999 }, opts).reasons, ['amount_mismatch']);
  assert.deepEqual(verifyTransaction(order, { ...good, currency: 'USD' }, opts).reasons, ['currency_mismatch', 'amount_mismatch'].filter((r) => r === 'currency_mismatch'));
  assert.deepEqual(verifyTransaction(order, { ...good, toAccountId: 'other@bank' }, opts).reasons, ['receiver_mismatch']);
});

test('missing receiver is rejected when strict, allowed when not', () => {
  const tx = { ...good, toAccountId: undefined };
  assert.deepEqual(verifyTransaction(order, tx, opts).reasons, ['receiver_missing']);
  assert.equal(verifyTransaction(order, tx, { ...opts, requireReceiverMatch: false }).ok, true);
});

test('rejects a transaction that happened long before the order', () => {
  const old = { ...good, acknowledgedDateMs: now - 3600000 };
  assert.deepEqual(verifyTransaction(order, old, opts).reasons, ['transaction_before_order']);
});

test('USD compares in cents', () => {
  const usd = { amount: 1.1, currency: 'USD', createdAt: new Date(now - 1000) };
  const tx = { currency: 'USD', amount: 1.1, toAccountId: 'shop@abaa', acknowledgedDateMs: now };
  assert.equal(verifyTransaction(usd, tx, opts).ok, true);
});

test('no data -> not ok', () => {
  assert.equal(verifyTransaction(order, null, opts).ok, false);
});
