import { sendResponse } from '@src/helpers/response.helpers';
import {
  CreateNewCrmLeadService,
  GetNewCrmLeadsService,
  UpdateNewCrmLeadFollowUpService,
  UpdateNewCrmLeadService,
  UpdateNewCrmLeadStatusService,
} from '@src/services/newCrm/manageNewCrmLeads.service';

export default class NewCrmController {
  static async createLead(req, res, next) {
    try {
      const data = await CreateNewCrmLeadService.execute({ ...req.body, adminId: req.user.id }, req.context);
      sendResponse({ req, res, next }, data);
    } catch (error) {
      next(error);
    }
  }

  static async getLeads(req, res, next) {
    try {
      const data = await GetNewCrmLeadsService.execute({ ...req.query }, req.context);
      sendResponse({ req, res, next }, data);
    } catch (error) {
      next(error);
    }
  }

  static async updateLead(req, res, next) {
    try {
      const data = await UpdateNewCrmLeadService.execute({ id: Number(req.params.id), ...req.body }, req.context);
      sendResponse({ req, res, next }, data);
    } catch (error) {
      next(error);
    }
  }

  static async updateStatus(req, res, next) {
    try {
      const data = await UpdateNewCrmLeadStatusService.execute(
        { id: Number(req.params.id), ...req.body },
        req.context,
      );
      sendResponse({ req, res, next }, data);
    } catch (error) {
      next(error);
    }
  }

  static async updateFollowUp(req, res, next) {
    try {
      const data = await UpdateNewCrmLeadFollowUpService.execute(
        { id: Number(req.params.id), ...req.body },
        req.context,
      );
      sendResponse({ req, res, next }, data);
    } catch (error) {
      next(error);
    }
  }
}
