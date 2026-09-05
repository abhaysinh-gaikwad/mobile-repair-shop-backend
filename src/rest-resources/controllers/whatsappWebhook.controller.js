import crypto from 'crypto';

import config from '@src/configs/app.config';
import { Logger } from '@src/libs/logger';
import ProcessInboundWebhookService from '@src/services/whatsapp/processInboundWebhook.service';

/**
 * Meta's WhatsApp webhook. The ONLY unauthenticated write endpoint in this
 * application, which is why the two guards below are not optional.
 */
export default class WhatsAppWebhookController {
  /**
   * One-time verification handshake.
   *
   * When the URL is saved in Meta's dashboard, Meta GETs it with a challenge
   * and the verify token that was typed alongside it. Echoing the challenge
   * back — as plain text, not JSON — is what completes the subscription.
   */
  static verify(req, res) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const expected = config.get('whatsapp.webhookVerifyToken');

    if (!expected) {
      Logger.error('WhatsApp webhook verification attempted, but WHATSAPP_WEBHOOK_VERIFY_TOKEN is not set');
      return res.sendStatus(500);
    }

    if (mode === 'subscribe' && token === expected) {
      Logger.info('WhatsApp webhook verified by Meta');
      return res.status(200).send(challenge);
    }

    Logger.warn({ mode }, 'WhatsApp webhook verification rejected — token mismatch');
    return res.sendStatus(403);
  }

  /**
   * Inbound messages.
   *
   * Two things happen in a deliberate order:
   *
   *  1. The X-Hub-Signature-256 is checked against the RAW body using the app
   *     secret. Without this the endpoint is a public "create a lead" API for
   *     anyone who learns the URL, and the CRM fills with junk.
   *  2. Meta is answered 200 IMMEDIATELY, before the work is done. Meta
   *     retries anything slower than a few seconds, and a retry would create
   *     the same lead twice. Processing continues after the response.
   */
  static async receive(req, res) {
    const appSecret = config.get('whatsapp.appSecret');
    const signature = req.get('x-hub-signature-256');

    if (appSecret) {
      if (!verifySignature(req.rawBody, signature, appSecret)) {
        Logger.warn('WhatsApp webhook: bad signature, payload rejected');
        return res.sendStatus(401);
      }
    } else {
      // Not fatal — a fresh install can receive before the secret is set — but
      // it must be loud, because it means anyone could be posting this.
      Logger.warn('WhatsApp webhook: WHATSAPP_APP_SECRET is not set, signature NOT verified');
    }

    // Answer first, work second. See above.
    res.sendStatus(200);

    try {
      const data = await ProcessInboundWebhookService.execute({ payload: req.body }, {});
      if (data.processed) Logger.info({ results: data.results }, 'WhatsApp webhook: leads created');
    } catch (error) {
      // Nothing can be reported to Meta at this point — the 200 has been sent
      // — so this is logged and dropped rather than retried into a loop.
      Logger.error({ err: error }, 'WhatsApp webhook: processing failed after acknowledgement');
    }

    return undefined;
  }
}

/** Constant-time HMAC-SHA256 comparison against the raw request body. */
function verifySignature(rawBody, signature, appSecret) {
  if (!rawBody || !signature) return false;

  const expected = `sha256=${crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex')}`;

  // timingSafeEqual throws on a length mismatch, so that is checked first.
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
