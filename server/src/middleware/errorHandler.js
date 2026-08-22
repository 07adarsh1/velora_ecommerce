const env = require('../config/env');
const { ERROR_CODES } = require('../config/constants');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');

function shape(status, code, message, details) {
  const error = { code, message };
  if (details) error.details = details;
  return { status, body: { success: false, error } };
}

// The single place that turns any thrown error into the standard error
// envelope (PRD §6.2/§6.4). Stack traces are logged server-side only.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let out;

  if (err instanceof ApiError) {
    out = shape(err.statusCode, err.code, err.message, err.details);
  } else if (err.name === 'ValidationError') {
    // Mongoose schema validation
    const details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    out = shape(400, ERROR_CODES.VALIDATION_ERROR, 'Invalid data', details);
  } else if (err.name === 'CastError') {
    out = shape(400, ERROR_CODES.VALIDATION_ERROR, `Invalid value for '${err.path}'`);
  } else if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    out = shape(409, ERROR_CODES.CONFLICT, `Duplicate value for ${field}`);
  } else if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    out = shape(401, ERROR_CODES.UNAUTHORIZED, 'Invalid or expired token');
  } else if (err.type === 'entity.parse.failed' || err.type === 'entity.too.large') {
    out = shape(400, ERROR_CODES.VALIDATION_ERROR, 'Malformed request body');
  } else {
    out = shape(500, ERROR_CODES.INTERNAL_ERROR, 'Something went wrong');
  }

  const logData = {
    statusCode: out.status,
    code: out.body.error.code,
    method: req.method,
    path: req.originalUrl,
  };
  if (out.status >= 500) {
    logger.error({ err, ...logData }, 'Unhandled error');
  } else if (env.NODE_ENV !== 'test') {
    logger.warn(logData, out.body.error.message);
  }

  res.status(out.status).json(out.body);
}

module.exports = errorHandler;
