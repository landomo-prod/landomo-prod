/**
 * Search Service Server
 *
 * Main entry point for the Landomo Search Service.
 * Provides federated search across all country databases.
 */

import { initSentry } from './sentry';
initSentry('search-service');

import Fastify from 'fastify';
import { config, validateConfig, logConfig } from './config';
import { initializeConnections, closeAllConnections } from './database/multi-db-manager';
import { initializeRedis, initializeSubscriber, closeRedis } from './cache/redis-manager';
import { invalidateCountryCaches } from './cache/cache-strategies';
import { refreshFilterOptions, scheduleFilterRefresh } from './cache/filter-options-refresher';
import { searchRoutes } from './routes/search';
import { propertyRoutes } from './routes/property';
import { aggregationRoutes } from './routes/aggregations';
import { filtersRoutes } from './routes/filters';
import { healthRoutes } from './routes/health';
import { geoSearchRoutes } from './routes/geo-search';
import { mapRoutes } from './routes/map';
import { priceTrendsRoutes } from './routes/price-trends';
import { cacheRoutes } from './routes/cache';
import { metricsRoutes } from './routes/metrics';
import { boundaryRoutes } from './routes/boundaries';
import { locationRoutes } from './routes/locations';
import { registerMetricsMiddleware } from './metrics/middleware';
import { searchValidatorHook } from './middleware/search-validator';
import { rateLimiterHook, initRateLimitRedis } from './middleware/rate-limiter';
import { requestIdOnRequest } from './middleware/request-id';
import { apiVersionOnResponse } from './middleware/api-version';
import { apiVersionsRoutes } from './routes/api-versions';
import { fastifyLoggerOptions, genReqId, serverLog } from './logger';
import { graphqlServer } from './graphql/server';

// Create Fastify instance
const fastify = Fastify({
  logger: fastifyLoggerOptions,
  genReqId,
});

/**
 * Initialize all services
 */
async function initialize(): Promise<void> {
  serverLog.info('Starting Landomo Search Service');

  // Validate configuration
  serverLog.info('Validating configuration');
  validateConfig();
  logConfig();

  // Initialize database connections
  serverLog.info('Initializing database connections');
  initializeConnections();

  // Initialize Redis
  serverLog.info('Initializing Redis cache');
  await initializeRedis();

  // Initialize Redis pub/sub subscriber for cache invalidation (best-effort)
  serverLog.info('Initializing cache invalidation subscriber');
  await initializeSubscriber(async (country: string) => {
    await invalidateCountryCaches(country);
    scheduleFilterRefresh([country]); // debounced 5-min refresh after ingest burst
  }).catch((err) => {
    serverLog.warn({ err }, 'Cache invalidation subscriber unavailable - pub/sub disabled');
  });

  // Initialize rate limiter Redis (best-effort, fails open if unavailable)
  serverLog.info('Initializing rate limiter');
  await initRateLimitRedis().catch(() => {
    serverLog.warn('Rate limiter Redis unavailable - rate limiting disabled');
  });

  // Request ID correlation (first hook so response always includes X-Request-ID)
  fastify.addHook('onRequest', requestIdOnRequest);

  // Register metrics middleware (must be before routes)
  serverLog.info('Registering metrics middleware');
  registerMetricsMiddleware(fastify);

  // API versioning headers
  fastify.addHook('onResponse', apiVersionOnResponse);

  // Rate limiting (per-IP, before route handlers)
  fastify.addHook('onRequest', rateLimiterHook);

  // Input validation (runs before route handlers)
  fastify.addHook('preHandler', searchValidatorHook);

  // Register routes
  serverLog.info('Registering routes');
  await fastify.register(healthRoutes);
  await fastify.register(searchRoutes);
  await fastify.register(propertyRoutes);
  await fastify.register(aggregationRoutes);
  await fastify.register(filtersRoutes);
  await fastify.register(geoSearchRoutes);
  await fastify.register(mapRoutes);
  await fastify.register(priceTrendsRoutes);
  await fastify.register(boundaryRoutes);
  await fastify.register(locationRoutes);
  await fastify.register(cacheRoutes);
  await fastify.register(metricsRoutes);
  await fastify.register(apiVersionsRoutes);

  // Register GraphQL endpoint
  serverLog.info('Registering GraphQL endpoint');
  await fastify.register(graphqlServer, {
    prefix: '/graphql',
    graphiql: config.server.env === 'development',
  });

  // CORS support with origin whitelist
  const corsOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  const defaultOrigins = [
    'https://app.landomo.com',
    'https://www.landomo.com',
    'https://landomo.com',
  ];
  // In development, also allow local origins
  if (config.server.env === 'development') {
    defaultOrigins.push('http://localhost:3000', 'http://localhost:5173');
  }
  const allowedOrigins = corsOrigins.length > 0 ? corsOrigins : defaultOrigins;

  await fastify.register(import('@fastify/cors'), {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Country', 'X-API-Key', 'X-Request-ID'],
    exposedHeaders: ['X-Request-ID', 'API-Version', 'Deprecation', 'Sunset', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset', 'Retry-After', 'ETag'],
    credentials: true,
    maxAge: 86400,
  });

  serverLog.info('Initialization complete');
}

/**
 * Graceful shutdown
 */
async function shutdown(): Promise<void> {
  serverLog.info('Shutting down gracefully');

  try {
    // Close Fastify
    await fastify.close();
    serverLog.info('HTTP server closed');

    // Close database connections
    await closeAllConnections();

    // Close Redis
    await closeRedis();

    serverLog.info('Shutdown complete');
    process.exit(0);
  } catch (error) {
    serverLog.error({ err: error }, 'Error during shutdown');
    process.exit(1);
  }
}

/**
 * Start server
 */
async function start(): Promise<void> {
  try {
    // Initialize services
    await initialize();

    // Start server
    await fastify.listen({
      port: config.server.port,
      host: config.server.host
    });

    serverLog.info(
      { host: config.server.host, port: config.server.port },
      'Search Service listening'
    );

    // Pre-warm filter options in the background (non-blocking)
    refreshFilterOptions().catch((err) =>
      serverLog.warn({ err }, 'Startup filter pre-warm failed')
    );

    // Handle shutdown signals
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (error) {
    serverLog.fatal({ err: error }, 'Failed to start server');
    process.exit(1);
  }
}

// Start the server
start();

// Export for testing
export { fastify };
