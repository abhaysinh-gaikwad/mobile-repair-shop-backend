import db from '@src/db/models';
import { AppError } from '@src/errors/app.error';
import { Errors } from '@src/errors/errorCodes';
import { getSuccessResponse } from '@src/helpers/response.helpers';
import { BaseHandler } from '@src/libs/logicBase';
import AddPaymentService from './addPayment.service';

/**
 * Take a customer payment from the Cash Memo screen, using the RECEIPT NUMBER
 * the customer hands over at the counter.
 *
 * This is now the only way payments are recorded — the repair screen no longer
 * collects money. Resolving the receipt here guarantees every rupee is still
 * tied to the correct repair and customer, exactly as before; only the entry
 * point moved. The actual ledger write is delegated to `AddPaymentService` so
 * there is one implementation of the money path, not two.
 *
 * A payment is always recorded straight away, exactly as it always has been
 * — the "confirmed or not" question is answered AFTER the fact, with the
 * checkbox on the row itself (see toggleLedgerConfirmation.service.js), not
 * at entry time. There used to be a separate "Payment Received" tick right
 * here with its own staging table; it was removed at the shop's explicit
 * request in favour of one simple, always-toggleable checkbox on the entry.
 */
export default class AddPaymentByReceiptService extends BaseHandler {
  async run() {
    const { receiptNumber, ...rest } = this.args;

    const repairJob = await db.RepairJob.findOne({
      where: { receiptNumber: String(receiptNumber).trim().toUpperCase() },
      include: [{ model: db.Customer, as: 'customer', attributes: ['id', 'name', 'mobile'] }],
      transaction: this.dbTransaction,
    });

    if (!repairJob) throw new AppError(Errors.RECEIPT_NOT_FOUND(receiptNumber));

    // Reuse the existing, tested ledger path. `execute` would try to commit the
    // request transaction, so the inner service is run directly.
    const inner = new AddPaymentService({ ...rest, repairJobId: repairJob.id }, this.context);
    const result = await inner.run();

    return {
      ...result,
      ...getSuccessResponse(`Payment recorded against ${repairJob.receiptNumber}.`),
      repairJob: {
        id: repairJob.id,
        receiptNumber: repairJob.receiptNumber,
        customerName: repairJob.customer?.name ?? null,
        customerMobile: repairJob.customer?.mobile ?? null,
        status: repairJob.status,
      },
    };
  }
}
