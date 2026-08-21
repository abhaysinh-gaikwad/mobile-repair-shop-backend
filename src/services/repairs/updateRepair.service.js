import db from '@src/db/models';
import { AppError } from '@src/errors/app.error';
import { Errors } from '@src/errors/errorCodes';
import { recalculateRepairTotal } from '@src/helpers/repair.helpers';
import { getSuccessResponse } from '@src/helpers/response.helpers';
import { BaseHandler } from '@src/libs/logicBase';

/**
 * Edit the device / lead / accessory details of an existing job.
 *
 * `customerComplaint` is deliberately NOT editable here — it is what the
 * customer said at intake and is printed on their receipt. The AJV schema
 * rejects it too; this check is the second line of defence.
 */
export default class UpdateRepairService extends BaseHandler {
  async run() {
    // `adminId` is stripped out deliberately — it identifies the acting user
    // and must never be written onto the repair job as a column update.
    // eslint-disable-next-line no-unused-vars
    const { id, adminId, ...updates } = this.args;
    const transaction = this.dbTransaction;

    if ('customerComplaint' in updates) throw new AppError(Errors.REPAIR_COMPLAINT_IMMUTABLE);

    const repairJob = await db.RepairJob.findByPk(id, { transaction });
    if (!repairJob) throw new AppError(Errors.REPAIR_NOT_FOUND);

    if (updates.leadHandlerId) {
      const leadHandler = await db.LeadHandler.findByPk(updates.leadHandlerId, { transaction });
      if (!leadHandler) throw new AppError(Errors.LEAD_HANDLER_NOT_FOUND);
    }

    await repairJob.update(updates, { transaction });

    // The labour charge feeds the job total, so changing it must recompute.
    if ('labourCharge' in updates) await recalculateRepairTotal(repairJob.id, transaction);

    return {
      ...getSuccessResponse('Repair job updated successfully.'),
      repairJob: await db.RepairJob.findByPk(id, { transaction }),
    };
  }
}
