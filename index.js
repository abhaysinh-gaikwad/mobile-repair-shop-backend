import http from 'http';

import config from '@src/configs/app.config';
import db from '@src/db/models';
import { Logger } from '@src/libs/logger';
import app from '@src/rest-resources';

const port = config.get('port');
const server = http.createServer(app);

async function start() {
  try {
    await db.sequelize.authenticate();
    Logger.info('database connection established');

    server.listen(port, () => {
      Logger.info(`${config.get('app.name')} listening on port ${port}`);
    });
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
