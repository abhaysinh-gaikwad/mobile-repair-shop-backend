import { AppError } from '@src/errors/app.error';
import { Errors } from '@src/errors/errorCodes';
import { ADMIN_ROLE } from '@src/utils/constants/public.constants';

/**
 * Gates the few actions restricted to the shop owner — currently only Rate
 * Card management (add/edit/delete brands, models, parts, rate types,
 * rates). Everything else in the app stays open to any logged-in admin,
 * unchanged; this is one door with a lock on it, not a general permissions
 * system.
 *
 * Must run AFTER isAuthenticated(), which puts the decoded token (role
 * included) on `req.user`.
 */
export function requireOwner() {
  return (req, res, next) => {
    if (req.user?.role !== ADMIN_ROLE.OWNER) return next(new AppError(Errors.FORBIDDEN));
    return next();
  };
}

export default requireOwner;
