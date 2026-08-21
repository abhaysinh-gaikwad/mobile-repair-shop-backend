import { sendResponse } from '@src/helpers/response.helpers';
import GetDashboardSummaryService from '@src/services/reports/dashboard.service';
import {
  GetCollectionReportService,
  GetDeliveryReportService,
  GetEngineerReportService,
  GetExpenseReportService,
  GetLeadHandlerReportService,
  GetLeadSourceReportService,
  GetRepairSummaryReportService,
} from '@src/services/reports/reports.service';

const respondWith = (Service) => async (req, res, next) => {
  try {
    const data = await Service.execute({ ...req.query }, req.context);
    sendResponse({ req, res, next }, data);
  } catch (error) {
    next(error);
  }
};

export default class ReportController {
  static dashboard = respondWith(GetDashboardSummaryService);
  static repairSummary = respondWith(GetRepairSummaryReportService);
  static delivery = respondWith(GetDeliveryReportService);
  static engineers = respondWith(GetEngineerReportService);
  static leadSources = respondWith(GetLeadSourceReportService);
  static leadHandlers = respondWith(GetLeadHandlerReportService);
  static collection = respondWith(GetCollectionReportService);
  static expenses = respondWith(GetExpenseReportService);
}
