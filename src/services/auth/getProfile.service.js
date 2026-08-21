import db from '@src/db/models';
import { AppError } from '@src/errors/app.error';
import { Errors } from '@src/errors/errorCodes';
import { getSuccessResponse } from '@src/helpers/response.helpers';
import { BaseHandler } from '@src/libs/logicBase';

export default class GetProfileService extends BaseHandler {
  async run() {
    const { adminId } = this.args;

    const adminUser = await db.AdminUser.findByPk(adminId);
    if (!adminUser) throw new AppError(Errors.INVALID_TOKEN);
    if (!adminUser.isActive) throw new AppError(Errors.ACCOUNT_INACTIVE);

    return {
      ...getSuccessResponse('Profile fetched successfully.'),
      user: adminUser,
    };
  }
}
