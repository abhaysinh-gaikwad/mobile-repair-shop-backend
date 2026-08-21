import RequestInputValidationError from '@src/errors/requestInputValidation.error';
import ajv from '@src/libs/ajv';

/**
 * Compiles a schema's query/params/body sections once at route-registration
 * time, then validates each request against them.
 *
 * Because the shared AJV instance has `coerceTypes: true`, numeric query
 * params arrive already coerced (`?page=2` -> 2).
 */
export function requestValidationMiddleware({ query = {}, params = {}, body = {} } = {}) {
  const compiledQuerySchema = ajv.compile(query);
  const compiledParamsSchema = ajv.compile(params);
  const compiledBodySchema = ajv.compile(body);

  return (req, _res, next) => {
    const errorPayload = {};

    if (!compiledQuerySchema(req.query)) {
      errorPayload.query = compiledQuerySchema.errors.map((e) => `${e.instancePath || 'query'} ${e.message}`.trim());
    }
    if (!compiledParamsSchema(req.params)) {
      errorPayload.params = compiledParamsSchema.errors.map((e) => `${e.instancePath || 'params'} ${e.message}`.trim());
    }
    if (!compiledBodySchema(req.body ?? {})) {
      errorPayload.body = compiledBodySchema.errors.map((e) => `${e.instancePath || 'body'} ${e.message}`.trim());
    }

    return Object.keys(errorPayload).length
      ? next(new RequestInputValidationError(errorPayload))
      : next();
  };
}

export default requestValidationMiddleware;
