import db from '@src/db/models';
import { AppError } from '@src/errors/app.error';
import { Errors } from '@src/errors/errorCodes';
import { getRepairMoneySummary, recordStatusChange } from '@src/helpers/repair.helpers';
import { getSuccessResponse } from '@src/helpers/response.helpers';
import { BaseHandler } from '@src/libs/logicBase';
import { REPAIR_STATUS } from '@src/utils/constants/public.constants';

/**
 * Move a job to a new status.
 *
 * Transitions are intentionally unrestricted: a real shop backtracks
 * constantly (a phone declared ready turns out not to be), and blocking that
 * would make the software harder to use than the notebook it replaces.
 *
 * Two rules are enforced:
 *   1. every change writes a history row in the same transaction
 *   2. DELIVERED stamps delivered_at, and reports any outstanding balance so
 *      the UI can warn — a warning, not a block, because shops do release
 *      phones on trust.
 */
export default class UpdateRepairStatusService extends BaseHandler {
  async run() {
    const { id, status, note, adminId } = this.args;
    const transaction = this.dbTransaction;

    if (!Object.values(REPAIR_STATUS).includes(status)) {
      throw new AppError(Errors.INVALID_REPAIR_STATUS(status));
    }

    const repairJob = await db.RepairJob.findByPk(id, { transaction });
    if (!repairJob) throw new AppError(Errors.REPAIR_NOT_FOUND);

    const fromStatus = repairJob.status;

    const patch = { status };
    if (status === REPAIR_STATUS.DELIVERED && !repairJob.deliveredAt) patch.deliveredAt = new Date();
    // Re-opening a delivered job clears the delivery stamp.
    if (status !== REPAIR_STATUS.DELIVERED && repairJob.deliveredAt) patch.deliveredAt = null;

    await repairJob.update(patch, { transaction });

    await recordStatusChange(
      { repairJobId: repairJob.id, fromStatus, toStatus: status, note, changedBy: adminId },
      transaction,
    );

    const money = await getRepairMoneySummary(repairJob.id, transaction);

    return {
      ...getSuccessResponse(`Status updated to ${status}.`),
      repairJob: { id: repairJob.id, receiptNumber: repairJob.receiptNumber, status, ...money },
      // Surfaced so the UI can show "balance still outstanding" on delivery.
      hasOutstandingBalance: money.balance > 0,
      // So the controller can fire a "job's ready" WhatsApp message only on
      // the actual transition INTO JOB_DONE, not every edit while already
      // in that status.
      fromStatus,
    };
  }
}
