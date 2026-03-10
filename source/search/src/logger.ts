/**
 * Structured JSON Logger
 * Pino-based logging with request ID correlation, child loggers per module,
 * and sensitive field redaction.
 */

import pino from 'pino';

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

/**
 * Base logger instance for non-HTTP contexts (startup, database, cache).
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
      'database.readOnlyPassword',
    ],
    censor: '[REDACTED]',
  },
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  base: {
    service: 'search-service',
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
      'database.readOnlyPassword',
    ],
    censor: '[REDACTED]',
  },
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  base: {
    service: 'search-service',
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
export const serverLog = logger.child({ module: 'server' });
export const configLog = logger.child({ module: 'config' });
export const dbLog = logger.child({ module: 'database' });
export const cacheLog = logger.child({ module: 'cache' });
export const searchLog = logger.child({ module: 'search' });
export const geoLog = logger.child({ module: 'geo' });
export const routeLog = logger.child({ module: 'routes' });
export const federationLog = logger.child({ module: 'federation' });
