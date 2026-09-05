import db from '@src/db/models';
import { AppError } from '@src/errors/app.error';
import { Errors } from '@src/errors/errorCodes';
import { comparePassword, generateLoginToken } from '@src/helpers/authentication.helpers';
import { resolvePermissions } from '@src/helpers/permission.helpers';
import { getSuccessResponse } from '@src/helpers/response.helpers';
import { BaseHandler } from '@src/libs/logicBase';

export default class LoginService extends BaseHandler {
  async run() {
    const { email, password } = this.args;

    const adminUser = await db.AdminUser.scope('withPassword').findOne({
      where: { email: email.trim().toLowerCase() },
    });

    // Same error whether the email is unknown or the password is wrong —
    // distinguishing them would let an attacker enumerate valid accounts.
    if (!adminUser || !(await comparePassword(password, adminUser.password))) {
      throw new AppError(Errors.INVALID_CREDENTIALS);
    }

    if (!adminUser.isActive) throw new AppError(Errors.ACCOUNT_INACTIVE);

    await adminUser.update({ lastLoginAt: new Date() }, { transaction: this.dbTransaction });

    return {
      ...getSuccessResponse('Logged in successfully.'),
      accessToken: generateLoginToken(adminUser),
      user: {
        id: adminUser.id,
        name: adminUser.name,
        email: adminUser.email,
        role: adminUser.role,
        // Sent so the UI can hide what this person cannot do. It is a
        // CONVENIENCE, never the security boundary — every route re-checks
        // server-side against the live database row.
        permissions: resolvePermissions(adminUser),
      },
    };
  }
}
