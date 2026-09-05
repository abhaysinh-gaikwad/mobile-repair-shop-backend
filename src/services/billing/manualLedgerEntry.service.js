import db from '@src/db/models';
import { AppError } from '@src/errors/app.error';
import { Errors } from '@src/errors/errorCodes';
import { generateLedgerEntryNo } from '@src/helpers/repair.helpers';
import { getSuccessResponse } from '@src/helpers/response.helpers';
import { BaseHandler } from '@src/libs/logicBase';
import { assertReversible, buildReversalRow } from '@src/services/payments/ledgerReversal.helpers';
import {
  LEDGER_ENTRY_TYPE,
  LEDGER_SOURCE,
  PAYMENT_METHOD,
  PAYMENT_TYPE,
} from '@src/utils/constants/public.constants';
import { round2 } from '@src/utils/money.utils';

/**
 * Cash Memo entries that are NOT tied to a repair receipt.
 *
 * Two real cases: a customer pays for something the shop never opened a repair
 * job for, and the older paper records from before this software — many with
 * no receipt number at all.
 *
 * These are ordinary `repair_ledger` rows carrying `source = 'MANUAL'`, not a
 * second table. Everything downstream (Cash Memo, daily collection, cash
 * drawer, collection report) is a plain SUM over that one table, so a manual
 * entry lands in every total the moment it is written and no reporting code
 * had to change. The alternative — a parallel table — would have meant two
 * sets of books that could disagree, which is the one thing the ledger's
 * design has always refused.
 *
 * Append-only is untouched: there is no update and no delete here either. A
 * mistake is corrected with ReverseManualEntryService below, which posts the
 * same negative counterpart the repair-job path uses.
 */
export class AddManualLedgerEntryService extends BaseHandler {
  async run() {
    const {
      amount,
      description,
      paymentMethod = PAYMENT_METHOD.CASH,
      paidAt,
      customerName,
      customerMobile,
      reference,
      note,
      adminId,
    } = this.args;

    const transaction = this.dbTransaction;
    const value = round2(amount);

    // Money IN only. A negative amount here would be indistinguishable from a
    // reversal row and would quietly corrupt the reversal audit trail; money
    // OUT is a shop expense, which is a different table entirely.
    if (!(value > 0)) throw new AppError(Errors.LEDGER_INVALID_MANUAL_AMOUNT);

    const entry = await db.RepairLedger.create(
      {
        entryNo: await generateLedgerEntryNo(transaction),
        source: LEDGER_SOURCE.MANUAL,

        // Both NULL, and the database CHECK constraint requires it: a manual
        // entry that picked up a repairJobId would silently change that job's
        // balance, since getRepairMoneySummary() sums by that column.
        repairJobId: null,
        receiptNumber: null,

        // Not linked to a customer record either. These are often historical
        // rows for people who may not exist in `customers` at all, and
        // inventing a customer to satisfy a foreign key would pollute the
        // customer list with entries that were never really customers here.
        customerId: null,
        customerName: customerName?.trim() || null,
        customerMobile: customerMobile?.trim() || null,

        description: String(description).trim(),
        reference: reference?.trim() || null,

        entryType: LEDGER_ENTRY_TYPE.PAYMENT,
        // "Which stage of the repair" has no meaning without a repair.
        paymentType: PAYMENT_TYPE.MANUAL,
        paymentMethod,
        amount: value,

        // No job, so no job balance. Left at zero rather than copied from
        // anywhere — these columns describe a repair job's running state and
        // must not imply one exists.
        jobTotalAfter: 0,
        jobPaidAfter: 0,
        jobBalanceAfter: 0,

        note: note?.trim() || null,
        // Backdating is the entire point for historical records; when omitted
        // this is simply now.
        paidAt: paidAt ? new Date(paidAt) : new Date(),
        receivedBy: adminId ?? null,
      },
      { transaction },
    );

    return {
      ...getSuccessResponse(`Manual entry ${entry.entryNo} recorded.`),
      entry,
    };
  }
}

/**
 * Correct a manual entry — by reversal, never by edit or delete.
 *
 * Deliberately refuses repair-linked rows: those are reversed through
 * POST /repairs/:id/payments/:entryId/reverse, which additionally recomputes
 * the job's balance. Having exactly one route per kind means neither can be
 * corrected in a way that skips its own bookkeeping.
 */
export class ReverseManualEntryService extends BaseHandler {
  async run() {
    const { entryId, reversalReason, adminId } = this.args;
    const transaction = this.dbTransaction;

    const original = await db.RepairLedger.findByPk(entryId, { transaction });
    if (!original) throw new AppError(Errors.LEDGER_ENTRY_NOT_FOUND);

    if (original.source !== LEDGER_SOURCE.MANUAL) {
      throw new AppError(Errors.LEDGER_NOT_A_MANUAL_ENTRY);
    }

    await assertReversible(original, transaction);

    const entry = await db.RepairLedger.create(
      await buildReversalRow({ original, reversalReason, adminId }, transaction),
      { transaction },
    );

    return {
      ...getSuccessResponse(`Manual entry ${original.entryNo} reversed.`),
      entry,
      reversedEntryNo: original.entryNo,
    };
  }
}
