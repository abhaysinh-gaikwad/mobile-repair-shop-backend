import { sendResponse } from '@src/helpers/response.helpers';
import { AddCallLogService, GetCallLogsService } from '@src/services/callLogs/manageCallLogs.service';
import { AddPartService, DeletePartService, UpdatePartService } from '@src/services/parts/manageParts.service';
import AddPaymentService from '@src/services/payments/addPayment.service';
import GetPaymentsService from '@src/services/payments/getPayments.service';
import ReversePaymentService from '@src/services/payments/reversePayment.service';

/**
 * Sub-resources of a repair job: parts, payments (ledger) and call logs.
 *
 * Note what is absent: no updatePayment, no deletePayment, no updateCallLog,
 * no deleteCallLog. Those omissions are the append-only guarantee.
 */
export default class RepairSubResourceController {
  // ---------------------------------------------------------------- parts
  static async addPart(req, res, next) {
    try {
      const data = await AddPartService.execute(
        { repairJobId: Number(req.params.id), ...req.body },
        req.context,
      );
      sendResponse({ req, res, next }, data);
    } catch (error) {
      next(error);
    }
  }

  static async updatePart(req, res, next) {
    try {
      const data = await UpdatePartService.execute(
        { repairJobId: Number(req.params.id), partId: Number(req.params.partId), ...req.body },
        req.context,
      );
      sendResponse({ req, res, next }, data);
    } catch (error) {
      next(error);
    }
  }

  static async deletePart(req, res, next) {
    try {
      const data = await DeletePartService.execute(
        { repairJobId: Number(req.params.id), partId: Number(req.params.partId) },
        req.context,
      );
      sendResponse({ req, res, next }, data);
    } catch (error) {
      next(error);
    }
  }

  // ------------------------------------------------------------- payments
  static async addPayment(req, res, next) {
    try {
      const data = await AddPaymentService.execute(
        { repairJobId: Number(req.params.id), ...req.body, adminId: req.user.id },
        req.context,
      );
      sendResponse({ req, res, next }, data);
    } catch (error) {
      next(error);
    }
  }

  static async getPayments(req, res, next) {
    try {
      const data = await GetPaymentsService.execute({ repairJobId: Number(req.params.id) }, req.context);
      sendResponse({ req, res, next }, data);
    } catch (error) {
      next(error);
    }
  }

  static async reversePayment(req, res, next) {
    try {
      const data = await ReversePaymentService.execute(
        {
          repairJobId: Number(req.params.id),
          entryId: Number(req.params.entryId),
          ...req.body,
          adminId: req.user.id,
        },
        req.context,
      );
      sendResponse({ req, res, next }, data);
    } catch (error) {
      next(error);
    }
  }

  // ------------------------------------------------------------ call logs
  static async addCallLog(req, res, next) {
    try {
      const data = await AddCallLogService.execute(
        { repairJobId: Number(req.params.id), ...req.body, adminId: req.user.id },
        req.context,
      );
      sendResponse({ req, res, next }, data);
    } catch (error) {
      next(error);
    }
  }

  static async getCallLogs(req, res, next) {
    try {
      const data = await GetCallLogsService.execute({ repairJobId: Number(req.params.id) }, req.context);
      sendResponse({ req, res, next }, data);
    } catch (error) {
      next(error);
    }
  }
}
