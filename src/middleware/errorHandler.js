'use strict';

const { AppError } = require('../utils/errors');

function notFound(req, res) {
  res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'រកមិនឃើញទំព័រ ឬ API នេះទេ' } });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  let status = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'ប្រព័ន្ធមានបញ្ហា សូមព្យាយាមម្ដងទៀត';

  if (err instanceof AppError) {
    status = err.status;
    code = err.code;
    message = err.message;
  } else if (err && err.type === 'entity.parse.failed') {
    status = 400;
    code = 'INVALID_JSON';
    message = 'ទិន្នន័យដែលផ្ញើមកមិនត្រឹមត្រូវ';
  } else if (err && err.type === 'entity.too.large') {
    status = 413;
    code = 'PAYLOAD_TOO_LARGE';
    message = 'ទិន្នន័យធំពេក';
  }

  if (status >= 500) {
    console.error(`[error] ${code} ${req.method} ${req.originalUrl}:`, err && err.stack ? err.stack : err);
  }
  res.status(status).json({ ok: false, error: { code, message } });
}

module.exports = { notFound, errorHandler };
