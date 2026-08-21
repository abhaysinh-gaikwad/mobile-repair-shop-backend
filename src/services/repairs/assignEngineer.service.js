import db from '@src/db/models';
import { AppError } from '@src/errors/app.error';
import { Errors } from '@src/errors/errorCodes';
import { recordStatusChange } from '@src/helpers/repair.helpers';
import { getSuccessResponse } from '@src/helpers/response.helpers';
import { BaseHandler } from '@src/libs/logicBase';

/**
 * Assign or reassign the engineer working on a job.
 *
 * A reassignment is written into the status history (as a same-status entry)
 * so accountability for who held the phone survives.
 */
export default class AssignEngineerService extends BaseHandler {
  async run() {
    const { id, engineerId, note, adminId } = this.args;
    const transaction = this.dbTransaction;

    const repairJob = await db.RepairJob.findByPk(id, { transaction });
    if (!repairJob) throw new AppError(Errors.REPAIR_NOT_FOUND);

    const engineer = await db.Engineer.findByPk(engineerId, { transaction });
    if (!engineer) throw new AppError(Errors.ENGINEER_NOT_FOUND);
    if (!engineer.isActive) throw new AppError(Errors.ENGINEER_INACTIVE);

    const previousEngineerId = repairJob.engineerId;
    const previousEngineer = previousEngineerId
      ? await db.Engineer.findByPk(previousEngineerId, { transaction })
      : null;

    // No status transition here — there is no separate "assigned" status.
    // Who is working the job lives in engineer_id; the repair's own status
    // still moves through the pipeline independently via UpdateRepairStatusService.
    await repairJob.update({ engineerId }, { transaction });

    const historyNote =
      note ??
      (previousEngineer
        ? `Reassigned from ${previousEngineer.name} to ${engineer.name}`
        : `Assigned to ${engineer.name}`);

    await recordStatusChange(
      {
        repairJobId: repairJob.id,
        fromStatus: repairJob.status,
        toStatus: repairJob.status,
        note: historyNote,
        changedBy: adminId,
      },
      transaction,
    );

    return {
      ...getSuccessResponse(historyNote + '.'),
      repairJob: {
        id: repairJob.id,
        receiptNumber: repairJob.receiptNumber,
        status: repairJob.status,
        engineer: { id: engineer.id, name: engineer.name },
      },
    };
  }
}
