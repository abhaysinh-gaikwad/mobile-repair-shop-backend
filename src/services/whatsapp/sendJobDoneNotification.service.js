import db from '@src/db/models';
import { AppError } from '@src/errors/app.error';
import { Errors } from '@src/errors/errorCodes';
import { getSuccessResponse } from '@src/helpers/response.helpers';
import { BaseHandler } from '@src/libs/logicBase';
import { isWhatsAppWebReady, sendWebTextMessage, WhatsAppWebNotReadyError } from '@src/integrations/whatsapp/whatsappWebClient';
import { toWhatsAppNumber } from '@src/integrations/whatsapp/phoneNumber.utils';
import { isWhatsAppDisabled } from '@src/integrations/whatsapp/whatsappProvider';
import { WHATSAPP_MESSAGE_TYPE, WHATSAPP_STATUS } from '@src/utils/constants/public.constants';
import { Logger } from '@src/libs/logger';

/**
 * "The phone is ready — come pick it up" message, sent automatically the
 * moment a repair's status is set to JOB_DONE (see
 * updateRepairStatus.service.js). Plain WhatsApp Web text, not the Cloud
 * API — this is a same-day operational nudge, not a formal receipt, so it
 * doesn't need an approved template or a PDF attachment.
 *
 * Deliberately fire-and-forget from the caller's point of view: a failed
 * WhatsApp send must never fail the status update itself (the phone IS
 * done regardless of whether the message went through), so every error
 * here is caught and logged rather than thrown.
 */
export default class SendJobDoneNotificationService extends BaseHandler {
  async run() {
    const { repairJobId, adminId } = this.args;

    // This runs automatically on every JOB_DONE status change. With sending
    // switched off it must be a true no-op — returning before any DB write,
    // so marking a job done doesn't record a FAILED notification that nobody
    // ever asked for. The status update itself is unaffected either way.
    if (isWhatsAppDisabled()) {
      return getSuccessResponse('WhatsApp sending is turned off — job-done message not sent.');
    }

    const repairJob = await db.RepairJob.findByPk(repairJobId, {
      include: [{ model: db.Customer, as: 'customer' }],
    });
    if (!repairJob) throw new AppError(Errors.REPAIR_NOT_FOUND);

    const customer = repairJob.customer;
    const phoneNumber = toWhatsAppNumber(customer?.mobile);
    if (!phoneNumber) {
      Logger.warn({ repairJobId }, 'Job-done WhatsApp notification skipped — customer has no usable mobile number');
      return getSuccessResponse('No mobile number on file — job-done message not sent.');
    }

    // Deliberately WITHOUT { transaction } — same reasoning as the receipt
    // notification: this row is the audit trail for the send attempt itself
    // and must survive even if something else in the request rolls back.
    const notification = await db.WhatsappNotification.create({
      repairJobId: repairJob.id,
      customerId: customer.id,
      phoneNumber,
      messageType: WHATSAPP_MESSAGE_TYPE.JOB_DONE,
      status: WHATSAPP_STATUS.PENDING,
      sentBy: adminId ?? null,
    });

    if (!isWhatsAppWebReady()) {
      await notification.update({
        status: WHATSAPP_STATUS.FAILED,
        errorMessage: 'WhatsApp Web is not connected — scan the QR code first',
      });
      return getSuccessResponse('WhatsApp Web is not connected — job-done message not sent.');
    }

    try {
      const { messageId } = await sendWebTextMessage({
        to: phoneNumber,
        text: buildJobDoneMessage(repairJob, customer),
      });
      await notification.update({ status: WHATSAPP_STATUS.SENT, whatsappMessageId: messageId, sentAt: new Date() });
      return { ...getSuccessResponse(`Job-done message sent to ${customer.name} on WhatsApp.`), notification };
    } catch (error) {
      const errorMessage = error instanceof WhatsAppWebNotReadyError ? error.message : 'Unexpected error while sending WhatsApp message';
      await notification.update({ status: WHATSAPP_STATUS.FAILED, errorMessage });
      Logger.warn({ err: error, repairJobId }, 'Job-done WhatsApp notification failed');
      return getSuccessResponse('Could not send the job-done WhatsApp message.');
    }
  }
}

function buildJobDoneMessage(repairJob, customer) {
  const device = [repairJob.brand, repairJob.modelNumber].filter(Boolean).join(' ');

  return [
    `नमस्कार ${customer.name ?? ''}, आपल्या मोबाइलची दुरुस्ती झाली आहे. आपण ती घेऊन जाऊ शकता.`,
    '',
    `पावती क्रमांक: ${repairJob.receiptNumber}`,
    device ? `मोबाइल: ${device}` : null,
  ]
    .filter((line) => line !== null)
    .join('\n');
}
