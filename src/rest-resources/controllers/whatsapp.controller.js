import { getWhatsAppWebStatus, resetWhatsAppWeb } from '@src/integrations/whatsapp/whatsappWebClient';
import { getSuccessResponse, sendResponse } from '@src/helpers/response.helpers';
import { getWhatsAppProvider, isWhatsAppDisabled } from '@src/integrations/whatsapp/whatsappProvider';
import GetWhatsAppNotificationsService from '@src/services/whatsapp/getNotifications.service';
import SendReceiptNotificationService from '@src/services/whatsapp/sendReceiptNotification.service';

export default class WhatsAppController {
  /**
   * Connection status for the "scan to connect" screen — no service/DB
   * involved, it's live in-memory state.
   *
   * When WHATSAPP_PROVIDER=disabled both handlers short-circuit: the Settings
   * page polls this endpoint, and a switched-off server must answer plainly
   * rather than reporting a broken connection nobody can fix.
   */
  static async getWebStatus(req, res, next) {
    try {
      if (isWhatsAppDisabled()) {
        return sendResponse(
          { req, res, next },
          {
            ...getSuccessResponse('WhatsApp sending is turned off on this server.'),
            provider: getWhatsAppProvider(),
            disabled: true,
            ready: false,
            needsQrScan: false,
            qrDataUrl: null,
          },
        );
      }

      return sendResponse(
        { req, res, next },
        { ...getSuccessResponse('ok'), provider: getWhatsAppProvider(), disabled: false, ...getWhatsAppWebStatus() },
      );
    } catch (error) {
      return next(error);
    }
  }

  /** Clears a stuck/never-scanned session and starts over with a fresh QR. */
  static async resetWeb(req, res, next) {
    try {
      // With sending disabled this must NOT launch a browser — that is the
      // one thing the whole switch exists to prevent.
      if (isWhatsAppDisabled()) {
        return sendResponse(
          { req, res, next },
          getSuccessResponse('WhatsApp sending is turned off on this server — nothing to reset.'),
        );
      }

      // Fire-and-forget: the browser relaunch takes a few seconds, and the
      // Settings page is already polling status — no need to make this
      // request wait for the new QR to actually appear.
      resetWhatsAppWeb().catch(() => {});
      return sendResponse({ req, res, next }, getSuccessResponse('Resetting — a new QR code will appear shortly.'));
    } catch (error) {
      return next(error);
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
