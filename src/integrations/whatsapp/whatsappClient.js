import config from '@src/configs/app.config';
import { Logger } from '@src/libs/logger';

/**
 * Thin wrapper over Meta's WhatsApp Cloud API (Graph API).
 *
 * Deliberately Meta-only — no Twilio, no third-party WhatsApp BSP. This is the
 * ONLY file that knows the Graph API's shape (auth header, endpoint paths,
 * error envelope); every WhatsApp-sending service goes through it rather than
 * calling `fetch` itself, so the integration can be swapped or mocked in one
 * place.
 *
 * Kept separate from repair/payment business logic on purpose (see
 * services/whatsapp/) — this module does not know what a "repair" is.
 */

const baseUrl = () => `https://graph.facebook.com/${config.get('whatsapp.apiVersion')}`;

/**
 * A configuration problem (missing token/phone number ID) is distinct from a
 * Meta API rejection — callers need to tell "we forgot to set up WhatsApp"
 * apart from "Meta rejected this specific message".
 */
export class WhatsAppConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'WhatsAppConfigError';
  }
}

/** Wraps a rejection returned BY Meta's API (non-2xx with a Graph error body). */
export class WhatsAppApiError extends Error {
  constructor({ message, code, type, subcode, traceId, httpStatus }) {
    super(message);
    this.name = 'WhatsAppApiError';
    this.code = code ?? null;
    this.type = type ?? null;
    this.subcode = subcode ?? null;
    this.traceId = traceId ?? null;
    this.httpStatus = httpStatus ?? null;
  }
}

function assertConfigured() {
  const accessToken = config.get('whatsapp.accessToken');
  const phoneNumberId = config.get('whatsapp.phoneNumberId');

  if (!accessToken || !phoneNumberId) {
    throw new WhatsAppConfigError(
      'WhatsApp is not configured — set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID in .env',
    );
  }

  return { accessToken, phoneNumberId };
}

/**
 * POST to /{phoneNumberId}/messages with the given payload.
 *
 * Every WhatsApp send (template, future document/text) goes through this one
 * function, so auth, error normalization and logging happen exactly once.
 */
async function postMessage(payload) {
  const { accessToken, phoneNumberId } = assertConfigured();
  const url = `${baseUrl()}/${phoneNumberId}/messages`;

  let response;
  let body;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    body = await response.json().catch(() => ({}));
  } catch (networkError) {
    Logger.error({ err: networkError, url }, 'WhatsApp Cloud API request failed (network)');
    throw new WhatsAppApiError({ message: `Could not reach WhatsApp: ${networkError.message}` });
  }

  if (!response.ok) {
    const graphError = body?.error ?? {};
    Logger.error({ status: response.status, graphError, payload }, 'WhatsApp Cloud API rejected the message');
    throw new WhatsAppApiError({
      message: graphError.message || `WhatsApp API returned HTTP ${response.status}`,
      code: graphError.code,
      type: graphError.type,
      subcode: graphError.error_subcode,
      traceId: graphError.fbtrace_id,
      httpStatus: response.status,
    });
  }

  // Success shape: { messaging_product, contacts: [...], messages: [{ id }] }
  const messageId = body?.messages?.[0]?.id ?? null;
  Logger.info({ messageId, to: payload.to }, 'WhatsApp message accepted by Meta');
  return { messageId, raw: body };
}

/**
 * Send an approved template message.
 *
 * Meta REQUIRES a pre-approved template for any business-initiated message
 * outside the 24-hour customer-service window — which a "your receipt is
 * ready" notification always is. Free-form text is rejected by the API in
 * that case, so this is the one send path this integration offers.
 *
 * @param {string} to - E.164-ish phone number, digits only, with country code.
 * @param {string} templateName
 * @param {string} languageCode
 * @param {Array<{type: string, text?: string}>} bodyParameters - ordered
 *   values for the template's {{1}}, {{2}}, ... placeholders.
 */
export async function sendTemplateMessage({ to, templateName, languageCode, bodyParameters = [] }) {
  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      ...(bodyParameters.length
        ? { components: [{ type: 'body', parameters: bodyParameters.map((text) => ({ type: 'text', text })) }] }
        : {}),
    },
  };

  return postMessage(payload);
}

/**
 * Send a document (e.g. a receipt PDF) by URL.
 *
 * NOTE: Meta fetches the file itself from `documentUrl`, so it must be a
 * real, publicly reachable HTTPS URL — never localhost. Exposed here for when
 * PDF hosting is added; not currently wired into the receipt-notification
 * flow (see services/whatsapp/sendReceiptNotification.service.js).
 */
export async function sendDocumentMessage({ to, documentUrl, filename, caption }) {
  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'document',
    document: {
      link: documentUrl,
      ...(filename ? { filename } : {}),
      ...(caption ? { caption } : {}),
    },
  };

  return postMessage(payload);
}

export function isWhatsAppConfigured() {
  return Boolean(config.get('whatsapp.accessToken') && config.get('whatsapp.phoneNumberId'));
}
