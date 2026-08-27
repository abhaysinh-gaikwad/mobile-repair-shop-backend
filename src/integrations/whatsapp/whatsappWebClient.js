import { execFile } from 'child_process';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { promisify } from 'util';

import { Client, LocalAuth, MessageMedia } from 'whatsapp-web.js';
import QRCode from 'qrcode';

import { Logger } from '@src/libs/logger';

const execFileAsync = promisify(execFile);

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

/**
 * Render's build and running-app filesystems are different layers — a
 * Chrome binary downloaded during `npm install`'s postinstall step (build
 * time) does NOT reliably survive into the running deploy (runtime), no
 * matter which cache directory it's pointed at. `whatsapp-web.js`/Puppeteer
 * then fail with "Could not find Chrome" even though the build logs showed
 * a successful install minutes earlier.
 *
 * Fix: check for Chrome once at actual process startup (runtime, not build
 * time) and, if missing, download it right there — using the same `puppeteer
 * browsers install chrome` CLI Puppeteer ships, so it resolves the exact
 * build id THIS installed Puppeteer version expects rather than guessing one.
 */
let ensureChromePromise = null;
async function ensureChromeInstalled() {
  if (ensureChromePromise) return ensureChromePromise;

  ensureChromePromise = (async () => {
    try {
      const puppeteer = await import('puppeteer');
      const executablePath = puppeteer.default.executablePath();
      await fs.access(executablePath);
      Logger.info({ executablePath }, 'WhatsApp Web: Chrome already installed');
    } catch {
      Logger.warn('WhatsApp Web: Chrome not found at runtime — installing now (one-time, ~1 min)');
      try {
        const cliPath = require.resolve('puppeteer/lib/cjs/puppeteer/node/cli.js');
        await execFileAsync(process.execPath, [cliPath, 'browsers', 'install', 'chrome'], {
          timeout: 180000,
        });
        Logger.info('WhatsApp Web: Chrome installed successfully');
      } catch (installError) {
        Logger.error({ err: installError }, 'WhatsApp Web: runtime Chrome install failed');
        throw installError;
      }
    }
  })();

  return ensureChromePromise;
}

function buildClient() {
  return new Client({
    authStrategy: new LocalAuth({ dataPath: '.wwebjs_auth' }),
    puppeteer: {
      // CHROME_EXECUTABLE_PATH is an opt-in for local dev (point at an
      // already-installed system Chrome, skipping Puppeteer's own ~200MB
      // Chromium download). Leave it UNSET everywhere else — Puppeteer then
      // uses its own bundled Chromium, downloaded automatically at `npm
      // install` time, which is what makes this work on a host like Render
      // where no system Chrome exists at all.
      ...(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {}),
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

  initPromise = (async () => {
    await ensureChromeInstalled();
    return launchClient();
  })().catch((error) => {
    Logger.error({ err: error }, 'WhatsApp Web: failed to initialize');
    // Allow a later retry rather than staying permanently stuck.
    initPromise = null;
  });

  return initPromise;
}

function launchClient() {
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

  return client.initialize();
}

/**
 * Manual "clear and reconnect" — for when the session is stuck (never
 * scanned, or Puppeteer failed to launch and gave up) rather than actually
 * logged out. Destroys the current client, wipes the saved session on disk,
 * and starts fresh: the next status check gets a brand new QR to scan.
 */
export async function resetWhatsAppWeb() {
  const deadClient = client;
  client = null;
  readyState = false;
  lastQrDataUrl = null;
  initPromise = null;

  if (deadClient) await deadClient.destroy().catch(() => {});

  // client.destroy() resolves once Puppeteer's browser.close() call returns,
  // but the underlying Chrome OS process can take a moment longer to
  // actually release its lock/file handles on .wwebjs_auth — an rm right
  // after destroy() can silently no-op (EBUSY, swallowed by force:true),
  // leaving the OLD authenticated session in place. The next init then just
  // reconnects to the same account instead of ever showing a fresh QR. Retry
  // the delete for a few seconds instead of trying exactly once.
  const deadline = Date.now() + 5000;
  for (;;) {
    await fs.rm('.wwebjs_auth', { recursive: true, force: true }).catch(() => {});
    const stillThere = await fs
      .access('.wwebjs_auth')
      .then(() => true)
      .catch(() => false);
    if (!stillThere || Date.now() > deadline) break;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  return initWhatsAppWeb();
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
