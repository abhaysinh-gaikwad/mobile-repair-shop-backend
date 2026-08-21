import db from '@src/db/models';
import { AppError } from '@src/errors/app.error';
import { Errors } from '@src/errors/errorCodes';
import { getSuccessResponse } from '@src/helpers/response.helpers';
import { BaseHandler } from '@src/libs/logicBase';
import { decryptSecret } from '@src/utils/crypto.utils';

/**
 * The ONLY path that decrypts a device unlock credential.
 *
 * It is a separate, explicitly-called endpoint rather than a field on the
 * repair payload so the credential is never carried along by list responses,
 * history views, reports, or the printed receipt. The staff member has to ask
 * for it deliberately, for the one legitimate purpose: unlocking the handset
 * to test it after repair.
 *
 * The reveal is written into the repair's status history, so there is a
 * permanent record of who looked at a customer's PIN and when.
 */
export default class RevealDeviceUnlockService extends BaseHandler {
  async run() {
    const { id, adminId } = this.args;
    const transaction = this.dbTransaction;

    // `unscoped` is required: the default scope deliberately hides the column.
    const repairJob = await db.RepairJob.unscoped().findByPk(id, {
      attributes: ['id', 'receiptNumber', 'deviceUnlockType', 'deviceUnlockSecret'],
      transaction,
    });
    if (!repairJob) throw new AppError(Errors.REPAIR_NOT_FOUND);

    if (!repairJob.deviceUnlockSecret) {
      return {
        ...getSuccessResponse('No device unlock credential was recorded for this repair.'),
        deviceUnlockType: repairJob.deviceUnlockType,
        credential: null,
      };
    }

    const credential = decryptSecret(repairJob.deviceUnlockSecret);
    if (credential === null) throw new AppError(Errors.DEVICE_UNLOCK_UNREADABLE);

    await db.DeviceUnlockAccessLog.create(
      { repairJobId: repairJob.id, adminUserId: adminId ?? null, ipAddress: this.args.ipAddress ?? null },
      { transaction },
    );

    return {
      ...getSuccessResponse('Device unlock credential revealed.'),
      deviceUnlockType: repairJob.deviceUnlockType,
      credential,
    };
  }
}
