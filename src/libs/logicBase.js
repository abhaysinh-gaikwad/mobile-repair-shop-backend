import { AppError } from '@src/errors/app.error';
import { Errors } from '@src/errors/errorCodes';
import { Logger } from '@src/libs/logger';

/**
 * Base class for every service.
 *
 * A subclass implements exactly one method — `async run()` — and reads its
 * inputs from `this.args`. Transaction handling is done here so no service
 * ever calls `.commit()` / `.rollback()` itself:
 *
 *   - `context.sequelizeTransaction` is opened by contextMiddleware(true)
 *   - committed here on success
 *   - rolled back here on failure
 *
 * Anything thrown that isn't an AppError is logged with its stack and
 * converted into a generic INTERNAL_ERROR so internals never leak to clients.
 */
export class BaseHandler {
  constructor(args = {}, context = {}) {
    this.args = args;
    this.context = context;
    this.dbTransaction = context.sequelizeTransaction;
    this.logger = context.logger || Logger;
  }

  static async execute(args = {}, context = {}) {
    const instance = new this(args, context);
    const startedAt = Date.now();

    try {
      const result = await instance.run();

      if (context.sequelizeTransaction && !instance.isTransactionFinished()) {
        await context.sequelizeTransaction.commit();
      }

      instance.logger.debug({ service: this.name, ms: Date.now() - startedAt }, 'service completed');

      return result;
    } catch (error) {
      await instance.handleError(error);
      // handleError always throws; this is unreachable but keeps intent clear.
      throw error;
    }
  }

  isTransactionFinished() {
    return ['commit', 'rollback'].includes(this.dbTransaction?.finished);
  }

  async handleError(error) {
    if (this.dbTransaction && !this.isTransactionFinished()) {
      await this.dbTransaction.rollback();
    }

    if (error instanceof AppError) {
      throw error;
    }

    this.logger.error({ err: error, service: this.constructor.name }, 'unhandled service error');
    throw new AppError(Errors.INTERNAL_ERROR, error);
  }

  async run() {
    throw new Error('The run() method must be implemented in a subclass');
  }
}

export default BaseHandler;
