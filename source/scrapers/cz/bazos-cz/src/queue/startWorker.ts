/**
 * LLM Extraction Worker Startup Script
 *
 * Run standalone: ts-node src/queue/startWorker.ts
 * Or compiled:    node dist/queue/startWorker.js
 *
 * Environment variables:
 *   REDIS_HOST, REDIS_PORT, REDIS_PASSWORD - Redis connection
 *   AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY - LLM API
 *   LLM_QUEUE_CONCURRENCY (default: 5)
 *   LLM_RATE_LIMIT_MAX (default: 60)
 *   LLM_RATE_LIMIT_DURATION_MS (default: 60000)
 */

import dotenv from 'dotenv';
dotenv.config();

import { createLLMWorker, closeLLMWorker, getWorkerMetrics } from './llmWorker';

console.log('[StartWorker] Bazos LLM Extraction Worker starting...');
console.log(`[StartWorker] Redis: ${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || '6379'}`);

const worker = createLLMWorker();

// Periodic metrics logging
const metricsInterval = setInterval(() => {
  const m = getWorkerMetrics();
  if (m.processed > 0) {
    console.log(`[StartWorker] Metrics: ${m.processed} processed, ${m.succeeded} succeeded, ${m.failed} failed, ${m.cacheHits} cache hits, avg ${m.avgProcessingMs}ms`);
  }
}, 30000);

// Graceful shutdown
async function shutdown(signal: string) {
  console.log(`[StartWorker] Received ${signal}, shutting down...`);
  clearInterval(metricsInterval);
  await closeLLMWorker();
  console.log('[StartWorker] Final metrics:', getWorkerMetrics());
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

console.log('[StartWorker] Worker running. Press Ctrl+C to stop.');
