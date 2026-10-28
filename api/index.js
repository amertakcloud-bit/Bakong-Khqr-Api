'use strict';

// Vercel serverless entry point. The Express app is a valid request handler.
// No background poller here: Vercel functions don't keep running between requests.
module.exports = require('../src/app');
