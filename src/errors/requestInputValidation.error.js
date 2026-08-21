import { StatusCodes } from 'http-status-codes';

/**
 * Thrown by the request-validation middleware when an AJV schema rejects the
 * incoming query/params/body. Carries the per-section messages so the client
 * can show which field is wrong.
 */
export default class RequestInputValidationError extends Error {
  constructor(errorPayload) {
    super('Request validation failed');
    this.name = 'RequestInputValidationError';
    this.code = 4000;
    this.httpStatusCode = StatusCodes.BAD_REQUEST;
    this.errorPayload = errorPayload;
    Error.captureStackTrace(this, this.constructor);
  }

  toResponse() {
    return {
      statusCode: this.httpStatusCode,
      error: this.name,
      message: this.message,
      code: this.code,
      explanation: 'One or more request fields are invalid.',
      fields: this.errorPayload,
    };
  }
}
