import pino from 'pino';

import config from '@src/configs/app.config';

const isDevelopment = config.get('env') === 'development';

export const Logger = pino({
  level: config.get('logLevel'),
  ...(isDevelopment
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
        },
      }
    : {}),
});

export default Logger;
