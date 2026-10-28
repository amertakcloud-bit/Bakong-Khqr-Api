'use strict';

/**
 * Thin client for the Bakong Open API (token is read from env, server-side only).
 *
 * Only the endpoint confirmed in the public docs / community clients is used:
 *   POST {base}/v1/check_transaction_by_md5   body: { "md5": "<32 hex>" }
 *   Authorization: Bearer <token>
 *
 * NOTE: not exercised against the live API in the build environment.
 */

const config = require('../config/env');
const { AppError } = require('../utils/errors');
const { MD5_RE } = require('../utils/validate');

const GENERIC = 'ប្រព័ន្ធពិនិត្យការទូទាត់មានបញ្ហាបណ្ដោះអាសន្ន សូមរង់ចាំបន្តិច';

// errorCode values that mean "this request is wrong", not "no payment yet".
// (2 = static QR not supported, 5 = missing fields, per community client docs.)
const REJECT_ERROR_CODES = new Set([2, 5]);

async function post(path, body) {
  const { baseUrl, token, timeoutMs } = config.bakong;
  if (!token) {
    throw new AppError(503, 'BAKONG_TOKEN_MISSING', GENERIC, { hint: 'BAKONG_API_TOKEN is empty' });
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(baseUrl + path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch (_) {
      /* leave null; handled in interpret() */
    }
    return { status: res.status, json };
  } catch (err) {
    if (err && err.name === 'AbortError') {
      throw new AppError(504, 'BAKONG_TIMEOUT', GENERIC, { timeoutMs });
    }
    throw new AppError(502, 'BAKONG_NETWORK_ERROR', GENERIC, { cause: String(err && err.message) });
  } finally {
    clearTimeout(timer);
  }
}

/** Turn an HTTP status + JSON body into {found:true,transaction} | {found:false}, or throw. */
function interpret(status, json) {
  const extra = { http: status, body: json };
  if (status === 401) throw new AppError(502, 'BAKONG_AUTH', GENERIC, extra);
  if (status === 403) throw new AppError(502, 'BAKONG_FORBIDDEN', GENERIC, extra);
  if (status === 429) throw new AppError(503, 'BAKONG_RATE_LIMIT', GENERIC, extra);
  if (status >= 500) throw new AppError(502, 'BAKONG_UPSTREAM', GENERIC, extra);
  if (!json || typeof json !== 'object' || json.responseCode === undefined) {
    throw new AppError(502, 'BAKONG_BAD_RESPONSE', GENERIC, extra);
  }

  if (json.responseCode === 0) {
    const d = json.data;
    if (d && typeof d === 'object' && (d.hash || d.amount !== undefined)) {
      return { found: true, transaction: d };
    }
    throw new AppError(502, 'BAKONG_BAD_RESPONSE', GENERIC, extra);
  }

  if (REJECT_ERROR_CODES.has(Number(json.errorCode))) {
    throw new AppError(502, 'BAKONG_REJECTED', GENERIC, extra);
  }
  return { found: false, errorCode: json.errorCode, message: json.responseMessage };
}

async function checkTransactionByMd5(md5) {
  if (typeof md5 !== 'string' || !MD5_RE.test(md5)) {
    throw new AppError(500, 'INVALID_MD5', GENERIC, { md5 });
  }
  const { status, json } = await post('/v1/check_transaction_by_md5', { md5: md5.toLowerCase() });
  return interpret(status, json);
}

module.exports = { checkTransactionByMd5, interpret };
