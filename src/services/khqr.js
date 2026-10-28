'use strict';

/**
 * KHQR generation using the official NBC SDK (npm: bakong-khqr).
 * We never hand-roll the EMV/KHQR format or CRC.
 */

const crypto = require('crypto');
const QRCode = require('qrcode');
const config = require('../config/env');
const { AppError } = require('../utils/errors');

function loadSdk() {
  try {
    // Loaded lazily so the rest of the app can boot/test without it.
    return require('bakong-khqr');
  } catch (err) {
    throw new AppError(500, 'KHQR_SDK_MISSING', 'ប្រព័ន្ធបង្កើត KHQR មិនទាន់រួចរាល់ (SDK មិនបានដំឡើង)', {
      cause: String(err && err.message),
    });
  }
}

/**
 * Build a dynamic individual KHQR (fixed amount + expiry).
 * @returns {{qr: string, md5: string}}
 */
function generate({ amount, currency, orderId, expiresAtMs }) {
  const { BakongKHQR, khqrData, IndividualInfo } = loadSdk();
  const { accountId, name, city } = config.merchant;

  const optional = {
    currency: currency === 'USD' ? khqrData.currency.usd : khqrData.currency.khr,
    amount,
    billNumber: orderId, // lets you match the payment to the order in your bank app
    expirationTimestamp: expiresAtMs,
  };

  const info = new IndividualInfo(accountId, name, city, optional);
  const result = BakongKHQR.generateIndividual(info);

  const statusCode = result && result.status && result.status.code;
  if (statusCode !== 0 || !result.data || !result.data.qr) {
    throw new AppError(500, 'KHQR_GENERATION_FAILED', 'មិនអាចបង្កើត KHQR បានទេ សូមពិនិត្យការកំណត់ Merchant', {
      status: result && result.status,
    });
  }

  const qr = result.data.qr;
  const localMd5 = crypto.createHash('md5').update(qr).digest('hex');
  const md5 = result.data.md5 || localMd5;
  if (md5 !== localMd5) {
    console.warn('[khqr] SDK md5 differs from md5(qr); using the SDK value');
  }
  return { qr, md5 };
}

/** Render the KHQR payload as a scannable PNG data URL (black on white, quiet zone included). */
function toImage(qr) {
  return QRCode.toDataURL(qr, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 360,
    color: { dark: '#000000', light: '#ffffff' },
  });
}

module.exports = { generate, toImage };
