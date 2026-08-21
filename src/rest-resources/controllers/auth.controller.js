import { sendResponse } from '@src/helpers/response.helpers';
import ChangePasswordService from '@src/services/auth/changePassword.service';
import GetProfileService from '@src/services/auth/getProfile.service';
import LoginService from '@src/services/auth/login.service';

export default class AuthController {
  static async login(req, res, next) {
    try {
      const data = await LoginService.execute({ ...req.body }, req.context);
      sendResponse({ req, res, next }, data);
    } catch (error) {
      next(error);
    }
  }

  static async me(req, res, next) {
    try {
      const data = await GetProfileService.execute({ adminId: req.user.id }, req.context);
      sendResponse({ req, res, next }, data);
    } catch (error) {
      next(error);
    }
  }

  static async changePassword(req, res, next) {
    try {
      const data = await ChangePasswordService.execute({ adminId: req.user.id, ...req.body }, req.context);
      sendResponse({ req, res, next }, data);
    } catch (error) {
      next(error);
    }
  }
}
