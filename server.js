'use strict';

/**
 * Long-running entry point (local dev + Render).
 * On Vercel the entry point is api/index.js instead.
 */

const config = require('./src/config/env');
const app = require('./src/app');
const { connectDB } = require('./src/config/database');
const poller = require('./src/services/poller');

async function main() {
  const missing = config.missingConfig();
  if (missing.length) {
    const msg = `Missing environment variables: ${missing.join(', ')}`;
    if (config.isProd) console.error(`[config] ${msg} - payments will be refused until they are set.`);
    else console.warn(`[config] ${msg} (see .env.example)`);
  }

  try {
    await connectDB();
    console.log('[db] connected');
  } catch (err) {
    console.error('[db] initial connection failed:', err.message, '- will retry on the next request');
  }

  const server = app.listen(config.port, () => {
    console.log(`[server] listening on port ${config.port} (${config.nodeEnv})`);
  });
  poller.start();

  const shutdown = (signal) => {
    console.log(`[server] ${signal} received, shutting down`);
    poller.stop();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main();
