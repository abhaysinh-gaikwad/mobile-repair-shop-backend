import db from '@src/db/models';
import { AppError } from '@src/errors/app.error';
import { Errors } from '@src/errors/errorCodes';
import { getSuccessResponse } from '@src/helpers/response.helpers';
import { BaseHandler } from '@src/libs/logicBase';

/**
 * Customer calling history.
 *
 * APPEND-ONLY: there is deliberately no update and no delete service here,
 * and no route exposes one. What was told to the customer, and when, is a
 * record the shop may need to rely on later.
 */

export class AddCallLogService extends BaseHandler {
  async run() {
    const { repairJobId, calledBy, communication, nextAction, calledAt, adminId } = this.args;
    const transaction = this.dbTransaction;

    const repairJob = await db.RepairJob.findByPk(repairJobId, { transaction });
    if (!repairJob) throw new AppError(Errors.REPAIR_NOT_FOUND);

    const callLog = await db.RepairCallLog.create(
      {
        repairJobId,
        calledBy: String(calledBy).trim(),
        communication: String(communication).trim(),
        nextAction: nextAction ?? null,
        calledAt: calledAt ? new Date(calledAt) : new Date(),
        createdBy: adminId ?? null,
      },
      { transaction },
    );

    return { ...getSuccessResponse('Call log added successfully.'), callLog };
  }
}

export class GetCallLogsService extends BaseHandler {
  async run() {
    const { repairJobId } = this.args;

    const repairJob = await db.RepairJob.findByPk(repairJobId);
    if (!repairJob) throw new AppError(Errors.REPAIR_NOT_FOUND);

    const callLogs = await db.RepairCallLog.findAll({
      where: { repairJobId },
      include: [{ model: db.AdminUser, as: 'creator', attributes: ['id', 'name'] }],
      // Newest first — the shop wants the latest conversation at the top.
      order: [['calledAt', 'DESC']],
    });

    return { ...getSuccessResponse('Call logs fetched successfully.'), callLogs };
  }
}
