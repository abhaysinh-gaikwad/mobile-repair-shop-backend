import { AppError } from '@src/errors/app.error';
import { Errors } from '@src/errors/errorCodes';
import { decodeJwtToken } from '@src/helpers/authentication.helpers';
import { TOKEN_TYPE } from '@src/utils/constants/public.constants';

/**
 * Verifies the bearer token and puts the decoded payload on `req.user`.
 *
 * v1 has a single owner login, so there is deliberately no role/permission
 * check here. When roles are added later, a sibling `checkPermission()`
 * middleware slots in immediately after this one without touching any
 * controller or service.
 */
export function isAuthenticated() {
  return async (req, res, next) => {
    try {
      const accessToken = req.headers.authorization?.split('Bearer ')[1];
      if (!accessToken) return next(new AppError(Errors.UN_AUTHORIZE));

      const decodedToken = decodeJwtToken(accessToken);
      if (!decodedToken || decodedToken.tokenType !== TOKEN_TYPE.LOGIN) {
        return next(new AppError(Errors.INVALID_TOKEN));
      }

      req.user = decodedToken;
      if (req.context) req.context.adminId = decodedToken.id;

      return next();
    } catch {
      return next(new AppError(Errors.UN_AUTHORIZE));
    }
  };
}

export default isAuthenticated;
