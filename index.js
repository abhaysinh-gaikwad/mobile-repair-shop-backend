import http from 'http';

import config from '@src/configs/app.config';
import db from '@src/db/models';
import { initWhatsAppWeb } from '@src/integrations/whatsapp/whatsappWebClient';
import { Logger } from '@src/libs/logger';
import app from '@src/rest-resources';

const port = config.get('port');
const server = http.createServer(app);

// WhatsApp Web (whatsapp-web.js) drives its own headless browser and
// reconnect logic internally; an error from THAT internal machinery (e.g. a
// reconnect attempt racing a navigation right after the session disconnects)
// is an unhandled rejection at the process level and would otherwise crash
// the entire API — taking down repairs, billing, everything — over what is
// a best-effort side feature. Log it and keep the server running.
process.on('unhandledRejection', (reason) => {
  Logger.error({ err: reason }, 'Unhandled promise rejection (server kept running)');
});
process.on('uncaughtException', (error) => {
  Logger.error({ err: error }, 'Uncaught exception (server kept running)');
});

async function start() {
  try {
    await db.sequelize.authenticate();
    Logger.info('database connection established');

    server.listen(port, () => {
      Logger.info(`${config.get('app.name')} listening on port ${port}`);
    });

    // Fire-and-forget: launching the WhatsApp Web browser session must never
    // block or crash the HTTP server coming up. Failures are logged inside
    // whatsappWebClient itself.
    //
    if (config.get('whatsapp.provider') === 'web') {
      Logger.warn(
        'WHATSAPP_PROVIDER=web — launching a persistent headless Chrome (~450MB). Confirm this host has the RAM headroom.',
      );
      initWhatsAppWeb();
    } else {
      Logger.info(
        { provider: config.get('whatsapp.provider') },
        'WhatsApp Web not started — no browser launched, whatsapp-web.js not loaded',
      );
    }
  } catch (error) {
    Logger.error({ err: error }, 'failed to start server');
    process.exit(1);
  }
}

async function shutdown(signal) {
  Logger.info(`${signal} received, shutting down`);
  server.close(async () => {
    try {
      await db.sequelize.close();
    } catch (error) {
      Logger.error({ err: error }, 'error closing database connection');
    }
    process.exit(0);
  });

  // Don't hang forever if a connection refuses to drain.
  setTimeout(() => process.exit(1), 10000).unref();
}

['SIGTERM', 'SIGINT'].forEach((signal) => process.on(signal, () => shutdown(signal)));

start();
