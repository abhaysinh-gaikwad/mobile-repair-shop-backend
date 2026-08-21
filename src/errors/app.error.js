/**
 * The single error type thrown by services for business failures.
 * Anything else that escapes a service is treated as an internal error.
 */
export class AppError extends Error {
  constructor({ name, message, explanation, code, httpStatusCode }, innerError = null) {
    super(message);
    this.name = name;
    this.explanation = explanation;
    this.code = code;
    this.httpStatusCode = httpStatusCode;
    this.innerError = innerError;
    Error.captureStackTrace(this, this.constructor);
  }

  toResponse() {
    return {
      statusCode: this.httpStatusCode,
      error: this.name,
      message: this.message,
      code: this.code,
      explanation: this.explanation,
      ...(this.innerError ? { detail: this.innerError.message } : {}),
    };
  }
}

export const createError = (errorType, innerError = null) => new AppError(errorType, innerError);

export default AppError;
