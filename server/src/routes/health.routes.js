const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();

router.get('/', (_req, res) => {
  const dbState = ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState] || 'unknown';
  const body = {
    success: true,
    data: {
      status: 'ok',
      db: dbState,
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    },
  };
  return res.status(dbState === 'connected' ? 200 : 503).json(body);
});

module.exports = router;
