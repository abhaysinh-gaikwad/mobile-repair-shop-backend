import db from '@src/db/models';
import { AppError } from '@src/errors/app.error';
import { Errors } from '@src/errors/errorCodes';
import { generateLedgerEntryNo } from '@src/helpers/repair.helpers';
import { LEDGER_ENTRY_TYPE } from '@src/utils/constants/public.constants';
import { round2 } from '@src/utils/money.utils';

/**
 * The one implementation of "reverse a ledger row", shared by the repair-job
 * reversal and the manual Cash Memo reversal.
 *
 * Extracted rather than copied: money correction is the last piece of logic in
 * this codebase that should exist twice. Both callers get the same rules —
 * a reversal cannot itself be reversed, an entry can be reversed at most once
 * (also enforced by a partial unique index), and the correction is always a
 * NEW negative row rather than an edit.
 */

/** Rejects anything that must not be reversed. Call before writing. */
export async function assertReversible(original, transaction) {
  // Reversing a reversal would let the books be walked back and forth
  // indefinitely; record a fresh payment instead.
  if (original.entryType === LEDGER_ENTRY_TYPE.REVERSAL) {
    throw new AppError(Errors.LEDGER_CANNOT_REVERSE_REVERSAL);
  }

  const existingReversal = await db.RepairLedger.findOne({
    where: { reversesEntryId: original.id },
    transaction,
  });
  if (existingReversal) throw new AppError(Errors.LEDGER_ALREADY_REVERSED);
}

/**
 * Builds the negative counterpart of `original`.
 *
 * Every snapshot field is COPIED from the original, so the pair reads
 * consistently forever even if the customer record changes later — and so a
 * manual reversal inherits `source: 'MANUAL'` and its NULL job/receipt, which
 * is exactly what the database CHECK constraint requires.
 *
 * `jobAmounts` is supplied by the repair-job caller, which knows the job's
 * running balance; manual entries have no job, so they pass nothing and the
 * three job columns stay zero.
 */
export async function buildReversalRow({ original, reversalReason, adminId, jobAmounts = null }, transaction) {
  return {
    entryNo: await generateLedgerEntryNo(transaction),
    source: original.source,
    repairJobId: original.repairJobId,
    receiptNumber: original.receiptNumber,
    customerId: original.customerId,
    customerName: original.customerName,
    customerMobile: original.customerMobile,
    description: original.description,
    reference: original.reference,
    entryType: LEDGER_ENTRY_TYPE.REVERSAL,
    paymentType: original.paymentType,
    paymentMethod: original.paymentMethod,
    amount: round2(-Number(original.amount)),
    jobTotalAfter: jobAmounts?.jobTotalAfter ?? 0,
    jobPaidAfter: jobAmounts?.jobPaidAfter ?? 0,
    jobBalanceAfter: jobAmounts?.jobBalanceAfter ?? 0,
    reversesEntryId: original.id,
    reversalReason: String(reversalReason).trim(),
    note: `Reversal of ${original.entryNo}`,
    paidAt: new Date(),
    receivedBy: adminId ?? null,
  };
}
