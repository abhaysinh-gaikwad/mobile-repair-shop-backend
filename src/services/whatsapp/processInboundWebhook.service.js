import db from '@src/db/models';
import { getSuccessResponse } from '@src/helpers/response.helpers';
import { BaseHandler } from '@src/libs/logicBase';
import { Logger } from '@src/libs/logger';
import { CreateLeadService } from '@src/services/crm/manageLeads.service';
import { LEAD_SOURCE } from '@src/utils/constants/public.constants';

/**
 * Turns an inbound WhatsApp message into a CRM lead.
 *
 * Every incoming enquiry goes through CreateLeadService — the same path the
 * "Add Lead" button uses — so Round Robin, repeat-customer stickiness and the
 * assignment audit trail all apply without being reimplemented here. This
 * service's only job is understanding Meta's payload shape.
 *
 * Meta retries a webhook that does not return 200 quickly, so anything that
 * goes wrong with ONE message is logged and skipped rather than thrown: one
 * unparseable message must not cause Meta to redeliver the whole batch
 * forever, nor block the other messages in it.
 */
export default class ProcessInboundWebhookService extends BaseHandler {
  async run() {
    const { payload } = this.args;

    const results = [];

    for (const entry of payload?.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value ?? {};

        // Delivery/read receipts for messages WE sent. Not enquiries — they
        // arrive on the same webhook and must not become leads.
        if (value.statuses?.length) {
          for (const status of value.statuses) {
            await this.recordOutboundStatus(status);
          }
          continue;
        }

        // The customer's WhatsApp profile name, keyed by phone number.
        const profileNames = Object.fromEntries(
          (value.contacts ?? []).map((contact) => [contact.wa_id, contact.profile?.name]),
        );

        for (const message of value.messages ?? []) {
          try {
            results.push(await this.handleMessage(message, profileNames));
          } catch (error) {
            Logger.error({ err: error, messageId: message.id }, 'WhatsApp webhook: could not process message');
          }
        }
      }
    }

    return { ...getSuccessResponse('Webhook processed.'), processed: results.length, results };
  }

  async handleMessage(message, profileNames) {
    const from = message.from;
    const text = extractText(message);

    Logger.info({ from, type: message.type, id: message.id }, 'WhatsApp: inbound message');

    const data = await CreateLeadService.execute(
      {
        source: LEAD_SOURCE.WHATSAPP,
        // The customer's own WhatsApp display name. Often the only name the
        // shop gets, and better than leaving the lead nameless.
        customerName: profileNames[from] || null,
        mobile: from,
        enquiry: text,
        // Deliberately no adminId: nobody on the staff created this lead, and
        // recording one as its creator would be untrue.
        adminId: null,
      },
      { sequelizeTransaction: await db.sequelize.transaction() },
    );

    return {
      messageId: message.id,
      leadId: data.lead.id,
      deduplicated: Boolean(data.deduplicated),
      assignedTo: data.lead.assignedTo,
    };
  }

  /**
   * Marks one of our own outbound notifications as delivered/read/failed.
   *
   * Best-effort: a status for a message this system never sent (or sent before
   * this table existed) simply has nothing to update, which is not an error.
   */
  async recordOutboundStatus(status) {
    if (!status?.id) return;
    const notification = await db.WhatsappNotification.findOne({ where: { whatsappMessageId: status.id } });
    if (!notification) return;

    if (status.status === 'failed') {
      await notification.update({
        errorMessage: status.errors?.[0]?.title ?? 'Delivery failed',
        errorCode: String(status.errors?.[0]?.code ?? ''),
      });
    }
  }
}

/**
 * The readable content of a message, whatever kind it is.
 *
 * A customer's first contact is very often an image of the broken screen with
 * no words at all, so non-text types produce a short description rather than
 * an empty enquiry — a lead saying "[image]" is still a lead worth calling.
 */
function extractText(message) {
  switch (message.type) {
    case 'text':
      return message.text?.body ?? null;
    case 'button':
      return message.button?.text ?? null;
    case 'interactive':
      return (
        message.interactive?.button_reply?.title ?? message.interactive?.list_reply?.title ?? '[interactive reply]'
      );
    case 'image':
    case 'video':
    case 'document':
    case 'audio':
    case 'sticker': {
      const caption = message[message.type]?.caption;
      return caption ? `[${message.type}] ${caption}` : `[${message.type}]`;
    }
    case 'location': {
      const location = message.location ?? {};
      return `[location] ${location.name ?? ''} ${location.latitude ?? ''},${location.longitude ?? ''}`.trim();
    }
    case 'contacts':
      return '[contact card]';
    default:
      return `[${message.type ?? 'unknown'}]`;
  }
}
