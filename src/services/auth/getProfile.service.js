import db from '@src/db/models';
import { AppError } from '@src/errors/app.error';
import { Errors } from '@src/errors/errorCodes';
import { resolvePermissions } from '@src/helpers/permission.helpers';
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
      // Permissions are resolved fresh on every profile fetch, so a change
      // the Super Admin makes takes effect as soon as the app reloads rather
      // than when the 7-day token finally expires.
      user: { ...adminUser.get({ plain: true }), permissions: resolvePermissions(adminUser) },
    };
  }
}
