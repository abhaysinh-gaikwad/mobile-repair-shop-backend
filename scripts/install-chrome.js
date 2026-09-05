/* eslint-disable no-console */
'use strict';

/**
 * Downloads the Chromium build Puppeteer expects — unless it isn't needed.
 *
 * Chrome is used by exactly two things, and BOTH are inactive while
 * WHATSAPP_PROVIDER=disabled: the WhatsApp Web session, and the receipt-PDF
 * renderer that only runs to attach a PDF to a WhatsApp message.
 *
 * The download is ~180MB and unpacks to roughly 450MB. On the shop's t2.micro
 * (~950MB RAM, routinely under 150MB free) that step is the single heaviest
 * part of a rebuild and a genuine risk of pushing the box into the swap-thrash
 * hang it has already suffered twice. Skipping it when nothing can launch
 * Chrome is not a shortcut — it is declining to build something unusable.
 *
 * Set PUPPETEER_SKIP_DOWNLOAD=false to force the download back on. That is
 * REQUIRED before switching WHATSAPP_PROVIDER back to `web`, or Puppeteer will
 * fail at runtime with "Could not find Chrome".
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const skip = String(process.env.PUPPETEER_SKIP_DOWNLOAD ?? '').toLowerCase() === 'true';

if (skip) {
  console.log(
    'install-chrome: PUPPETEER_SKIP_DOWNLOAD=true — skipping the Chromium download.\n' +
      '                WhatsApp Web and WhatsApp receipt PDFs will NOT work until this is\n' +
      '                rebuilt with PUPPETEER_SKIP_DOWNLOAD=false.',
  );
  process.exit(0);
}

const cacheDir = process.env.PUPPETEER_CACHE_DIR || path.join(os.homedir(), '.cache', 'puppeteer');

// A half-written Chrome from an interrupted install makes Puppeteer fail in a
// confusing way; clearing it first means a rerun always produces a clean copy.
fs.rmSync(path.join(cacheDir, 'chrome'), { recursive: true, force: true });

// Resolve the build id from the INSTALLED puppeteer rather than pinning one
// here, so this cannot drift out of step with the dependency.
const cli = require.resolve('puppeteer/lib/cjs/puppeteer/node/cli.js');
execFileSync(process.execPath, [cli, 'browsers', 'install', 'chrome'], { stdio: 'inherit' });
