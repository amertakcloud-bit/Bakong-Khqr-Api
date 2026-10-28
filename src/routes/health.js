'use strict';

const express = require('express');
const config = require('../config/env');
const { connectDB, dbState } = require('../config/database');

const router = express.Router();

router.get('/', async (req, res) => {
  let dbOk = false;
  try {
    await connectDB();
    dbOk = dbState() === 'connected';
  } catch (_) {
    dbOk = false;
  }

  const missing = config.missingConfig();
  res.status(dbOk ? 200 : 503).json({
    ok: dbOk,
    uptimeSeconds: Math.round(process.uptime()),
    database: dbOk ? 'connected' : dbState(),
    // Only variable NAMES are reported, never values.
    config: { complete: missing.length === 0, missing },
    backgroundPolling: config.poller.enabled,
    time: new Date().toISOString(),
  });
});

module.exports = router;
