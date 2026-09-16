import { Op } from 'sequelize';

import db from '@src/db/models';
import { AppError } from '@src/errors/app.error';
import { Errors } from '@src/errors/errorCodes';
import { getSuccessResponse } from '@src/helpers/response.helpers';
import { BaseHandler } from '@src/libs/logicBase';
import { round2, subtractAmounts } from '@src/utils/money.utils';

/**
 * Every repair ever done on the SAME physical phone.
 *
 * Identity is the IMEI when one was recorded — that is what actually
 * identifies a handset. When the IMEI is missing (the shop cannot always read
 * it on a dead phone), fall back to the same customer plus the same
 * brand+model, which is the best available approximation.
 *
 * This is a read-only view. Repeat repairs are separate jobs with their own
 * receipt numbers; nothing here reopens or merges them.
 */
export default class GetDeviceHistoryService extends BaseHandler {
  async run() {
    const { id } = this.args;

    const repairJob = await db.RepairJob.findByPk(id, {
      include: [{ model: db.Customer, as: 'customer', attributes: ['id', 'name', 'mobile'] }],
    });
    if (!repairJob) throw new AppError(Errors.REPAIR_NOT_FOUND);

    const imei = repairJob.imei?.trim();

    const where = imei
      ? { imei }
      : {
          customerId: repairJob.customerId,
          brand: repairJob.brand,
          modelNumber: repairJob.modelNumber,
        };

    const jobs = await db.RepairJob.findAll({
      where,
      include: [{ model: db.Engineer, as: 'engineer', attributes: ['id', 'name'] }],
      order: [['receivedAt', 'DESC']],
    });

    // Paid-to-date for all of them in one grouped query.
    const jobIds = jobs.map((job) => job.id);
    const paidRows = jobIds.length
      ? await db.RepairLedger.findAll({
          attributes: ['repairJobId', [db.sequelize.fn('SUM', db.sequelize.col('amount')), 'paid']],
          where: { repairJobId: { [Op.in]: jobIds } },
          group: ['repair_job_id'],
          raw: true,
        })
      : [];
    const paidByJob = new Map(paidRows.map((row) => [Number(row.repairJobId), round2(row.paid)]));

    const history = jobs.map((job) => {
      const plain = job.toJSON();
      const totalAmount = round2(plain.totalAmount);
      const totalPaid = paidByJob.get(plain.id) ?? 0;
      return {
        id: plain.id,
        receiptNumber: plain.receiptNumber,
        customerComplaint: plain.customerComplaint,
        diagnosis: plain.diagnosis,
        repairDetails: plain.repairDetails,
        status: plain.status,
        engineer: plain.engineer,
        receivedAt: plain.receivedAt,
        deliveredAt: plain.deliveredAt,
        repeatOfReceipt: plain.repeatOfReceipt,
        isCurrent: plain.id === repairJob.id,
        totalAmount,
        totalPaid,
        balance: subtractAmounts(totalAmount, totalPaid),
      };
    });

    return {
      ...getSuccessResponse('Device history fetched successfully.'),
      device: {
        brand: repairJob.brand,
        modelNumber: repairJob.modelNumber,
        imei: imei ?? null,
        // Tells the UI how confident the match is.
        matchedBy: imei ? 'IMEI' : 'CUSTOMER_AND_MODEL',
        customer: repairJob.customer,
      },
      repairJobs: history,
      summary: {
        totalRepairs: history.length,
        totalValue: round2(history.reduce((sum, job) => sum + job.totalAmount, 0)),
        totalPaid: round2(history.reduce((sum, job) => sum + job.totalPaid, 0)),
        totalOutstanding: round2(history.reduce((sum, job) => sum + Math.max(job.balance, 0), 0)),
      },
    };
  }
}
