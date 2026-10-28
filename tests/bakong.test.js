'use strict';
// Tests of the Bakong client with a MOCKED fetch. These do NOT call the real Bakong API.
process.env.BAKONG_API_TOKEN = 'test-token-not-real';
process.env.BAKONG_API_BASE_URL = 'https://bakong.invalid';
process.env.BAKONG_TIMEOUT_MS = '1000';

const test = require('node:test');
const assert = require('node:assert/strict');
const bakong = require('../src/services/bakong');

const MD5 = 'd60f3db96913029a2af979a1662c1e72';
const realFetch = global.fetch;
const mockFetch = (status, body, delayMs = 0) => {
  global.fetch = async (url, opts) => {
    mockFetch.last = { url, opts };
    if (delayMs) {
      await new Promise((resolve, reject) => {
        const t = setTimeout(resolve, delayMs);
        opts.signal.addEventListener('abort', () => {
          clearTimeout(t);
          const e = new Error('aborted');
          e.name = 'AbortError';
          reject(e);
        });
      });
    }
    return { status, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)) };
  };
};
test.after(() => { global.fetch = realFetch; });

test('sends md5 with bearer token to the documented endpoint', async () => {
  mockFetch(200, { responseCode: 0, data: { hash: 'h', amount: 1 } });
  await bakong.checkTransactionByMd5(MD5);
  assert.equal(mockFetch.last.url, 'https://bakong.invalid/v1/check_transaction_by_md5');
  assert.equal(mockFetch.last.opts.method, 'POST');
  assert.equal(mockFetch.last.opts.headers.Authorization, 'Bearer test-token-not-real');
  assert.deepEqual(JSON.parse(mockFetch.last.opts.body), { md5: MD5 });
});

test('found transaction', async () => {
  mockFetch(200, { responseCode: 0, data: { hash: 'h', amount: 5, currency: 'USD' } });
  const r = await bakong.checkTransactionByMd5(MD5);
  assert.equal(r.found, true);
  assert.equal(r.transaction.hash, 'h');
});

test('not found is not an error', async () => {
  mockFetch(200, { responseCode: 1, responseMessage: 'not found', errorCode: 3, data: null });
  const r = await bakong.checkTransactionByMd5(MD5);
  assert.equal(r.found, false);
});

test('HTTP errors map to specific codes', async () => {
  for (const [status, code] of [[401, 'BAKONG_AUTH'], [403, 'BAKONG_FORBIDDEN'], [429, 'BAKONG_RATE_LIMIT'], [503, 'BAKONG_UPSTREAM']]) {
    mockFetch(status, { responseCode: 1 });
    await assert.rejects(bakong.checkTransactionByMd5(MD5), { code });
  }
});

test('static QR / missing field rejections are errors, not "pending"', async () => {
  mockFetch(200, { responseCode: 1, errorCode: 2 });
  await assert.rejects(bakong.checkTransactionByMd5(MD5), { code: 'BAKONG_REJECTED' });
});

test('garbage responses are errors', async () => {
  mockFetch(200, 'not json');
  await assert.rejects(bakong.checkTransactionByMd5(MD5), { code: 'BAKONG_BAD_RESPONSE' });
  mockFetch(200, { responseCode: 0, data: null });
  await assert.rejects(bakong.checkTransactionByMd5(MD5), { code: 'BAKONG_BAD_RESPONSE' });
});

test('timeout and network failure', async () => {
  mockFetch(200, {}, 3000);
  await assert.rejects(bakong.checkTransactionByMd5(MD5), { code: 'BAKONG_TIMEOUT' });
  global.fetch = async () => { throw new Error('ECONNRESET'); };
  await assert.rejects(bakong.checkTransactionByMd5(MD5), { code: 'BAKONG_NETWORK_ERROR' });
});

test('invalid md5 never reaches the network', async () => {
  let called = false;
  global.fetch = async () => { called = true; };
  await assert.rejects(bakong.checkTransactionByMd5('nope'), { code: 'INVALID_MD5' });
  assert.equal(called, false);
});
