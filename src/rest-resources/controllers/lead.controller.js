import { sendResponse } from '@src/helpers/response.helpers';
import {
  CreateLeadHandlerService,
  CreateLeadSourceService,
  GetLeadHandlersService,
  GetLeadSourcesService,
  ToggleLeadEntityService,
  UpdateLeadHandlerService,
  UpdateLeadSourceService,
} from '@src/services/leads/manageLeads.service';

export default class LeadController {
  // ---- handlers ----
  static async getLeadHandlers(req, res, next) {
    try {
      sendResponse({ req, res, next }, await GetLeadHandlersService.execute({ ...req.query }, req.context));
    } catch (error) {
      next(error);
    }
  }

  static async createLeadHandler(req, res, next) {
    try {
      sendResponse({ req, res, next }, await CreateLeadHandlerService.execute({ ...req.body }, req.context));
    } catch (error) {
      next(error);
    }
  }

  static async updateLeadHandler(req, res, next) {
    try {
      const data = await UpdateLeadHandlerService.execute({ id: Number(req.params.id), ...req.body }, req.context);
      sendResponse({ req, res, next }, data);
    } catch (error) {
      next(error);
    }
  }

  static async toggleLeadHandler(req, res, next) {
    try {
      const data = await ToggleLeadEntityService.execute(
        { id: Number(req.params.id), entity: 'handler', ...req.body },
        req.context,
      );
      sendResponse({ req, res, next }, data);
    } catch (error) {
      next(error);
    }
  }

  // ---- sources ----
  static async getLeadSources(req, res, next) {
    try {
      sendResponse({ req, res, next }, await GetLeadSourcesService.execute({ ...req.query }, req.context));
    } catch (error) {
      next(error);
    }
  }

  static async createLeadSource(req, res, next) {
    try {
      sendResponse({ req, res, next }, await CreateLeadSourceService.execute({ ...req.body }, req.context));
    } catch (error) {
      next(error);
    }
  }

  static async updateLeadSource(req, res, next) {
    try {
      const data = await UpdateLeadSourceService.execute({ id: Number(req.params.id), ...req.body }, req.context);
      sendResponse({ req, res, next }, data);
    } catch (error) {
      next(error);
    }
  }

  static async toggleLeadSource(req, res, next) {
    try {
      const data = await ToggleLeadEntityService.execute(
        { id: Number(req.params.id), entity: 'source', ...req.body },
        req.context,
      );
      sendResponse({ req, res, next }, data);
    } catch (error) {
      next(error);
    }
  }
}
