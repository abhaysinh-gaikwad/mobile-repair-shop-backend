// The full 'puppeteer' package (not 'puppeteer-core'): it bundles its own
// Chromium, downloaded automatically at `npm install` time, so this works
// unchanged on a host with no system Chrome (e.g. Render) — see the
// executablePath comment below.
import puppeteer from 'puppeteer';

import config from '@src/configs/app.config';
import db from '@src/db/models';
import { generateLoginToken } from '@src/helpers/authentication.helpers';
import { Logger } from '@src/libs/logger';

/**
 * Renders the SAME receipt the shop prints on paper into a PDF, for sending
 * on WhatsApp — reusing the actual print page (`ui/receipt/ReceiptSlip.jsx`)
 * rather than a second, drifting copy of the layout in the backend.
 *
 * A headless browser navigates to `/repairs/:id/print` on the frontend
 * itself, so the Marathi font, shop settings and layout are always exactly
 * what the counter would print. That page is behind login, so a short-lived
 * token (for the admin who clicked "Send on WhatsApp") is injected into
 * localStorage before the app's own JS boots — the same key the frontend's
 * axios client already reads.
 */
export async function generateReceiptPdf({ repairJobId, adminId }) {
  const admin = await db.AdminUser.findByPk(adminId);
  // A token is still needed even if the admin lookup somehow fails — fall
  // back to a generic identity rather than blocking the PDF entirely.
  const token = generateLoginToken(admin ?? { id: adminId, email: '', name: 'Shop Owner' });

  const baseUrl = config.get('frontend.baseUrl');
  const printUrl = `${baseUrl}/repairs/${repairJobId}/print`;

  const browser = await puppeteer.launch({
    // CHROME_EXECUTABLE_PATH is an opt-in for local dev only — see the same
    // comment in whatsappWebClient.js. Leave unset to use Puppeteer's own
    // bundled Chromium (required for this to work on Render).
    ...(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {}),
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const page = await browser.newPage();

    // Runs before the app's own scripts on every navigation to this origin —
    // the standard way to seed localStorage ahead of a login-gated app boot.
    await page.evaluateOnNewDocument((accessToken) => {
      // eslint-disable-next-line no-undef -- runs in the browser page context, not Node
      localStorage.setItem('accessToken', accessToken);
    }, token);

    await page.goto(printUrl, { waitUntil: 'networkidle0', timeout: 30000 });

    // Wait for the actual slip (not the loading/error state), for the
    // background template image to actually finish decoding, and for the
    // Devanagari font to finish loading — otherwise conjuncts render broken.
    await page.waitForSelector('[data-testid="receipt-slip"]', { timeout: 15000 });
    await page.waitForFunction(
      () => {
        // eslint-disable-next-line no-undef -- runs in the browser page context, not Node
        const el = document.querySelector('[data-testid="receipt-slip"]');
        // eslint-disable-next-line no-undef -- runs in the browser page context, not Node
        const url = el && getComputedStyle(el).backgroundImage.slice(5, -2);
        if (!url) return false;
        // eslint-disable-next-line no-undef -- runs in the browser page context, not Node
        const img = new Image();
        img.src = url;
        return img.complete;
      },
      { timeout: 15000 },
    );
    // eslint-disable-next-line no-undef -- runs in the browser page context, not Node
    await page.evaluate(() => document.fonts?.ready);

    const pdfBuffer = await page.pdf({ printBackground: true, preferCSSPageSize: true });
    return pdfBuffer;
  } catch (error) {
    Logger.error({ err: error, repairJobId }, 'Failed to render receipt PDF');
    throw error;
  } finally {
    await browser.close();
  }
}
