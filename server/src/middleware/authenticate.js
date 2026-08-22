const jwt = require('jsonwebtoken');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const { ERROR_CODES } = require('../config/constants');

// Establishes *who* the caller is (PRD §8.6). Role checks are a separate
// concern handled by authorize().
module.exports = (req, _res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(new ApiError(401, ERROR_CODES.UNAUTHORIZED, 'Authentication required'));
  }

  try {
    // alg pinned to HS256 — never accept a token with an attacker-chosen algorithm
    const payload = jwt.verify(token, env.ACCESS_TOKEN_SECRET, { algorithms: ['HS256'] });
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    return next(new ApiError(401, ERROR_CODES.UNAUTHORIZED, 'Invalid or expired token'));
  }
};
