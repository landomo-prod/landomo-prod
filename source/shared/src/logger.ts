/**
 * Structured JSON Logger for Landomo services and scrapers.
 *
 * Uses pino for fast, structured JSON logging with standard fields:
 * - timestamp, level, service, country, portal, module, message
 * - Optional correlation_id for request tracing
 *
 * Usage:
 *   import { createLogger } from '@landomo/core';
 *   const logger = createLogger({ service: 'sreality-scraper', portal: 'sreality', country: 'czech_republic' });
 *   logger.info({ listings: 42 }, 'Discovery complete');
 *   logger.error({ err }, 'Scrape failed');
 *
 *   // Child logger for a module
 *   const transformLog = logger.child({ module: 'transformer' });
 *   transformLog.info({ category: 'apartment' }, 'Transforming listing');
 */

import pino from 'pino';

export interface LoggerOptions {
  service: string;
  country?: string;
  portal?: string;
  level?: string;
}

const REDACT_PATHS = [
  'password',
  'db_password',
  'api_key',
  'apiKey',
  'authorization',
  'token',
  'redis.password',
  'database.password',
];

/**
 * Create a structured pino logger with standard Landomo fields.
 */
export function createLogger(opts: LoggerOptions): pino.Logger {
  const level = opts.level || process.env.LOG_LEVEL || 'info';

  const base: Record<string, string> = { service: opts.service };
  if (opts.country) base.country = opts.country;
  if (opts.portal) base.portal = opts.portal;

  return pino({
    level,
    redact: {
      paths: REDACT_PATHS,
      censor: '[REDACTED]',
    },
    formatters: {
      level(label) {
        return { level: label };
      },
    },
    base,
  });
}
