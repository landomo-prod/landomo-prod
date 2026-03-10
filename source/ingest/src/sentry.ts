/**
 * Sentry Error Tracking
 */

import * as Sentry from '@sentry/node';

export function initSentry(serviceName: string) {
  const dsn = process.env.SENTRY_DSN;

  if (!dsn) {
    console.warn(JSON.stringify({ level: 'warn', service: 'ingest-service', msg: 'No SENTRY_DSN set - error tracking disabled', serviceName }));
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT || 'production',
    serverName: serviceName,
    tracesSampleRate: 0.1,
  });

  console.log(JSON.stringify({ level: 'info', service: 'ingest-service', msg: 'Sentry initialized', serviceName, env: process.env.SENTRY_ENVIRONMENT || 'production' }));
}

export { Sentry };
