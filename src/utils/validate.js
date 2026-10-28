'use strict';

const { AppError } = require('./errors');

const ORDER_ID_RE = /^ORD-[A-Z2-7]{10}$/;
const MD5_RE = /^[a-f0-9]{32}$/i;

function parseCurrency(input, allowed, fallback) {
  if (input === undefined || input === null || input === '') return fallback;
  const cur = String(input).trim().toUpperCase();
  if (!allowed.includes(cur)) {
    throw new AppError(400, 'INVALID_CURRENCY', 'រូបិយប័ណ្ណមិនត្រឹមត្រូវ (គាំទ្រ USD និង KHR)');
  }
  return cur;
}

/**
 * Validate an amount coming from the client. Returns a normalised number.
 * KHR must be a whole number, USD at most 2 decimals.
 */
function parseAmount(input, currency, limits) {
  const bad = () => new AppError(400, 'INVALID_AMOUNT', 'ចំនួនទឹកប្រាក់មិនត្រឹមត្រូវ');
  if (typeof input === 'string') {
    input = input.trim();
    if (!/^\d+(\.\d+)?$/.test(input)) throw bad();
  } else if (typeof input !== 'number') {
    throw bad();
  }
  const n = Number(input);
  if (!Number.isFinite(n) || n <= 0) throw bad();

  if (currency === 'KHR') {
    if (!Number.isInteger(n)) {
      throw new AppError(400, 'INVALID_AMOUNT', 'លុយរៀលត្រូវតែជាចំនួនគត់');
    }
  } else if (Math.abs(n * 100 - Math.round(n * 100)) > 1e-6) {
    throw new AppError(400, 'INVALID_AMOUNT', 'ដុល្លារអាចមានទសភាគច្រើនបំផុត ២ ខ្ទង់');
  }

  const lim = limits && limits[currency];
  if (lim) {
    if (n < lim.min) {
      throw new AppError(400, 'AMOUNT_TOO_LOW', `ចំនួនទឹកប្រាក់ទាបបំផុតគឺ ${lim.min} ${currency}`);
    }
    if (n > lim.max) {
      throw new AppError(400, 'AMOUNT_TOO_HIGH', `ចំនួនទឹកប្រាក់ខ្ពស់បំផុតគឺ ${lim.max} ${currency}`);
    }
  }
  return currency === 'USD' ? Math.round(n * 100) / 100 : n;
}

/** Integer minor units (cents for USD, riel for KHR) for exact comparison. */
function toMinor(amount, currency) {
  const n = Number(amount);
  return currency === 'USD' ? Math.round(n * 100) : Math.round(n);
}

module.exports = { ORDER_ID_RE, MD5_RE, parseCurrency, parseAmount, toMinor };
