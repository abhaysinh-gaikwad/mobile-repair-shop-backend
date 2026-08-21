import db from '@src/db/models';
import { AppError } from '@src/errors/app.error';
import { Errors } from '@src/errors/errorCodes';
import { getRepairMoneySummary } from '@src/helpers/repair.helpers';
import { getSuccessResponse } from '@src/helpers/response.helpers';
import { BaseHandler } from '@src/libs/logicBase';
import { round2 } from '@src/utils/money.utils';

/**
 * Look up a repair by its receipt number so the Cash Memo can confirm WHO is
 * paying, and how much is outstanding, before any money is taken.
 *
 * Deliberately lightweight — no parts, call logs or history — because this
 * runs on every keystroke-completed receipt number at a busy counter.
 */
export default class LookupReceiptService extends BaseHandler {
  async run() {
    const { receiptNumber } = this.args;

    const repairJob = await db.RepairJob.findOne({
      where: { receiptNumber: String(receiptNumber).trim().toUpperCase() },
      include: [
        { model: db.Customer, as: 'customer', attributes: ['id', 'name', 'mobile'] },
        { model: db.Engineer, as: 'engineer', attributes: ['id', 'name'] },
      ],
    });

    if (!repairJob) throw new AppError(Errors.RECEIPT_NOT_FOUND(receiptNumber));

    const money = await getRepairMoneySummary(repairJob.id);

    return {
      ...getSuccessResponse('Receipt found.'),
      repairJob: {
        id: repairJob.id,
        receiptNumber: repairJob.receiptNumber,
        status: repairJob.status,
        brand: repairJob.brand,
        modelNumber: repairJob.modelNumber,
        customer: repairJob.customer,
        engineer: repairJob.engineer,
        customerComplaint: repairJob.customerComplaint,
        estimatedCost: repairJob.estimatedCost === null ? null : round2(repairJob.estimatedCost),
        finalAmount: repairJob.finalAmount === null ? null : round2(repairJob.finalAmount),
        ...money,
      },
    };
  }
}
