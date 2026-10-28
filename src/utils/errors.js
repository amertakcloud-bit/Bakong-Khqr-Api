'use strict';

/**
 * Error with an HTTP status, a stable machine-readable code, and a
 * user-facing (Khmer) message. `extra` is for server logs only and is
 * never sent to the client.
 */
class AppError extends Error {
  constructor(status, code, message, extra) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.extra = extra || null;
  }
}

module.exports = { AppError };
