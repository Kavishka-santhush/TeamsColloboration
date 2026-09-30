const winston = require('winston');
const env = require('../config/env');

/**
 * Application-wide structured logger (winston).
 * - Console: colorized, human readable in dev; JSON in production.
 */
const logger = winston.createLogger({
  level: env.nodeEnv === 'production' ? 'info' : 'debug',
  format:
    env.nodeEnv === 'production'
      ? winston.format.combine(winston.format.timestamp(), winston.format.json())
      : winston.format.combine(
          winston.format.colorize(),
          winston.format.timestamp({ format: 'HH:mm:ss' }),
          winston.format.printf(({ timestamp, level, message, ...meta }) => {
            const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
            return `${timestamp} ${level}: ${message}${extra}`;
          }),
        ),
  transports: [new winston.transports.Console()],
});

module.exports = logger;
