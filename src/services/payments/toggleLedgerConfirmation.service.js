import db from '@src/db/models';
import { AppError } from '@src/errors/app.error';
import { Errors } from '@src/errors/errorCodes';
import { getSuccessResponse } from '@src/helpers/response.helpers';
import { shopDayRange } from '@src/libs/dayjs';
import { BaseHandler } from '@src/libs/logicBase';
import { CASH_DAY_STATUS } from '@src/utils/constants/public.constants';

/**
 * The confirmation checkbox for a Customer Payment — see
 * repairLedger.model.js for the invariant this upholds. A straight toggle on
 * the ONE existing row: no new ledger entry, no reversal, no popup, and no
 * effect on any total. This is a manual tracking checkbox ONLY — the shop's
 * own record of "I've personally checked this one" — a recorded payment
 * counts in a job's balance, the Cash Drawer and every report from the
 * moment it's recorded, regardless of this flag, and stays counted no
 * matter how many times it's toggled.
 *
 * Blocked once the day is closed — same reasoning as every other edit in
 * the Cash Memo: a closed day is frozen, and re-opening it is the
 * deliberate, visible step that says "something about this day is about to
 * change."
 */
export default class ToggleLedgerConfirmationService extends BaseHandler {
  async run() {
    const { id, isConfirmed } = this.args;
    const transaction = this.dbTransaction;

    const entry = await db.RepairLedger.findByPk(id, { transaction });
    if (!entry) throw new AppError(Errors.LEDGER_ENTRY_NOT_FOUND);

    const businessDate = shopDayRange(entry.paidAt).start.toISOString().slice(0, 10);
    const cashDay = await db.CashDay.findOne({ where: { businessDate }, transaction });
    if (cashDay?.status === CASH_DAY_STATUS.CLOSED) throw new AppError(Errors.CASH_DAY_CLOSED(cashDay.businessDate));

    await entry.update({ isConfirmed: Boolean(isConfirmed) }, { transaction });

    return {
      ...getSuccessResponse(isConfirmed ? 'Payment confirmed.' : 'Payment marked as not confirmed.'),
      entry,
    };
  }
}
