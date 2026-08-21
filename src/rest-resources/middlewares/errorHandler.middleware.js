import { StatusCodes } from 'http-status-codes';

import { AppError } from '@src/errors/app.error';
import { Errors } from '@src/errors/errorCodes';
import RequestInputValidationError from '@src/errors/requestInputValidation.error';
import { Logger } from '@src/libs/logger';

// eslint-disable-next-line no-unused-vars -- Express identifies error handlers by arity (4 args).
export default function errorHandlerMiddleware(error, req, res, _next) {
  if (error instanceof AppError || error instanceof RequestInputValidationError) {
    const payload = error.toResponse();
    return res.status(payload.statusCode).json({ data: {}, errors: payload });
  }

  // Anything reaching here is unexpected — log it in full, return something generic.
  Logger.error({ err: error, path: req.originalUrl, traceId: req.context?.traceId }, 'unhandled request error');

  const fallback = new AppError(Errors.INTERNAL_ERROR).toResponse();
  return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ data: {}, errors: fallback });
}
