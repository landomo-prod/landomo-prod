/**
 * Global Error Handler
 */

import { FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import { Sentry } from '../sentry';

export function errorHandler(error: FastifyError, request: FastifyRequest, reply: FastifyReply) {
  request.log.error(error);

  const statusCode = error.statusCode || 500;

  // Report 5xx errors to Sentry
  if (statusCode >= 500) {
    Sentry.withScope((scope) => {
      scope.setTag('route', request.url);
      scope.setTag('method', request.method);
      scope.setExtra('requestId', request.id);
      Sentry.captureException(error);
    });
  }

  // For 4xx errors, safe to return the error message to the client.
  // For 5xx errors, use a generic message to avoid leaking internal details.
  const message = statusCode < 500
    ? (error.message || 'Bad request')
    : 'An unexpected error occurred';

  reply.status(statusCode).send({
    error: statusCode < 500 ? (error.name || 'ClientError') : 'InternalServerError',
    message,
    statusCode,
  });
}
