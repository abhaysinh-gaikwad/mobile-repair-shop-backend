import { sendResponse } from '@src/helpers/response.helpers';
import { Logger } from '@src/libs/logger';
import AssignEngineerService from '@src/services/repairs/assignEngineer.service';
import CreateRepairService from '@src/services/repairs/createRepair.service';
import GetRepairService from '@src/services/repairs/getRepair.service';
import GetRepairsService from '@src/services/repairs/getRepairs.service';
import GetDeviceHistoryService from '@src/services/repairs/getDeviceHistory.service';
import GetReceiptDataService from '@src/services/repairs/getReceiptData.service';
import RevealDeviceUnlockService from '@src/services/repairs/revealDeviceUnlock.service';
import UpdateDeviceUnlockService from '@src/services/repairs/updateDeviceUnlock.service';
import UpdateDiagnosisService from '@src/services/repairs/updateDiagnosis.service';
import UpdateRepairService from '@src/services/repairs/updateRepair.service';
import UpdateRepairStatusService from '@src/services/repairs/updateRepairStatus.service';
import SendJobDoneNotificationService from '@src/services/whatsapp/sendJobDoneNotification.service';
import { REPAIR_STATUS } from '@src/utils/constants/public.constants';

export default class RepairController {
  static async createRepair(req, res, next) {
    try {
      const data = await CreateRepairService.execute({ ...req.body, adminId: req.user.id }, req.context);
      sendResponse({ req, res, next }, data);
    } catch (error) {
      next(error);
    }
  }

  static async getRepairs(req, res, next) {
    try {
      const data = await GetRepairsService.execute({ ...req.query }, req.context);
      sendResponse({ req, res, next }, data);
    } catch (error) {
      next(error);
    }
  }

  static async getRepairById(req, res, next) {
    try {
      const data = await GetRepairService.execute({ id: Number(req.params.id) }, req.context);
      sendResponse({ req, res, next }, data);
    } catch (error) {
      next(error);
    }
  }

  static async getRepairByReceipt(req, res, next) {
    try {
      const data = await GetRepairService.execute({ receiptNumber: req.params.receiptNumber }, req.context);
      sendResponse({ req, res, next }, data);
    } catch (error) {
      next(error);
    }
  }

  static async getReceipt(req, res, next) {
    try {
      const data = await GetReceiptDataService.execute(
        { id: Number(req.params.id), adminId: req.user.id },
        req.context,
      );
      sendResponse({ req, res, next }, data);
    } catch (error) {
      next(error);
    }
  }

  /** Every repair ever done on this same physical phone (matched by IMEI). */
  static async getDeviceHistory(req, res, next) {
    try {
      const data = await GetDeviceHistoryService.execute({ id: Number(req.params.id) }, req.context);
      sendResponse({ req, res, next }, data);
    } catch (error) {
      next(error);
    }
  }

  /** Decrypts the screen-lock credential. Audited — see the service. */
  static async revealDeviceUnlock(req, res, next) {
    try {
      const data = await RevealDeviceUnlockService.execute(
        { id: Number(req.params.id), adminId: req.user.id, ipAddress: req.ip },
        req.context,
      );
      sendResponse({ req, res, next }, data);
    } catch (error) {
      next(error);
    }
  }

  static async updateDeviceUnlock(req, res, next) {
    try {
      const data = await UpdateDeviceUnlockService.execute(
        { id: Number(req.params.id), ...req.body },
        req.context,
      );
      sendResponse({ req, res, next }, data);
    } catch (error) {
      next(error);
    }
  }

  static async updateRepair(req, res, next) {
    try {
      const data = await UpdateRepairService.execute(
        { id: Number(req.params.id), ...req.body, adminId: req.user.id },
        req.context,
      );
      sendResponse({ req, res, next }, data);
    } catch (error) {
      next(error);
    }
  }

  static async updateStatus(req, res, next) {
    try {
      const data = await UpdateRepairStatusService.execute(
        { id: Number(req.params.id), ...req.body, adminId: req.user.id },
        req.context,
      );
      sendResponse({ req, res, next }, data);

      // Fire-and-forget, AFTER the response is sent: the status change has
      // already committed by this point, and a slow/failed WhatsApp send
      // must never delay or fail the status update itself — the phone IS
      // done regardless of whether the message goes through. Only on the
      // actual transition INTO JOB_DONE, not every edit while already there.
      if (data.repairJob.status === REPAIR_STATUS.JOB_DONE && data.fromStatus !== REPAIR_STATUS.JOB_DONE) {
        SendJobDoneNotificationService.execute({ repairJobId: data.repairJob.id, adminId: req.user.id }, {}).catch(
          (error) => Logger.warn({ err: error, repairJobId: data.repairJob.id }, 'Job-done WhatsApp notification failed'),
        );
      }
    } catch (error) {
      next(error);
    }
  }

  static async assignEngineer(req, res, next) {
    try {
      const data = await AssignEngineerService.execute(
        { id: Number(req.params.id), ...req.body, adminId: req.user.id },
        req.context,
      );
      sendResponse({ req, res, next }, data);
    } catch (error) {
      next(error);
    }
  }

  static async updateDiagnosis(req, res, next) {
    try {
      const data = await UpdateDiagnosisService.execute(
        { id: Number(req.params.id), ...req.body, adminId: req.user.id },
        req.context,
      );
      sendResponse({ req, res, next }, data);
    } catch (error) {
      next(error);
    }
  }
}
