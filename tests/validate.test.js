'use strict';
// Pure-logic tests (no network, no database).
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseAmount, parseCurrency, toMinor, ORDER_ID_RE } = require('../src/utils/validate');

const limits = { USD: { min: 0.01, max: 500 }, KHR: { min: 100, max: 2000000 } };

test('KHR must be a whole number within limits', () => {
  assert.equal(parseAmount('10000', 'KHR', limits), 10000);
  assert.equal(parseAmount(4100, 'KHR', limits), 4100);
  assert.throws(() => parseAmount('100.5', 'KHR', limits), { code: 'INVALID_AMOUNT' });
  assert.throws(() => parseAmount('50', 'KHR', limits), { code: 'AMOUNT_TOO_LOW' });
  assert.throws(() => parseAmount('3000000', 'KHR', limits), { code: 'AMOUNT_TOO_HIGH' });
});

test('USD allows at most 2 decimals', () => {
  assert.equal(parseAmount('1.5', 'USD', limits), 1.5);
  assert.equal(parseAmount(0.1 + 0.2 > 0 ? '0.30' : '0', 'USD', limits), 0.3);
  assert.throws(() => parseAmount('1.005', 'USD', limits), { code: 'INVALID_AMOUNT' });
  assert.throws(() => parseAmount('501', 'USD', limits), { code: 'AMOUNT_TOO_HIGH' });
});

test('garbage amounts are rejected', () => {
  for (const bad of ['', 'abc', '-5', '0', '1e3', ' ', null, undefined, true, {}, [], NaN, Infinity, '0x10']) {
    assert.throws(() => parseAmount(bad, 'KHR', limits), { code: 'INVALID_AMOUNT' }, String(bad));
  }
});

test('currency parsing', () => {
  const allowed = ['USD', 'KHR'];
  assert.equal(parseCurrency('usd', allowed, 'KHR'), 'USD');
  assert.equal(parseCurrency(undefined, allowed, 'KHR'), 'KHR');
  assert.throws(() => parseCurrency('EUR', allowed, 'KHR'), { code: 'INVALID_CURRENCY' });
});

test('minor units compare exactly', () => {
  assert.equal(toMinor(0.1 + 0.2, 'USD'), toMinor(0.3, 'USD'));
  assert.equal(toMinor(10000, 'KHR'), 10000);
});

test('order id format', () => {
  assert.ok(ORDER_ID_RE.test('ORD-ABCDE23456'));
  assert.ok(!ORDER_ID_RE.test('ORD-abcde23456'));
  assert.ok(!ORDER_ID_RE.test('ORD-ABCDE2345'));
  assert.ok(!ORDER_ID_RE.test('../etc/passwd'));
});
