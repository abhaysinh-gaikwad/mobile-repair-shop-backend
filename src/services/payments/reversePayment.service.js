import db from '@src/db/models';
import { AppError } from '@src/errors/app.error';
import { Errors } from '@src/errors/errorCodes';
import { generateLedgerEntryNo, getRepairMoneySummary } from '@src/helpers/repair.helpers';
import { getSuccessResponse } from '@src/helpers/response.helpers';
import { BaseHandler } from '@src/libs/logicBase';
import { LEDGER_ENTRY_TYPE } from '@src/utils/constants/public.constants';
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

    // Reversing a reversal would let the books be walked back and forth
    // indefinitely; record a fresh payment instead.
    if (original.entryType === LEDGER_ENTRY_TYPE.REVERSAL) {
      throw new AppError(Errors.LEDGER_CANNOT_REVERSE_REVERSAL);
    }

    // Application-level check; a partial unique index on reverses_entry_id
    // enforces the same rule in the database.
    const existingReversal = await db.RepairLedger.findOne({
      where: { reversesEntryId: original.id },
      transaction,
    });
    if (existingReversal) throw new AppError(Errors.LEDGER_ALREADY_REVERSED);

    const reversalAmount = round2(-Number(original.amount));

    const before = await getRepairMoneySummary(repairJobId, transaction);
    const jobPaidAfter = round2(before.totalPaid + reversalAmount);
    const jobBalanceAfter = round2(before.totalAmount - jobPaidAfter);

    const entry = await db.RepairLedger.create(
      {
        entryNo: await generateLedgerEntryNo(transaction),
        repairJobId,
        // Snapshots copied from the original so the pair reads consistently
        // even if the customer record changes later.
        receiptNumber: original.receiptNumber,
        customerId: original.customerId,
        customerName: original.customerName,
        customerMobile: original.customerMobile,
        entryType: LEDGER_ENTRY_TYPE.REVERSAL,
        paymentType: original.paymentType,
        paymentMethod: original.paymentMethod,
        amount: reversalAmount,
        jobTotalAfter: before.totalAmount,
        jobPaidAfter,
        jobBalanceAfter,
        reversesEntryId: original.id,
        reversalReason: String(reversalReason).trim(),
        note: `Reversal of ${original.entryNo}`,
        paidAt: new Date(),
        receivedBy: adminId ?? null,
      },
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
