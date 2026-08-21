import db from '@src/db/models';
import { AppError } from '@src/errors/app.error';
import { Errors } from '@src/errors/errorCodes';
import { getSuccessResponse } from '@src/helpers/response.helpers';
import { BaseHandler } from '@src/libs/logicBase';
import { DEVICE_UNLOCK_TYPE } from '@src/utils/constants/public.constants';
import { encryptSecret } from '@src/utils/crypto.utils';

/**
 * Set, replace or clear the device screen-lock credential after intake.
 *
 * Selecting NONE clears both the type and the stored secret, which is how the
 * shop removes a credential once the phone has been handed back.
 */
export default class UpdateDeviceUnlockService extends BaseHandler {
  async run() {
    const { id, deviceUnlockType, deviceUnlockCredential } = this.args;
    const transaction = this.dbTransaction;

    const repairJob = await db.RepairJob.findByPk(id, { transaction });
    if (!repairJob) throw new AppError(Errors.REPAIR_NOT_FOUND);

    const clearing = !deviceUnlockType || deviceUnlockType === DEVICE_UNLOCK_TYPE.NONE;

    await repairJob.update(
      {
        deviceUnlockType: clearing ? null : deviceUnlockType,
        // Only overwrite the stored secret when a new one was actually typed;
        // re-saving the type alone must not wipe an existing credential.
        ...(clearing
          ? { deviceUnlockSecret: null }
          : deviceUnlockCredential
            ? { deviceUnlockSecret: encryptSecret(deviceUnlockCredential) }
            : {}),
      },
      { transaction },
    );

    return {
      ...getSuccessResponse(clearing ? 'Device unlock credential removed.' : 'Device unlock credential saved.'),
      deviceUnlockType: repairJob.deviceUnlockType,
      hasDeviceUnlock: Boolean(repairJob.deviceUnlockSecret),
    };
  }
}
