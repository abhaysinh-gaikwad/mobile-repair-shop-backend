import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

import config from '@src/configs/app.config';
import { AppError } from '@src/errors/app.error';
import { Errors } from '@src/errors/errorCodes';
import errorHandlerMiddleware from '@src/rest-resources/middlewares/errorHandler.middleware';
import routes from '@src/rest-resources/routes';

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow all origins dynamically (supports credentials: true)
      callback(null, true);
    },
    credentials: true,
  }),
);
app.use(morgan('dev'));
/**
 * `verify` keeps the exact bytes Meta signed.
 *
 * The WhatsApp webhook's X-Hub-Signature-256 is an HMAC over the RAW request
 * body. Re-serialising the parsed object would not reproduce it byte for byte
 * (key order, whitespace, unicode escapes), so the signature could never be
 * checked — and an unverified webhook is an open endpoint anyone who learns
 * the URL can post fake leads to.
 */
app.use(
  express.json({
    limit: '1mb',
    verify: (req, _res, buffer) => {
      req.rawBody = buffer;
    },
  }),
);
app.use(express.urlencoded({ extended: true }));

app.use(routes);

app.get('/', (_req, res) => {
  res.json({ data: { message: 'Mobile Repair Shop API', status: true }, errors: [] });
});

// Unmatched route -> a proper 404 in the shared envelope.
app.use((_req, _res, next) => next(new AppError(Errors.NOT_FOUND)));

// Must be registered last.
app.use(errorHandlerMiddleware);

export default app;
