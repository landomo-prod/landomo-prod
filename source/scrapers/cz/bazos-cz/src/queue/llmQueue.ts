/**
 * BullMQ Queue Infrastructure for LLM Extraction
 *
 * Manages the queue for processing LLM extraction jobs with:
 * - Rate limiting (60 req/min for Azure)
 * - Concurrency control (5 workers)
 * - Retry with exponential backoff (3 attempts)
 * - Reuses existing Redis connection config
 */

import { Queue, QueueEvents, ConnectionOptions } from 'bullmq';
import { LLMExtractedProperty } from '../types/llmExtraction';

/**
 * Job data for LLM extraction
 */
export interface LLMExtractionJobData {
  listingId: string;
  listingText: string;
  portal: string;
  country: string;
}

/**
 * Job result after LLM extraction
 */
export interface LLMExtractionJobResult {
  listingId: string;
  data: LLMExtractedProperty;
  isValid: boolean;
  tokensUsed?: number;
  processingTimeMs: number;
  fromCache: boolean;
}

/**
 * Queue configuration
 */
export interface LLMQueueConfig {
  concurrency: number;
  maxRetries: number;
  retryDelay: number;
  rateLimitMax: number;
  rateLimitDurationMs: number;
}

const DEFAULT_QUEUE_CONFIG: LLMQueueConfig = {
  concurrency: parseInt(process.env.LLM_QUEUE_MAX_CONCURRENT || '5', 10),
  maxRetries: parseInt(process.env.LLM_QUEUE_RETRY_ATTEMPTS || '3', 10),
  retryDelay: parseInt(process.env.LLM_QUEUE_RETRY_DELAY || '5000', 10),
  rateLimitMax: parseInt(process.env.LLM_QUEUE_RATE_LIMIT_MAX || '60', 10),
  rateLimitDurationMs: parseInt(process.env.LLM_QUEUE_RATE_LIMIT_DURATION || '60000', 10),
};

export const QUEUE_NAME = 'bazos-llm-extraction';

/**
 * Get Redis connection options from environment (reuses existing config)
 */
export function getRedisConnection(): ConnectionOptions {
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null, // Required by BullMQ
  };
}

/**
 * Get queue configuration
 */
export function getQueueConfig(): LLMQueueConfig {
  return { ...DEFAULT_QUEUE_CONFIG };
}

/**
 * LLM Extraction Queue Manager
 */
let queueInstance: Queue<LLMExtractionJobData, LLMExtractionJobResult> | null = null;
let queueEventsInstance: QueueEvents | null = null;

/**
 * Get or create the LLM extraction queue
 */
export function getLLMQueue(): Queue<LLMExtractionJobData, LLMExtractionJobResult> {
  if (!queueInstance) {
    const connection = getRedisConnection();
    queueInstance = new Queue<LLMExtractionJobData, LLMExtractionJobResult>(QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: DEFAULT_QUEUE_CONFIG.maxRetries,
        backoff: {
          type: 'exponential',
          delay: DEFAULT_QUEUE_CONFIG.retryDelay,
        },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 500 },
      },
    });
    console.log(`[LLMQueue] Queue "${QUEUE_NAME}" initialized`);
  }
  return queueInstance;
}

/**
 * Get or create queue events listener
 */
export function getLLMQueueEvents(): QueueEvents {
  if (!queueEventsInstance) {
    const connection = getRedisConnection();
    queueEventsInstance = new QueueEvents(QUEUE_NAME, { connection });
    console.log(`[LLMQueue] QueueEvents initialized`);
  }
  return queueEventsInstance;
}

/**
 * Add extraction jobs to queue in bulk
 *
 * @returns Job IDs mapped by listing ID
 */
export async function addExtractionJobs(
  listings: Array<{ id: string; title?: string; description?: string }>,
  portal: string,
  country: string
): Promise<Map<string, string>> {
  const queue = getLLMQueue();
  const jobIdMap = new Map<string, string>();

  const jobs = listings.map((listing) => {
    const listingText = listing.description
      ? `${listing.title || ''}\n\n${listing.description}`
      : listing.title || '';

    return {
      name: 'extract',
      data: {
        listingId: listing.id,
        listingText,
        portal,
        country,
      } satisfies LLMExtractionJobData,
      opts: {
        jobId: `${portal}-${listing.id}`,
      },
    };
  });

  const addedJobs = await queue.addBulk(jobs);

  for (let i = 0; i < addedJobs.length; i++) {
    jobIdMap.set(listings[i].id, addedJobs[i].id!);
  }

  console.log(`[LLMQueue] Added ${addedJobs.length} extraction jobs`);
  return jobIdMap;
}

/**
 * Wait for all jobs by their IDs to complete and collect results
 */
export async function waitForJobs(
  jobIds: Map<string, string>,
  timeoutMs: number = 300000
): Promise<Map<string, LLMExtractionJobResult>> {
  const queue = getLLMQueue();
  const queueEvents = getLLMQueueEvents();
  const results = new Map<string, LLMExtractionJobResult>();
  const pendingJobIds = new Set(jobIds.values());

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      console.warn(`[LLMQueue] Timeout after ${timeoutMs}ms, returning ${results.size}/${jobIds.size} results`);
      cleanup();
      resolve(results);
    }, timeoutMs);

    const onCompleted = async ({ jobId, returnvalue }: { jobId: string; returnvalue: string }) => {
      if (pendingJobIds.has(jobId)) {
        pendingJobIds.delete(jobId);
        // returnvalue may be a JSON string or already-parsed object depending on BullMQ version
        const result: LLMExtractionJobResult =
          typeof returnvalue === 'string' ? JSON.parse(returnvalue) : returnvalue;
        results.set(result.listingId, result);

        if (pendingJobIds.size === 0) {
          cleanup();
          resolve(results);
        }
      }
    };

    const onFailed = ({ jobId }: { jobId: string }) => {
      if (pendingJobIds.has(jobId)) {
        pendingJobIds.delete(jobId);
        if (pendingJobIds.size === 0) {
          cleanup();
          resolve(results);
        }
      }
    };

    function cleanup() {
      clearTimeout(timeout);
      queueEvents.off('completed', onCompleted);
      queueEvents.off('failed', onFailed);
    }

    queueEvents.on('completed', onCompleted);
    queueEvents.on('failed', onFailed);

    // Check if any jobs are already completed
    (async () => {
      for (const [listingId, jobId] of jobIds) {
        const job = await queue.getJob(jobId);
        if (job) {
          const state = await job.getState();
          if (state === 'completed' && job.returnvalue) {
            pendingJobIds.delete(jobId);
            results.set(listingId, job.returnvalue as LLMExtractionJobResult);
          } else if (state === 'failed') {
            pendingJobIds.delete(jobId);
          }
        }
      }

      if (pendingJobIds.size === 0) {
        cleanup();
        resolve(results);
      }
    })();
  });
}

/**
 * Gracefully close queue connections
 */
export async function closeLLMQueue(): Promise<void> {
  if (queueEventsInstance) {
    await queueEventsInstance.close();
    queueEventsInstance = null;
  }
  if (queueInstance) {
    await queueInstance.close();
    queueInstance = null;
  }
  console.log('[LLMQueue] Queue closed');
}
