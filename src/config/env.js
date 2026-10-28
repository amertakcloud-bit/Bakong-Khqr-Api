'use strict';

// dotenv is only needed for local development. On Render/Vercel the
// variables come from the dashboard, so a missing dotenv is not fatal.
try {
  require('dotenv').config();
} catch (_) {
  /* ignore */
}

const toInt = (v, d) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : d;
};
const toNum = (v, d) => {
  const n = Number(v);
  return v !== undefined && v !== '' && Number.isFinite(n) ? n : d;
};
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const trim = (v) => (v === undefined || v === null ? '' : String(v).trim());

const env = process.env;
const allowedCurrencies = ['USD', 'KHR'];
const defaultCurrency = allowedCurrencies.includes(trim(env.DEFAULT_CURRENCY).toUpperCase())
  ? trim(env.DEFAULT_CURRENCY).toUpperCase()
  : 'KHR';

const config = {
  nodeEnv: trim(env.NODE_ENV) || 'development',
  isProd: trim(env.NODE_ENV) === 'production',
  port: toInt(env.PORT, 5000),
  mongodbUri: trim(env.MONGODB_URI),
  clientUrls: trim(env.CLIENT_URL)
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean),

  bakong: {
    baseUrl: (trim(env.BAKONG_API_BASE_URL) || 'https://api-bakong.nbc.gov.kh').replace(/\/+$/, ''),
    token: trim(env.BAKONG_API_TOKEN),
    timeoutMs: clamp(toInt(env.BAKONG_TIMEOUT_MS, 8000), 1000, 25000),
  },

  merchant: {
    accountId: trim(env.BAKONG_ACCOUNT_ID), // receiving Bakong account, e.g. name@bank
    name: trim(env.MERCHANT_NAME), // max 25 chars (KHQR spec)
    city: trim(env.MERCHANT_CITY) || 'Phnom Penh', // max 15 chars (KHQR spec)
  },

  payment: {
    allowedCurrencies,
    defaultCurrency,
    expireMinutes: clamp(toInt(env.ORDER_EXPIRE_MINUTES, 10), 1, 30),
    limits: {
      USD: { min: toNum(env.MIN_AMOUNT_USD, 0.01), max: toNum(env.MAX_AMOUNT_USD, 500) },
      KHR: { min: toNum(env.MIN_AMOUNT_KHR, 100), max: toNum(env.MAX_AMOUNT_KHR, 2000000) },
    },
    // Minimum gap between two Bakong checks for the SAME order (all clients combined).
    checkMinIntervalMs: clamp(toInt(env.CHECK_MIN_INTERVAL_SECONDS, 4), 1, 60) * 1000,
    maxPendingPerIp: clamp(toInt(env.MAX_PENDING_PER_IP, 5), 1, 100),
    // If Bakong checks keep failing, give up this long after expiry.
    expireWithErrorsGraceMs: 15 * 60 * 1000,
    requireReceiverMatch: trim(env.REQUIRE_RECEIVER_MATCH).toLowerCase() !== 'false',
    ipHashSalt: trim(env.IP_HASH_SALT),
  },

  poller: {
    // Only works on a long-running server (Render). Never on Vercel.
    enabled: trim(env.BACKGROUND_POLLING).toLowerCase() === 'true',
    intervalMs: clamp(toInt(env.BACKGROUND_POLL_INTERVAL_SECONDS, 10), 3, 300) * 1000,
  },
};

/** Names of required variables that are still empty. */
function missingConfig() {
  const missing = [];
  if (!config.mongodbUri) missing.push('MONGODB_URI');
  if (!config.bakong.token) missing.push('BAKONG_API_TOKEN');
  if (!config.merchant.accountId) missing.push('BAKONG_ACCOUNT_ID');
  if (!config.merchant.name) missing.push('MERCHANT_NAME');
  return missing;
}

module.exports = config;
module.exports.missingConfig = missingConfig;
