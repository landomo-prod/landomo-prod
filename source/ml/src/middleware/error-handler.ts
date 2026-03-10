import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { serverLog } from '../logger';

export class ModelNotFoundError extends Error {
  statusCode = 404;
  constructor(country: string, category: string) {
    super(`No active model found for ${country}/${category}`);
    this.name = 'ModelNotFoundError';
  }
}

export class InsufficientDataError extends Error {
  statusCode = 422;
  constructor(message: string) {
    super(message);
    this.name = 'InsufficientDataError';
  }
}

export class PredictionTimeoutError extends Error {
  statusCode = 503;
  constructor() {
    super('Prediction timed out');
    this.name = 'PredictionTimeoutError';
  }
}

export class InvalidFeaturesError extends Error {
  statusCode = 400;
  constructor(message: string) {
    super(message);
    this.name = 'InvalidFeaturesError';
  }
}

export function errorHandler(
  error: FastifyError,
  _request: FastifyRequest,
  reply: FastifyReply
): void {
  const statusCode = (error as unknown as { statusCode?: number }).statusCode || 500;

  if (statusCode >= 500) {
    serverLog.error({ err: error }, 'Internal server error');
  }

  reply.status(statusCode).send({
    error: error.name || 'InternalServerError',
    message: error.message,
    statusCode,
  });
}
