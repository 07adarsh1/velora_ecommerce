const ApiError = require('../utils/ApiError');
const { ERROR_CODES } = require('../config/constants');

/**
 * Establishes *what* the caller may do (PRD §8.6). Must run after authenticate.
 * Usage: router.post('/products', authenticate, authorize('admin'), ...)
 */
module.exports =
  (...allowedRoles) =>
  (req, _res, next) => {
    if (!req.user) {
      return next(new ApiError(401, ERROR_CODES.UNAUTHORIZED, 'Authentication required'));
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(new ApiError(403, ERROR_CODES.FORBIDDEN, 'You do not have permission to perform this action'));
    }
    next();
  };
