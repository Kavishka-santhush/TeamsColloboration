const { ZodError } = require('zod');
const { ApiError } = require('../utils/response.util');

/**
 * Request validation middleware factory. Pass a zod schema describing
 * { body?, params?, query? } and the request parts are parsed + replaced with
 * validated (and coerced) values before the controller runs.
 */
function validate(schema) {
  return (req, res, next) => {
    try {
      if (schema.body) req.body = schema.body.parse(req.body);
      if (schema.params) req.params = schema.params.parse(req.params);
      if (schema.query) req.query = schema.query.parse(req.query);
      return next();
    } catch (err) {
      if (err instanceof ZodError) {
        const details = err.errors.map((e) => ({ field: e.path.join('.'), message: e.message }));
        return next(ApiError.badRequest('Validation failed', details));
      }
      return next(err);
    }
  };
}

module.exports = { validate };
