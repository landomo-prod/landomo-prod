import express from 'express';
import Redis from 'ioredis';
import { config } from './config';
import { logger } from './logger';
import { initializeChannels } from './channels';
import { EventListener } from './event-listener';
import { WatchdogEvaluator } from './watchdog-evaluator';
import { NotificationRouter } from './notification-router';
import { createEvaluateQueue, createDispatchQueue, createDigestQueue } from './queues';
import { startEvaluateWorker } from './queues/evaluate-worker';
import { startDispatchWorker } from './queues/dispatch-worker';
import { startDigestWorker } from './queues/digest-worker';
import { register } from './metrics';

async function main() {
  logger.info({ country: config.country }, 'starting notification service');

  // Initialize channel registry
  initializeChannels();

  // Create BullMQ queues
  const evaluateQueue = createEvaluateQueue();
  const dispatchQueue = createDispatchQueue();
  const digestQueue = createDigestQueue();

  // Initialize watchdog evaluator (loads watchdogs into memory)
  const evaluator = new WatchdogEvaluator();
  await evaluator.start();

  // Create Redis client for deduplication
  const dedupRedis = new Redis({
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    maxRetriesPerRequest: null,
    retryStrategy: (times) => Math.min(times * 500, 5000),
  });
  dedupRedis.on('error', (err) => {
    logger.error({ err: err.message }, 'dedup redis error');
  });

  // Initialize notification router (uses Redis-backed dedup)
  const router = new NotificationRouter(dispatchQueue, dedupRedis);

  // Start BullMQ workers
  const evalWorker = startEvaluateWorker(evaluator, router);
  const dispatchWorker = startDispatchWorker();
  const digestWorker = startDigestWorker();

  // Schedule digest cron jobs
  await digestQueue.upsertJobScheduler('hourly-digest', {
    pattern: '0 * * * *',
  }, { name: 'digest', data: { period: 'hourly' as const } });

  await digestQueue.upsertJobScheduler('daily-digest', {
    pattern: '0 7 * * *', // 07:00 UTC = 08:00 CET
  }, { name: 'digest', data: { period: 'daily' as const } });

  await digestQueue.upsertJobScheduler('weekly-digest', {
    pattern: '0 7 * * 1', // Monday 07:00 UTC
  }, { name: 'digest', data: { period: 'weekly' as const } });

  // Start Redis event listener
  const listener = new EventListener(evaluateQueue);
  await listener.start();

  // HTTP server for health checks and management
  const app = express();
  app.use(express.json());

  app.get('/metrics', async (_req, res) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  });

  app.get('/health', (_req, res) => {
    res.json({
      status: 'healthy',
      country: config.country,
      uptime: process.uptime(),
      watchdogs: evaluator.getStats(),
    });
  });

  // Force refresh watchdogs
  app.post('/watchdogs/refresh', async (_req, res) => {
    await evaluator.refresh();
    res.json({ status: 'refreshed', stats: evaluator.getStats() });
  });

  // Telegram webhook (only if bot token configured)
  if (config.telegram.botToken) {
    const { createTelegramWebhookHandler } = await import('./channels/telegram-bot');
    app.post('/webhooks/telegram', createTelegramWebhookHandler());
    logger.info('telegram webhook registered at POST /webhooks/telegram');
  }

  const server = app.listen(config.server.port, config.server.host, () => {
    logger.info({ host: config.server.host, port: config.server.port }, 'HTTP server listening');
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'received shutdown signal');
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await listener.stop();
    await dedupRedis.quit();
    await evaluator.stop();
    await evalWorker.close();
    await dispatchWorker.close();
    await digestWorker.close();
    await evaluateQueue.close();
    await dispatchQueue.close();
    await digestQueue.close();
    logger.info('shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.fatal({ err }, 'fatal error');
  process.exit(1);
});
