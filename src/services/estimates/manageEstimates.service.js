import db from '@src/db/models';
import { AppError } from '@src/errors/app.error';
import { Errors } from '@src/errors/errorCodes';
import { getSuccessResponse } from '@src/helpers/response.helpers';
import { BaseHandler } from '@src/libs/logicBase';
import { round2 } from '@src/utils/money.utils';

/**
 * The history of quotes given to a customer for a repair.
 *
 * APPEND-ONLY: there is deliberately no update and no delete service here,
 * and no route exposes one — a revised quote is a NEW row, never an edit to
 * the old one, so "what did we actually tell the customer" stays reliable.
 *
 * `repair_jobs.estimated_cost` is kept in sync with the latest entry so every
 * existing reader (receipt, WhatsApp message, list views) keeps working
 * unchanged; this table is the full record behind that single number.
 */
export class AddEstimateService extends BaseHandler {
  async run() {
    const { repairJobId, amount, note, adminId } = this.args;
    const transaction = this.dbTransaction;

    const repairJob = await db.RepairJob.findByPk(repairJobId, { transaction });
    if (!repairJob) throw new AppError(Errors.REPAIR_NOT_FOUND);

    const estimate = await db.RepairEstimate.create(
      {
        repairJobId,
        amount: round2(amount),
        note: note ?? null,
        createdBy: adminId ?? null,
      },
      { transaction },
    );

    await repairJob.update({ estimatedCost: estimate.amount }, { transaction });

    return { ...getSuccessResponse('Estimate added successfully.'), estimate };
  }
}

export class GetEstimatesService extends BaseHandler {
  async run() {
    const { repairJobId } = this.args;

    const repairJob = await db.RepairJob.findByPk(repairJobId);
    if (!repairJob) throw new AppError(Errors.REPAIR_NOT_FOUND);

    const estimates = await db.RepairEstimate.findAll({
      where: { repairJobId },
      include: [{ model: db.AdminUser, as: 'creator', attributes: ['id', 'name'] }],
      // Newest first — the shop wants the latest quote at the top.
      order: [['createdAt', 'DESC']],
    });

    return { ...getSuccessResponse('Estimates fetched successfully.'), estimates };
  }
}
