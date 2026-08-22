const ApiError = require('../utils/ApiError');
const { ERROR_CODES } = require('../config/constants');

/**
 * Validates and coerces req.params / req.query / req.body against zod schemas
 * before any controller runs (PRD §6.2). Schemas are written as
 * z.object({ body?, query?, params? }) wrappers; the wrapper's shape is
 * unwrapped here so each source is parsed against its own schema. The parsed
 * (and coerced) values replace the originals, so controllers see clean data.
 *
 * Usage: router.post('/', validate(createProductSchema), controller)
 */
module.exports =
  (schema = {}) =>
  (req, _res, next) => {
    // Unwrap a z.object({ body, query, params }) wrapper; plain
    // { body, query, params } objects are accepted too.
    const shape = schema && typeof schema.shape === 'object' ? schema.shape : schema;

    const sources = [
      ['body', shape.body],
      ['query', shape.query],
      ['params', shape.params],
    ];
    const details = [];

    for (const [key, sourceSchema] of sources) {
      if (!sourceSchema) continue;
      const result = sourceSchema.safeParse(req[key]);
      if (result.success) {
        req[key] = result.data;
      } else {
        for (const issue of result.error.issues) {
          details.push({ field: [key, ...issue.path].join('.'), message: issue.message });
        }
      }
    }

    if (details.length > 0) {
      return next(new ApiError(400, ERROR_CODES.VALIDATION_ERROR, 'Validation failed', details));
    }
    next();
  };
