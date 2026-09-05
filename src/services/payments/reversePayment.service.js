import db from '@src/db/models';
import { AppError } from '@src/errors/app.error';
import { Errors } from '@src/errors/errorCodes';
import { getRepairMoneySummary } from '@src/helpers/repair.helpers';
import { getSuccessResponse } from '@src/helpers/response.helpers';
import { BaseHandler } from '@src/libs/logicBase';
import { assertReversible, buildReversalRow } from '@src/services/payments/ledgerReversal.helpers';
import { round2 } from '@src/utils/money.utils';

/**
 * Undo a payment WITHOUT erasing it.
 *
 * This is the only correction mechanism for money — there is no UPDATE and no
 * DELETE route on the ledger. A reversal posts a NEW row carrying the negative
 * amount, a link to the original, and a mandatory reason. Both rows stay
 * visible forever, so a daily collection figure the owner has already read can
 * never silently change.
 *
 * Because reversals are negative, SUM(amount) remains correct everywhere with
 * no filtering.
 */
export default class ReversePaymentService extends BaseHandler {
  async run() {
    const { repairJobId, entryId, reversalReason, adminId } = this.args;
    const transaction = this.dbTransaction;

    const original = await db.RepairLedger.findOne({
      where: { id: entryId, repairJobId },
      transaction,
    });
    if (!original) throw new AppError(Errors.LEDGER_ENTRY_NOT_FOUND);

    // Shared with the manual Cash Memo reversal — see ledgerReversal.helpers.
    await assertReversible(original, transaction);

    const reversalAmount = round2(-Number(original.amount));

    const before = await getRepairMoneySummary(repairJobId, transaction);
    const jobPaidAfter = round2(before.totalPaid + reversalAmount);
    const jobBalanceAfter = round2(before.totalAmount - jobPaidAfter);

    const entry = await db.RepairLedger.create(
      await buildReversalRow(
        {
          original,
          reversalReason,
          adminId,
          // Only the repair-job path knows the job's running balance.
          jobAmounts: { jobTotalAfter: before.totalAmount, jobPaidAfter, jobBalanceAfter },
        },
        transaction,
      ),
      { transaction },
    );

    return {
      ...getSuccessResponse(`Payment ${original.entryNo} reversed.`),
      entry,
      reversedEntryNo: original.entryNo,
      totalAmount: before.totalAmount,
      totalPaid: jobPaidAfter,
      balance: jobBalanceAfter,
    };
  }
}
