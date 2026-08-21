import { v4 as uuid } from 'uuid';

import db from '@src/db/models';
import { Logger } from '@src/libs/logger';

/**
 * Builds `req.context` and, for write routes, opens the request transaction.
 *
 * Pass `true` for anything that mutates data (POST/PUT/PATCH/DELETE) and
 * `false` for reads. Services then use `this.dbTransaction`; BaseHandler
 * commits on success and rolls back on failure, so no service manages the
 * transaction itself.
 *
 * The response listeners below are a safety net for paths that bypass
 * BaseHandler entirely (e.g. an error thrown in a controller before the
 * service runs) — without them such a request would leak an open transaction.
 */
export default function contextMiddleware(automaticTransaction = false) {
  return async (req, res, next) => {
    const context = {
      req,
      reqTimeStamp: Date.now(),
      traceId: uuid(),
      logger: Logger,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] ?? null,
    };

    if (automaticTransaction) {
      context.sequelizeTransaction = await db.sequelize.transaction();

      const settleTransaction = async () => {
        const transaction = context.sequelizeTransaction;
        if (['commit', 'rollback'].includes(transaction.finished)) return;

        const isErrorStatus = ['4', '5'].includes(String(res.statusCode)[0]);
        try {
          await (isErrorStatus ? transaction.rollback() : transaction.commit());
        } catch (error) {
          Logger.error({ err: error, traceId: context.traceId }, 'failed to settle transaction');
        }
      };

      res.on('finish', settleTransaction);
      res.on('close', settleTransaction);
    }

    req.context = context;
    next();
  };
}
