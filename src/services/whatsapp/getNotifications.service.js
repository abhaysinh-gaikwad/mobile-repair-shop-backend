import db from '@src/db/models';
import { AppError } from '@src/errors/app.error';
import { Errors } from '@src/errors/errorCodes';
import { getSuccessResponse } from '@src/helpers/response.helpers';
import { BaseHandler } from '@src/libs/logicBase';

/** WhatsApp send history for one repair — newest first, so the latest attempt leads. */
export default class GetWhatsAppNotificationsService extends BaseHandler {
  async run() {
    const { repairJobId } = this.args;

    const repairJob = await db.RepairJob.findByPk(repairJobId);
    if (!repairJob) throw new AppError(Errors.REPAIR_NOT_FOUND);

    const notifications = await db.WhatsappNotification.findAll({
      where: { repairJobId },
      include: [{ model: db.AdminUser, as: 'sender', attributes: ['id', 'name'] }],
      order: [['createdAt', 'DESC']],
    });

    return { ...getSuccessResponse('WhatsApp notifications fetched successfully.'), notifications };
  }
}
