import pino from 'pino';

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

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
    ],
    censor: '[REDACTED]',
  },
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  base: {
    service: 'ml-pricing-service',
  },
});

export const fastifyLoggerOptions: pino.LoggerOptions = {
  level: LOG_LEVEL,
  redact: {
    paths: [
      'req.headers.authorization',
      'password',
      'api_key',
      'token',
    ],
    censor: '[REDACTED]',
  },
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  base: {
    service: 'ml-pricing-service',
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

let reqCounter = 0;
export function genReqId(req: { headers: Record<string, string | string[] | undefined> }): string {
  return (req.headers['x-request-id'] as string) || `req-${++reqCounter}`;
}

export const serverLog = logger.child({ module: 'server' });
export const configLog = logger.child({ module: 'config' });
export const dbLog = logger.child({ module: 'database' });
export const cacheLog = logger.child({ module: 'cache' });
export const modelLog = logger.child({ module: 'model' });
export const predictionLog = logger.child({ module: 'prediction' });
export const authLog = logger.child({ module: 'auth' });
