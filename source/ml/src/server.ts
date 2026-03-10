import Fastify from 'fastify';
import cors from '@fastify/cors';
import { fastifyLoggerOptions, genReqId, serverLog } from './logger';
import { config } from './config';
import { initializeConnections, closeAllConnections } from './database/multi-db-manager';
import { initializeRedis, initializeSubscriber, closeRedis } from './cache/redis-manager';
import { authMiddleware } from './middleware/auth';
import { errorHandler } from './middleware/error-handler';
import { healthRoutes } from './routes/health';
import { predictionRoutes } from './routes/predictions';
import { modelRoutes } from './routes/models';
import { invalidateModelCache } from './services/model-loader';

async function start(): Promise<void> {
  const fastify = Fastify({
    logger: fastifyLoggerOptions,
    genReqId,
    requestTimeout: 30000,
  });

  // Plugins
  await fastify.register(cors, { origin: true });

  // Middleware
  fastify.addHook('onRequest', authMiddleware);

  // Error handler
  fastify.setErrorHandler(errorHandler);

  // Routes
  await fastify.register(healthRoutes);
  await fastify.register(predictionRoutes);
  await fastify.register(modelRoutes);

  // Initialize infrastructure
  serverLog.info('Initializing database connections...');
  initializeConnections();

  serverLog.info('Initializing Redis...');
  await initializeRedis();

  // Subscribe to model update notifications
  await initializeSubscriber(async (country, category) => {
    await invalidateModelCache(country, category);
  });

  // Graceful shutdown
  const shutdown = async (signal: string): Promise<void> => {
    serverLog.info({ signal }, 'Shutting down');
    await fastify.close();
    await closeAllConnections();
    await closeRedis();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Start server
  await fastify.listen({
    port: config.server.port,
    host: config.server.host,
  });

  serverLog.info({
    port: config.server.port,
    host: config.server.host,
    countries: config.countries.map(c => c.code),
  }, 'ML Pricing Service started');
}

start().catch((err) => {
  serverLog.fatal({ err }, 'Failed to start ML Pricing Service');
  process.exit(1);
});
