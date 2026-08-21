import db from '@src/db/models';
import { AppError } from '@src/errors/app.error';
import { Errors } from '@src/errors/errorCodes';
import { comparePassword, hashPassword } from '@src/helpers/authentication.helpers';
import { getSuccessResponse } from '@src/helpers/response.helpers';
import { BaseHandler } from '@src/libs/logicBase';

export default class ChangePasswordService extends BaseHandler {
  async run() {
    const { adminId, currentPassword, newPassword } = this.args;

    const adminUser = await db.AdminUser.scope('withPassword').findByPk(adminId);
    if (!adminUser) throw new AppError(Errors.INVALID_TOKEN);

    if (!(await comparePassword(currentPassword, adminUser.password))) {
      throw new AppError(Errors.CURRENT_PASSWORD_INCORRECT);
    }

    await adminUser.update({ password: await hashPassword(newPassword) }, { transaction: this.dbTransaction });

    return getSuccessResponse('Password changed successfully.');
  }
}
