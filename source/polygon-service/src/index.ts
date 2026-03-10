/**
 * Polygon Service
 * Administrative boundary polygon service with Overpass sync
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from './config';
import { initializeSchema, testConnection, closeDatabase } from './database/manager';
import { healthRoutes } from './routes/health';
import { boundariesRoutes } from './routes/boundaries';
import { syncRoutes } from './routes/sync';
import { authenticateApiKey } from './middleware/auth';
import pino from 'pino';

const logger = pino({
  level: config.logging.level,
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
    },
  },
  base: { service: 'polygon-service' },
});

async function start() {
  const fastify = Fastify({
    logger: logger as any,
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'requestId',
  });

  try {
    // CORS
    await fastify.register(cors, {
      origin: true,
      credentials: true,
    });

    // Health routes (no auth)
    await fastify.register(healthRoutes);

    // Protected routes (with auth)
    await fastify.register(async (instance) => {
      instance.addHook('preHandler', authenticateApiKey);
      await instance.register(boundariesRoutes);
      await instance.register(syncRoutes);
    });

    // Initialize database
    logger.info('Initializing database schema...');
    await initializeSchema();

    // Test database connection
    const dbHealthy = await testConnection();
    if (!dbHealthy) {
      logger.warn('Database connection test failed - service may be degraded');
    } else {
      logger.info('Database connection OK');
    }

    // Start server
    await fastify.listen({
      port: config.server.port,
      host: config.server.host,
    });

    logger.info({
      port: config.server.port,
      host: config.server.host,
      database: config.database.database,
    }, 'Polygon service started');

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info({ signal }, 'Shutting down...');
      await fastify.close();
      await closeDatabase();
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    logger.error({ error }, 'Failed to start service');
    process.exit(1);
  }
}

start();
