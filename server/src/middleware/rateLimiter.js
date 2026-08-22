const rateLimit = require('express-rate-limit');
const env = require('../config/env');
const { ERROR_CODES } = require('../config/constants');

const jsonError = (req, res) => {
  res.status(429).json({
    success: false,
    error: { code: ERROR_CODES.RATE_LIMITED, message: 'Too many requests, please try again later' },
  });
};

// Generous global limiter (PRD §6.2).
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 500,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonError,
});

// Strict limiter for credential-bearing endpoints — blunts brute force /
// credential stuffing (PRD §17).
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 25,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'test',
  handler: jsonError,
});

module.exports = { generalLimiter, authLimiter };
