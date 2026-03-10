/**
 * BullMQ Worker for LLM Extraction
 *
 * Processes LLM extraction jobs from the queue with:
 * - Rate limiting (60 req/min)
 * - Concurrency (5 parallel workers)
 * - Cache integration (skip already-cached extractions)
 * - Retry with exponential backoff
 * - Metrics tracking
 */

import { Worker, Job, RateLimiterOptions } from 'bullmq';
import {
  QUEUE_NAME,
  getRedisConnection,
  getQueueConfig,
  LLMExtractionJobData,
  LLMExtractionJobResult,
} from './llmQueue';
import { getLLMExtractor } from '../services/bazosLLMExtractor';
import { getExtractionCache } from '../services/extractionCache';

/**
 * Worker metrics
 */
const metrics = {
  processed: 0,
  succeeded: 0,
  failed: 0,
  cacheHits: 0,
  totalTokens: 0,
  totalProcessingMs: 0,
  startTime: Date.now(),
};

/**
 * Get worker metrics snapshot
 */
export function getWorkerMetrics() {
  const uptime = (Date.now() - metrics.startTime) / 1000;
  return {
    ...metrics,
    uptimeSeconds: uptime,
    avgProcessingMs: metrics.processed > 0 ? Math.round(metrics.totalProcessingMs / metrics.processed) : 0,
    successRate: metrics.processed > 0 ? ((metrics.succeeded / metrics.processed) * 100).toFixed(1) + '%' : 'N/A',
  };
}

/**
 * Process a single LLM extraction job
 */
async function processExtractionJob(
  job: Job<LLMExtractionJobData, LLMExtractionJobResult>
): Promise<LLMExtractionJobResult> {
  const { listingId, listingText, portal } = job.data;
  const startTime = Date.now();

  metrics.processed++;
  console.log(`[LLMWorker] Processing job ${job.id} (listing: ${listingId})`);

  // Check cache first
  const cache = getExtractionCache();
  const cached = await cache.get(portal, listingId, listingText);

  if (cached) {
    metrics.cacheHits++;
    metrics.succeeded++;
    const processingTimeMs = Date.now() - startTime;
    metrics.totalProcessingMs += processingTimeMs;

    console.log(`[LLMWorker] Cache hit for ${listingId}`);
    return {
      listingId,
      data: cached,
      isValid: true,
      processingTimeMs,
      fromCache: true,
    };
  }

  // Extract with LLM
  const extractor = getLLMExtractor();
  const result = await extractor.extract(listingText);
  const processingTimeMs = Date.now() - startTime;
  metrics.totalProcessingMs += processingTimeMs;

  if (result.validation.isValid) {
    // Store in cache
    await cache.set(portal, listingId, listingText, result.data, {
      durationMs: processingTimeMs,
      tokensUsed: result.tokensUsed || 0,
    });

    metrics.succeeded++;
    if (result.tokensUsed) metrics.totalTokens += result.tokensUsed;

    console.log(`[LLMWorker] Extracted ${listingId} in ${processingTimeMs}ms (${result.tokensUsed || 0} tokens)`);
  } else {
    metrics.failed++;
    console.warn(`[LLMWorker] Validation failed for ${listingId}:`, result.validation.errors);
  }

  await job.updateProgress(100);

  return {
    listingId,
    data: result.data,
    isValid: result.validation.isValid,
    tokensUsed: result.tokensUsed,
    processingTimeMs,
    fromCache: false,
  };
}

/**
 * Create and start the LLM extraction worker
 */
let workerInstance: Worker<LLMExtractionJobData, LLMExtractionJobResult> | null = null;

export function createLLMWorker(): Worker<LLMExtractionJobData, LLMExtractionJobResult> {
  if (workerInstance) return workerInstance;

  const connection = getRedisConnection();
  const config = getQueueConfig();

  const limiter: RateLimiterOptions = {
    max: config.rateLimitMax,
    duration: config.rateLimitDurationMs,
  };

  workerInstance = new Worker<LLMExtractionJobData, LLMExtractionJobResult>(
    QUEUE_NAME,
    processExtractionJob,
    {
      connection,
      concurrency: config.concurrency,
      limiter,
    }
  );

  workerInstance.on('completed', (job) => {
    console.log(`[LLMWorker] Job ${job.id} completed`);
  });

  workerInstance.on('failed', (job, error) => {
    metrics.failed++;
    console.error(`[LLMWorker] Job ${job?.id} failed:`, error.message);
  });

  workerInstance.on('error', (error) => {
    console.error('[LLMWorker] Worker error:', error.message);
  });

  console.log(`[LLMWorker] Worker started (concurrency: ${config.concurrency}, rate limit: ${config.rateLimitMax}/${config.rateLimitDurationMs}ms)`);

  return workerInstance;
}

/**
 * Gracefully close the worker
 */
export async function closeLLMWorker(): Promise<void> {
  if (workerInstance) {
    await workerInstance.close();
    workerInstance = null;
    console.log('[LLMWorker] Worker closed');
    console.log('[LLMWorker] Final metrics:', getWorkerMetrics());
  }
}
