import db from '@src/db/models';
import { AppError } from '@src/errors/app.error';
import { Errors } from '@src/errors/errorCodes';
import { getRepairMoneySummary } from '@src/helpers/repair.helpers';
import { getSuccessResponse } from '@src/helpers/response.helpers';
import { dayjs } from '@src/libs/dayjs';
import { BaseHandler } from '@src/libs/logicBase';
import config from '@src/configs/app.config';
import { isWhatsAppConfigured, sendTemplateMessage, WhatsAppApiError, WhatsAppConfigError } from '@src/integrations/whatsapp/whatsappClient';
import { toWhatsAppNumber } from '@src/integrations/whatsapp/phoneNumber.utils';
import { PAYMENT_TYPE, WHATSAPP_MESSAGE_TYPE, WHATSAPP_STATUS } from '@src/utils/constants/public.constants';
import { formatRupees, round2 } from '@src/utils/money.utils';

/**
 * "Send this repair's receipt to the customer on WhatsApp."
 *
 * This is the ONLY place that knows how a `RepairJob` maps onto a WhatsApp
 * message — the Cloud API client (`integrations/whatsapp/whatsappClient.js`)
 * has no idea what a repair or a receipt is, and this service has no idea how
 * Graph API auth headers work. That split is deliberate: WhatsApp logic stays
 * out of the repair/payment business logic, and the transport can change
 * without touching this file.
 *
 * Every attempt is written to `whatsapp_notifications` — success AND failure
 * — so the repair's WhatsApp history is a real audit trail, not just a
 * pass/fail toast the admin saw once.
 */
export default class SendReceiptNotificationService extends BaseHandler {
  async run() {
    const { repairJobId, adminId } = this.args;
    const transaction = this.dbTransaction;

    const repairJob = await db.RepairJob.findByPk(repairJobId, {
      include: [
        { model: db.Customer, as: 'customer' },
        { model: db.Engineer, as: 'engineer', attributes: ['id', 'name'] },
      ],
      transaction,
    });
    if (!repairJob) throw new AppError(Errors.REPAIR_NOT_FOUND);

    const customer = repairJob.customer;
    const phoneNumber = toWhatsAppNumber(customer?.mobile);
    if (!phoneNumber) throw new AppError(Errors.WHATSAPP_NO_PHONE_NUMBER);

    const templateName = config.get('whatsapp.receiptTemplateName');
    const languageCode = config.get('whatsapp.templateLanguage');

    // Deliberately WITHOUT { transaction }: this row is the audit trail for
    // the send attempt itself, and must survive even when the send fails and
    // BaseHandler rolls the request transaction back. Written and committed
    // immediately (autocommit), before the network call, so "we tried and
    // don't know what happened" is a real, recoverable state — never silence.
    const notification = await db.WhatsappNotification.create({
      repairJobId: repairJob.id,
      customerId: customer.id,
      phoneNumber,
      messageType: WHATSAPP_MESSAGE_TYPE.RECEIPT,
      templateName,
      status: WHATSAPP_STATUS.PENDING,
      sentBy: adminId ?? null,
    });

    if (!isWhatsAppConfigured()) {
      await notification.update({
        status: WHATSAPP_STATUS.FAILED,
        errorMessage: 'WhatsApp is not configured on the server',
      });
      throw new AppError(Errors.WHATSAPP_NOT_CONFIGURED);
    }

    const money = await getRepairMoneySummary(repairJob.id, transaction);
    const bodyParameters = buildReceiptTemplateParams(repairJob, customer, money);

    try {
      const { messageId } = await sendTemplateMessage({
        to: phoneNumber,
        templateName,
        languageCode,
        bodyParameters,
      });

      await notification.update({ status: WHATSAPP_STATUS.SENT, whatsappMessageId: messageId, sentAt: new Date() });

      return {
        ...getSuccessResponse(`Receipt sent to ${customer.name} on WhatsApp.`),
        notification: {
          id: notification.id,
          status: WHATSAPP_STATUS.SENT,
          whatsappMessageId: messageId,
          phoneNumber,
          sentAt: notification.sentAt,
        },
      };
    } catch (error) {
      const isApiOrConfigError = error instanceof WhatsAppApiError || error instanceof WhatsAppConfigError;
      const errorMessage = isApiOrConfigError ? error.message : 'Unexpected error while sending WhatsApp message';
      const errorCode = error instanceof WhatsAppApiError ? String(error.code ?? '') : null;

      await notification.update({ status: WHATSAPP_STATUS.FAILED, errorCode, errorMessage });

      if (!isApiOrConfigError) throw error; // genuinely unexpected — let BaseHandler log + 500 it

      throw new AppError(Errors.WHATSAPP_SEND_FAILED(errorMessage));
    }
  }
}

/**
 * Ordered {{1}}, {{2}}, ... values for the approved template.
 *
 * NOTE: this order must match whatever the template was actually approved
 * with in Meta Business Manager — Meta has no way to name placeholders, only
 * position them. If the template changes, this list must change with it.
 */
function buildReceiptTemplateParams(repairJob, customer, money) {
  const device = [repairJob.brand, repairJob.modelNumber].filter(Boolean).join(' ');
  const paymentType = repairJob.status === 'DELIVERED' ? PAYMENT_TYPE.FINAL : PAYMENT_TYPE.ADVANCE;

  return [
    customer.name ?? '',
    repairJob.receiptNumber,
    device || '-',
    repairJob.repairDetails || repairJob.diagnosis || repairJob.customerComplaint || '-',
    repairJob.estimatedCost !== null && repairJob.estimatedCost !== undefined
      ? formatRupees(round2(repairJob.estimatedCost))
      : 'N/A',
    formatRupees(money.totalAmount),
    formatRupees(money.totalPaid),
    paymentType,
    dayjs(repairJob.receivedAt).format('DD MMM YYYY'),
  ];
}
