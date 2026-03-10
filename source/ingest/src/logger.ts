/**
 * Structured JSON Logger
 * Pino-based logging with request ID correlation, child loggers per module,
 * and sensitive field redaction.
 */

import pino from 'pino';
import { config } from './config';

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

/**
 * Base logger instance for non-HTTP contexts (workers, config, startup).
 */
export const logger = pino({
  level: LOG_LEVEL,
  redact: {
    paths: [
      'password',
      'db_password',
      'api_key',
      'apiKey',
      'authorization',
      'token',
      'redis.password',
      'database.password',
    ],
    censor: '[REDACTED]',
  },
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  base: {
    service: 'ingest-service',
    country: config.instance.country,
  },
});

/**
 * Pino options passed to Fastify's built-in logger for HTTP request logging.
 * Includes request ID correlation via X-Request-ID header.
 */
export const fastifyLoggerOptions: pino.LoggerOptions = {
  level: LOG_LEVEL,
  redact: {
    paths: [
      'req.headers.authorization',
      'password',
      'db_password',
      'api_key',
      'apiKey',
      'token',
      'redis.password',
      'database.password',
    ],
    censor: '[REDACTED]',
  },
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  base: {
    service: 'ingest-service',
    country: config.instance.country,
  },
  serializers: {
    req(request) {
      return {
        method: request.method,
        url: request.url,
        requestId: request.id,
      };
    },
    res(reply) {
      return {
        statusCode: reply.statusCode,
      };
    },
  },
};

/**
 * Fastify genReqId function: uses X-Request-ID header if present, otherwise
 * lets Fastify generate one.
 */
let reqCounter = 0;
export function genReqId(req: { headers: Record<string, string | string[] | undefined> }): string {
  return (req.headers['x-request-id'] as string) || `req-${++reqCounter}`;
}

// Child loggers per module
export const ingestLog = logger.child({ module: 'ingest' });
export const workerLog = logger.child({ module: 'worker' });
export const stalenessLog = logger.child({ module: 'staleness' });
export const dbLog = logger.child({ module: 'database' });
export const authLog = logger.child({ module: 'auth' });
export const configLog = logger.child({ module: 'config' });
export const queueLog = logger.child({ module: 'queue' });
export const dataQualityLog = logger.child({ module: 'data-quality' });
