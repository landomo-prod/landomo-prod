/**
 * Landomo Core Service
 * Centralized REST API for property data ingestion
 */

import { initSentry } from './sentry';
initSentry('ingest-api');

import Fastify from 'fastify';
import { config } from './config';
import { ingestRoute } from './routes/ingest';
import { bulkIngestRoute } from './routes/bulk-ingest';
import { healthRoute } from './routes/health';
import { scrapeRunsRoute } from './routes/scrape-runs';
import { authVerifyRoute } from './routes/auth-verify';
import { metricsRoute } from './routes/metrics';
import checksumRoutes from './routes/checksums';
import { errorHandler } from './middleware/error-handler';
import { authMiddleware } from './middleware/auth';
import { inputSanitizerHook } from './middleware/input-sanitizer';
import { rateLimiterHook, initRateLimitRedis } from './middleware/rate-limiter';
import { metricsOnRequest, metricsOnResponse } from './metrics/middleware';
import { requestIdOnRequest } from './middleware/request-id';
import { apiVersionOnResponse } from './middleware/api-version';
import { ipWhitelistHook } from './middleware/ip-whitelist';
import { securityLoggerOnRequest, securityLoggerOnResponse } from './middleware/security-logger';
import { apiVersionsRoute } from './routes/api-versions';
import { dataQualityRoute } from './routes/data-quality';
import { apiUsageRoute } from './routes/api-usage';
import { monitoringDashboardRoute } from './routes/monitoring-dashboard';
import { adminRoute } from './routes/admin';
import { fastifyLoggerOptions, genReqId } from './logger';
import { startQueueMetricsCollector } from './metrics/queue-metrics';

const fastify = Fastify({
  logger: fastifyLoggerOptions,
  genReqId,
  bodyLimit: 50 * 1024 * 1024, // 50MB - bulk-ingest batches with raw_data can be large
});

// Request ID correlation (first hook so response always includes X-Request-ID)
fastify.addHook('onRequest', requestIdOnRequest);

// Metrics instrumentation (before auth so it captures all requests)
fastify.addHook('onRequest', metricsOnRequest);
fastify.addHook('onResponse', metricsOnResponse);

// API versioning headers
fastify.addHook('onResponse', apiVersionOnResponse);

// Security logging (before auth so it captures all requests including rejected ones)
fastify.addHook('onRequest', securityLoggerOnRequest);
fastify.addHook('onResponse', securityLoggerOnResponse);

// Middleware
fastify.addHook('onRequest', ipWhitelistHook);
fastify.addHook('onRequest', authMiddleware);
fastify.addHook('onRequest', rateLimiterHook);
fastify.addHook('preHandler', inputSanitizerHook);
fastify.setErrorHandler(errorHandler);

// Routes
fastify.register(healthRoute);
fastify.register(ingestRoute);
fastify.register(bulkIngestRoute);
fastify.register(scrapeRunsRoute);
fastify.register(authVerifyRoute);
fastify.register(metricsRoute);
fastify.register(apiVersionsRoute);
fastify.register(dataQualityRoute);
fastify.register(checksumRoutes);
fastify.register(monitoringDashboardRoute);
fastify.register(apiUsageRoute);
fastify.register(adminRoute);

// Start server
async function start() {
  try {
    // Initialize rate limiter Redis (best-effort, fails open if unavailable)
    await initRateLimitRedis().catch(() => {
      fastify.log.warn('Rate limiter Redis unavailable - rate limiting disabled');
    });

    await fastify.listen({
      port: config.port,
      host: config.host,
    });

    // Start queue metrics collector (every 15 seconds)
    startQueueMetricsCollector(config.instance.country);

    fastify.log.info({ host: config.host, port: config.port }, 'Core Service started');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();
