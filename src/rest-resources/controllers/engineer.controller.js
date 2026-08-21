import { sendResponse } from '@src/helpers/response.helpers';
import {
  CreateEngineerService,
  GetEngineersService,
  ToggleEngineerStatusService,
  UpdateEngineerService,
} from '@src/services/engineers/manageEngineers.service';

export default class EngineerController {
  static async getEngineers(req, res, next) {
    try {
      const data = await GetEngineersService.execute({ ...req.query }, req.context);
      sendResponse({ req, res, next }, data);
    } catch (error) {
      next(error);
    }
  }

  static async createEngineer(req, res, next) {
    try {
      const data = await CreateEngineerService.execute({ ...req.body }, req.context);
      sendResponse({ req, res, next }, data);
    } catch (error) {
      next(error);
    }
  }

  static async updateEngineer(req, res, next) {
    try {
      const data = await UpdateEngineerService.execute({ id: Number(req.params.id), ...req.body }, req.context);
      sendResponse({ req, res, next }, data);
    } catch (error) {
      next(error);
    }
  }

  static async toggleStatus(req, res, next) {
    try {
      const data = await ToggleEngineerStatusService.execute({ id: Number(req.params.id), ...req.body }, req.context);
      sendResponse({ req, res, next }, data);
    } catch (error) {
      next(error);
    }
  }
}
