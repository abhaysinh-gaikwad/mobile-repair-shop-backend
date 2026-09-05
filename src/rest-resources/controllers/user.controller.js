import { sendResponse } from '@src/helpers/response.helpers';
import {
  CreateUserService,
  GetPermissionCatalogueService,
  GetUsersService,
  ToggleUserService,
  UpdateUserService,
} from '@src/services/users/manageUsers.service';

export default class UserController {
  static async getUsers(req, res, next) {
    try {
      sendResponse({ req, res, next }, await GetUsersService.execute({ ...req.query }, req.context));
    } catch (error) {
      next(error);
    }
  }

  static async createUser(req, res, next) {
    try {
      sendResponse({ req, res, next }, await CreateUserService.execute({ ...req.body }, req.context));
    } catch (error) {
      next(error);
    }
  }

  static async updateUser(req, res, next) {
    try {
      const data = await UpdateUserService.execute(
        { id: Number(req.params.id), ...req.body, adminId: req.user.id },
        req.context,
      );
      sendResponse({ req, res, next }, data);
    } catch (error) {
      next(error);
    }
  }

  static async toggleUser(req, res, next) {
    try {
      const data = await ToggleUserService.execute(
        { id: Number(req.params.id), ...req.body, adminId: req.user.id },
        req.context,
      );
      sendResponse({ req, res, next }, data);
    } catch (error) {
      next(error);
    }
  }

  /** The tick-box grid the User Management screen renders. */
  static async getPermissionCatalogue(req, res, next) {
    try {
      sendResponse({ req, res, next }, await GetPermissionCatalogueService.execute({}, req.context));
    } catch (error) {
      next(error);
    }
  }
}
