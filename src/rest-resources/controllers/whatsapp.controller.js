import { sendResponse } from '@src/helpers/response.helpers';
import GetWhatsAppNotificationsService from '@src/services/whatsapp/getNotifications.service';
import SendReceiptNotificationService from '@src/services/whatsapp/sendReceiptNotification.service';

export default class WhatsAppController {
  static async sendReceipt(req, res, next) {
    try {
      const data = await SendReceiptNotificationService.execute(
        { repairJobId: Number(req.params.id), adminId: req.user.id },
        req.context,
      );
      sendResponse({ req, res, next }, data);
    } catch (error) {
      next(error);
    }
  }

  static async getNotifications(req, res, next) {
    try {
      const data = await GetWhatsAppNotificationsService.execute(
        { repairJobId: Number(req.params.id) },
        req.context,
      );
      sendResponse({ req, res, next }, data);
    } catch (error) {
      next(error);
    }
  }
}
