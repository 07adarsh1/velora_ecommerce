const ApiError = require('../utils/ApiError');
const { ERROR_CODES } = require('../config/constants');

module.exports = (req, _res, next) => {
  next(new ApiError(404, ERROR_CODES.NOT_FOUND, `Route not found: ${req.method} ${req.originalUrl}`));
};
