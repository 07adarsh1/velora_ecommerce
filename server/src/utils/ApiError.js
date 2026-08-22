class ApiError extends Error {
  /**
   * @param {number} statusCode HTTP status code
   * @param {string} code machine-readable error code (see constants.ERROR_CODES)
   * @param {string} message human-readable, client-safe message
   * @param {Array<{field: string, message: string}>} [details] per-field validation details
   */
  constructor(statusCode, code, message, details = undefined) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = ApiError;
