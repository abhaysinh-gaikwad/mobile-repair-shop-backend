import db from '@src/db/models';
import { AppError } from '@src/errors/app.error';
import { Errors } from '@src/errors/errorCodes';
import { getSuccessResponse } from '@src/helpers/response.helpers';
import { BaseHandler } from '@src/libs/logicBase';
import { CreateUnconfirmedPaymentService } from '@src/services/payments/unconfirmedPayment.service';
import AddPaymentService from './addPayment.service';

/**
 * Take a customer payment from the Cash Memo screen, using the RECEIPT NUMBER
 * the customer hands over at the counter.
 *
 * This is now the only way payments are recorded — the repair screen no longer
 * collects money. Resolving the receipt here guarantees every rupee is still
 * tied to the correct repair and customer, exactly as before; only the entry
 * point moved.
 *
 * `confirmed` is the "Payment Received" checkbox. It defaults to `true` —
 * missing the field must never silently stop money being recorded, since that
 * was the only behaviour that existed before this flag was added. Ticked
 * (the common case) writes a real `repair_ledger` row exactly as before, via
 * `AddPaymentService` — one implementation of the money path, not two.
 * Unticked writes a staging row instead — see `CreateUnconfirmedPaymentService`
 * for why that row deliberately never touches the ledger.
 */
export default class AddPaymentByReceiptService extends BaseHandler {
  async run() {
    const { receiptNumber, confirmed = true, ...rest } = this.args;

    const repairJob = await db.RepairJob.findOne({
      where: { receiptNumber: String(receiptNumber).trim().toUpperCase() },
      include: [{ model: db.Customer, as: 'customer', attributes: ['id', 'name', 'mobile'] }],
      transaction: this.dbTransaction,
    });

    if (!repairJob) throw new AppError(Errors.RECEIPT_NOT_FOUND(receiptNumber));

    // Both branches run directly (`.run()`, not `.execute()`) so the write
    // shares this request's transaction rather than opening/committing its own.
    const inner = confirmed
      ? new AddPaymentService({ ...rest, repairJobId: repairJob.id }, this.context)
      : new CreateUnconfirmedPaymentService({ ...rest, repairJobId: repairJob.id }, this.context);
    const result = await inner.run();

    return {
      ...result,
      ...(confirmed ? getSuccessResponse(`Payment recorded against ${repairJob.receiptNumber}.`) : {}),
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
