/**
 * Sentry Error Tracking
 * Initializes Sentry SDK for error tracking and performance monitoring.
 * Must be imported before any other modules in entry points.
 */

import * as Sentry from '@sentry/node';

const SENTRY_DSN = process.env.SENTRY_DSN;
const SENTRY_ENVIRONMENT = process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development';
const SENTRY_TRACES_SAMPLE_RATE = parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1');

export function initSentry(serviceName: string) {
  if (!SENTRY_DSN) {
    console.warn(`[sentry] SENTRY_DSN not set - error tracking disabled for ${serviceName}`);
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: SENTRY_ENVIRONMENT,
    release: process.env.SENTRY_RELEASE || `landomo-${serviceName}@${process.env.npm_package_version || 'unknown'}`,
    serverName: serviceName,
    tracesSampleRate: SENTRY_TRACES_SAMPLE_RATE,
    profilesSampleRate: 0,
    integrations: [
      Sentry.httpIntegration(),
    ],
    beforeSend(event) {
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
      }
      return event;
    },
    ignoreErrors: [
      'ECONNRESET',
      'EPIPE',
      'ECONNREFUSED',
    ],
  });

  Sentry.setTag('service', serviceName);

  console.info(`[sentry] Initialized for ${serviceName} (env=${SENTRY_ENVIRONMENT})`);
}

export { Sentry };
