import fs from 'fs/promises';
import os from 'os';
import path from 'path';

import { Client, LocalAuth, MessageMedia } from 'whatsapp-web.js';
import QRCode from 'qrcode';

import { Logger } from '@src/libs/logger';

/**
 * Alternate WhatsApp transport: drives a real, logged-in WhatsApp Web session
 * instead of Meta's Cloud API.
 *
 * Exists so the shop can start sending receipts on day one — a Cloud API app
 * needs a fresh business phone number and Meta review, which is a real wall
 * for a small shop. This drives the SAME browser session as
 * web.whatsapp.com, logged in once by scanning a QR code, after which the
 * session is cached to disk (`.wwebjs_auth/`) and survives restarts.
 *
 * This is NOT the Meta Cloud API — it is browser automation of WhatsApp Web,
 * scoped to sending single receipt messages the shop's own admin triggers by
 * hand. Kept behind the same provider-switch as the Cloud API client (see
 * whatsappClient.js) so swapping to the official API later is a one-line
 * config change, not a rewrite.
 */

let client = null;
let readyState = false;
let lastQrDataUrl = null;
let initPromise = null;

function buildClient() {
  return new Client({
    authStrategy: new LocalAuth({ dataPath: '.wwebjs_auth' }),
    puppeteer: {
      executablePath: process.env.CHROME_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable',
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    },
  });
}

/**
 * Starts the WhatsApp Web session (once). Safe to call multiple times — only
 * the first call actually launches the browser; later calls reuse it.
 */
export function initWhatsAppWeb() {
  if (initPromise) return initPromise;

  client = buildClient();

  client.on('qr', async (qr) => {
    lastQrDataUrl = await QRCode.toDataURL(qr);
    readyState = false;
    Logger.info('WhatsApp Web: scan the QR code on the Settings page (or GET /api/whatsapp/web/status) to log in');
  });

  client.on('ready', () => {
    readyState = true;
    lastQrDataUrl = null;
    Logger.info('WhatsApp Web: session ready — messages can be sent');
  });

  client.on('disconnected', (reason) => {
    readyState = false;
    Logger.warn({ reason }, 'WhatsApp Web: session disconnected — reconnecting');

    // Self-heal instead of sitting dead until someone restarts the server.
    // If the phone genuinely unlinked the session, this comes back as a
    // fresh 'qr' event to re-scan; if it was a transient drop, it reconnects
    // on its own.
    const deadClient = client;
    client = null;
    initPromise = null;
    deadClient.destroy().catch(() => {});
    setTimeout(() => initWhatsAppWeb(), 3000);
  });

  client.on('auth_failure', (message) => {
    readyState = false;
    Logger.error({ message }, 'WhatsApp Web: authentication failed');
  });

  initPromise = client.initialize().catch((error) => {
    Logger.error({ err: error }, 'WhatsApp Web: failed to initialize');
    // Allow a later retry rather than staying permanently stuck.
    initPromise = null;
  });

  return initPromise;
}

/** Status for the admin-facing "scan to connect" screen. */
export function getWhatsAppWebStatus() {
  return {
    ready: readyState,
    needsQrScan: !readyState && Boolean(lastQrDataUrl),
    qrDataUrl: !readyState ? lastQrDataUrl : null,
  };
}

export function isWhatsAppWebReady() {
  return readyState;
}

/** A configuration/session problem, distinct from WhatsApp rejecting a specific send. */
export class WhatsAppWebNotReadyError extends Error {
  constructor(message = 'WhatsApp Web is not connected — scan the QR code first') {
    super(message);
    this.name = 'WhatsAppWebNotReadyError';
  }
}

/**
 * @param {string} to - digits-only phone number with country code, e.g. "919876543210".
 * @param {string} text
 */
export async function sendWebTextMessage({ to, text }) {
  if (!readyState || !client) throw new WhatsAppWebNotReadyError();

  const chatId = `${to}@c.us`;

  try {
    const isRegistered = await client.isRegisteredUser(chatId);
    if (!isRegistered) {
      throw new WhatsAppWebNotReadyError(`${to} does not have WhatsApp`);
    }

    // whatsapp-web.js can resolve this with an incomplete/undefined message
    // object even when WhatsApp Web has actually sent the message — so a
    // missing `sent` is logged, never thrown as a failure.
    const sent = await client.sendMessage(chatId, text);
    const messageId = sent?.id?._serialized ?? null;
    Logger.info({ to, messageId }, 'WhatsApp Web message sent');
    return { messageId };
  } catch (error) {
    if (error instanceof WhatsAppWebNotReadyError) throw error;
    Logger.error({ err: error, to }, 'WhatsApp Web send failed');
    throw new Error(`Could not send WhatsApp Web message: ${error.message}`);
  }
}

/**
 * Sends a document (the receipt PDF) with a short caption in one message.
 *
 * @param {string} to - digits-only phone number with country code.
 * @param {Buffer} pdfBuffer
 * @param {string} filename
 * @param {string} [caption]
 */
export async function sendWebDocumentMessage({ to, pdfBuffer, filename, caption }) {
  if (!readyState || !client) throw new WhatsAppWebNotReadyError();

  const chatId = `${to}@c.us`;

  try {
    const isRegistered = await client.isRegisteredUser(chatId);
    if (!isRegistered) {
      throw new WhatsAppWebNotReadyError(`${to} does not have WhatsApp`);
    }

    // MessageMedia built directly from a base64 string can hit a whatsapp-web.js
    // quirk ("atob ... not correctly encoded") on some WhatsApp Web builds —
    // fromFilePath() goes through its own, more reliable read path. A temp
    // DIRECTORY (not just a temp filename) lets the file itself be named
    // exactly what the customer should see, since fromFilePath names the
    // attachment from the path's basename.
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wa-receipt-'));
    const tempPath = path.join(tempDir, filename || 'receipt.pdf');
    await fs.writeFile(tempPath, pdfBuffer);

    let sent;
    try {
      const media = MessageMedia.fromFilePath(tempPath);
      // Same undefined-return quirk as sendWebTextMessage — never thrown as a failure.
      sent = await client.sendMessage(chatId, media, { caption, sendMediaAsDocument: true });
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }

    const messageId = sent?.id?._serialized ?? null;
    Logger.info({ to, messageId }, 'WhatsApp Web document sent');
    return { messageId };
  } catch (error) {
    if (error instanceof WhatsAppWebNotReadyError) throw error;
    Logger.error({ err: error, to }, 'WhatsApp Web document send failed');
    throw new Error(`Could not send WhatsApp Web document: ${error.message}`);
  }
}
