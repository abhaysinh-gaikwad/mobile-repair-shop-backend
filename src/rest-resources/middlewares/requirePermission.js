import db from '@src/db/models';
import { AppError } from '@src/errors/app.error';
import { Errors } from '@src/errors/errorCodes';
import { hasPermission } from '@src/helpers/permission.helpers';

/**
 * Gates a route on one permission, e.g. requirePermission('RATE_CARD:EDIT').
 *
 * Must run AFTER isAuthenticated(). It re-reads the user FROM THE DATABASE
 * rather than trusting the role baked into the JWT: tokens last 7 days, so a
 * Super Admin who deactivates an account or removes a permission would
 * otherwise be ignored for up to a week. The DB is the source of truth for
 * authorization; the token only proves identity.
 *
 * The resolved user is cached on `req.adminUser` for the rest of the request
 * so stacking two of these on one route costs a single query.
 */
export function requirePermission(required) {
  return async (req, _res, next) => {
    try {
      const adminUser =
        req.adminUser ?? (req.user?.id ? await db.AdminUser.findByPk(req.user.id) : null);

      if (!adminUser) return next(new AppError(Errors.UN_AUTHORIZE));

      // A deactivated account keeps a technically valid token until it
      // expires — this is where it actually stops working.
      if (!adminUser.isActive) return next(new AppError(Errors.ACCOUNT_DEACTIVATED));

      req.adminUser = adminUser;

      if (!hasPermission(adminUser, required)) return next(new AppError(Errors.FORBIDDEN));

      return next();
    } catch (error) {
      return next(error);
    }
  };
}

export default requirePermission;
