import db from '@src/db/models';
import { AppError } from '@src/errors/app.error';
import { Errors } from '@src/errors/errorCodes';
import { generateLedgerEntryNo, getRepairMoneySummary } from '@src/helpers/repair.helpers';
import { getSuccessResponse } from '@src/helpers/response.helpers';
import { BaseHandler } from '@src/libs/logicBase';
import { LEDGER_ENTRY_TYPE, PAYMENT_METHOD, PAYMENT_TYPE } from '@src/utils/constants/public.constants';
import { round2 } from '@src/utils/money.utils';

/**
 * Record money taken from a customer — one immutable row in the ledger.
 *
 * Customer name/mobile and the receipt number are SNAPSHOTTED onto the row so
 * the cash memo reads standalone: correcting a customer's name next month must
 * not silently rewrite what last month's takings said.
 */
export default class AddPaymentService extends BaseHandler {
  async run() {
    const {
      repairJobId,
      amount,
      paymentType = PAYMENT_TYPE.ADVANCE,
      paymentMethod = PAYMENT_METHOD.CASH,
      paidAt,
      note,
      adminId,
    } = this.args;

    const transaction = this.dbTransaction;

    // Negative amounts must go through the reverse endpoint, which demands a
    // reason and links back to the original entry.
    if (round2(amount) <= 0) throw new AppError(Errors.INVALID_PAYMENT_AMOUNT);

    const repairJob = await db.RepairJob.findByPk(repairJobId, {
      include: [{ model: db.Customer, as: 'customer' }],
      transaction,
    });
    if (!repairJob) throw new AppError(Errors.REPAIR_NOT_FOUND);

    const paymentAmount = round2(amount);

    // State of the job AFTER this payment, stored on the row so any single
    // ledger line can be read and understood on its own.
    const before = await getRepairMoneySummary(repairJobId, transaction);
    const jobPaidAfter = round2(before.totalPaid + paymentAmount);
    const jobBalanceAfter = round2(before.totalAmount - jobPaidAfter);

    const entry = await db.RepairLedger.create(
      {
        entryNo: await generateLedgerEntryNo(transaction),
        repairJobId,
        receiptNumber: repairJob.receiptNumber,
        customerId: repairJob.customerId,
        customerName: repairJob.customer?.name ?? 'Unknown',
        customerMobile: repairJob.customer?.mobile ?? null,
        entryType: LEDGER_ENTRY_TYPE.PAYMENT,
        paymentType,
        paymentMethod,
        amount: paymentAmount,
        jobTotalAfter: before.totalAmount,
        jobPaidAfter,
        jobBalanceAfter,
        note: note ?? null,
        paidAt: paidAt ? new Date(paidAt) : new Date(),
        receivedBy: adminId ?? null,
      },
      { transaction },
    );

    return {
      ...getSuccessResponse('Payment recorded successfully.'),
      entry,
      totalAmount: before.totalAmount,
      totalPaid: jobPaidAfter,
      balance: jobBalanceAfter,
      // The shop rounds up and takes tips; over-payment is allowed but flagged.
      isOverpaid: jobBalanceAfter < 0,
    };
  }
}
