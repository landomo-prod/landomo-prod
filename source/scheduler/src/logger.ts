/**
 * Structured JSON Logger
 * Pino-based logging for the scheduler service with scraper context.
 */

import pino from 'pino';

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

/**
 * Base logger instance.
 */
export const logger = pino({
  level: LOG_LEVEL,
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  base: {
    service: 'scheduler',
  },
});

// Child loggers per concern
export const cronLog = logger.child({ module: 'cron' });
export const triggerLog = logger.child({ module: 'trigger' });
export const httpLog = logger.child({ module: 'http' });
