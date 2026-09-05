import { sendResponse } from '@src/helpers/response.helpers';
import {
  CreateLeadService,
  GetLeadDistributionService,
  GetLeadService,
  GetLeadsService,
  ReassignLeadService,
  UpdateLeadService,
} from '@src/services/crm/manageLeads.service';

/**
 * `req.adminUser` is the FULL database row, put there by requirePermission().
 * The CRM services need it (not the JWT payload) because a telecaller's view
 * is scoped by their live role and permissions, which may have changed since
 * the token was issued.
 */
export default class CrmController {
  static async createLead(req, res, next) {
    try {
      const data = await CreateLeadService.execute({ ...req.body, adminId: req.user.id }, req.context);
      sendResponse({ req, res, next }, data);
    } catch (error) {
      next(error);
    }
  }

  static async getLeads(req, res, next) {
    try {
      const data = await GetLeadsService.execute({ ...req.query, adminUser: req.adminUser }, req.context);
      sendResponse({ req, res, next }, data);
    } catch (error) {
      next(error);
    }
  }

  static async getLead(req, res, next) {
    try {
      const data = await GetLeadService.execute(
        { id: Number(req.params.id), adminUser: req.adminUser },
        req.context,
      );
      sendResponse({ req, res, next }, data);
    } catch (error) {
      next(error);
    }
  }

  static async updateLead(req, res, next) {
    try {
      const data = await UpdateLeadService.execute(
        { id: Number(req.params.id), ...req.body, adminUser: req.adminUser },
        req.context,
      );
      sendResponse({ req, res, next }, data);
    } catch (error) {
      next(error);
    }
  }

  static async reassignLead(req, res, next) {
    try {
      const data = await ReassignLeadService.execute(
        { id: Number(req.params.id), ...req.body, adminId: req.user.id },
        req.context,
      );
      sendResponse({ req, res, next }, data);
    } catch (error) {
      next(error);
    }
  }

  static async getDistribution(req, res, next) {
    try {
      sendResponse({ req, res, next }, await GetLeadDistributionService.execute({}, req.context));
    } catch (error) {
      next(error);
    }
  }
}
