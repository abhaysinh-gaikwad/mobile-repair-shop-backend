import { getWhatsAppWebStatus, resetWhatsAppWeb } from '@src/integrations/whatsapp/whatsappWebClient';
import { getSuccessResponse, sendResponse } from '@src/helpers/response.helpers';
import GetWhatsAppNotificationsService from '@src/services/whatsapp/getNotifications.service';
import SendReceiptNotificationService from '@src/services/whatsapp/sendReceiptNotification.service';

export default class WhatsAppController {
  /** Connection status for the "scan to connect" screen — no service/DB involved, it's live in-memory state. */
  static async getWebStatus(req, res, next) {
    try {
      sendResponse({ req, res, next }, { ...getSuccessResponse('ok'), ...getWhatsAppWebStatus() });
    } catch (error) {
      next(error);
    }
  }

  /** Clears a stuck/never-scanned session and starts over with a fresh QR. */
  static async resetWeb(req, res, next) {
    try {
      // Fire-and-forget: the browser relaunch takes a few seconds, and the
      // Settings page is already polling status — no need to make this
      // request wait for the new QR to actually appear.
      resetWhatsAppWeb().catch(() => {});
      sendResponse({ req, res, next }, getSuccessResponse('Resetting — a new QR code will appear shortly.'));
    } catch (error) {
      next(error);
    }
  }

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
