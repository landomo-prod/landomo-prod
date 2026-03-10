/**
 * Polygon Sync Worker
 * Scheduled BullMQ job that syncs administrative boundaries from polygon-service.
 * Runs monthly per country to keep boundary data up to date.
 */

import { Queue, Worker } from 'bullmq';
import { config } from '../config';
import { workerLog } from '../logger';

const QUEUE_NAME = `polygon-sync-${config.instance.country}`;

// Default monthly sync (1st of each month at 2am)
const DEFAULT_CRON_PATTERN = '0 2 1 * *';

interface PolygonSyncJobData {
  country: string;
  countryCode: string; // ISO 3166-1 alpha-2 (CZ, SK, HU, etc.)
}

interface PolygonServiceConfig {
  url: string;
  apiKey: string;
  timeout: number;
}

/**
 * Get polygon service configuration from environment
 */
function getPolygonServiceConfig(): PolygonServiceConfig {
  return {
    url: process.env.POLYGON_SERVICE_URL || 'http://polygon-service:3100',
    apiKey: process.env.POLYGON_SERVICE_API_KEY || '',
    timeout: parseInt(process.env.POLYGON_SERVICE_TIMEOUT || '300000', 10), // 5 minutes default
  };
}

/**
 * Map country names to ISO 3166-1 alpha-2 codes
 */
function getCountryCode(country: string): string {
  const countryMap: Record<string, string> = {
    'czech': 'CZ',
    'czech_republic': 'CZ',
    'czechia': 'CZ',
    'slovakia': 'SK',
    'hungary': 'HU',
    'germany': 'DE',
    'austria': 'AT',
    'poland': 'PL',
    'france': 'FR',
    'spain': 'ES',
    'italy': 'IT',
    'uk': 'GB',
    'united_kingdom': 'GB',
    'usa': 'US',
    'united_states': 'US',
    'australia': 'AU',
  };

  const normalizedCountry = country.toLowerCase().replace(/[^a-z]/g, '_');
  return countryMap[normalizedCountry] || country.toUpperCase().substring(0, 2);
}

/**
 * Trigger polygon sync via polygon-service API
 */
async function triggerPolygonSync(countryCode: string): Promise<any> {
  const polygonConfig = getPolygonServiceConfig();

  if (!polygonConfig.apiKey) {
    workerLog.warn({ countryCode }, 'POLYGON_SERVICE_API_KEY not set - skipping polygon sync');
    return { skipped: true, reason: 'API key not configured' };
  }

  try {
    workerLog.info({ countryCode, url: polygonConfig.url }, 'Triggering polygon sync via API');

    // Use fetch instead of axios to avoid dependency
    const response = await fetch(
      `${polygonConfig.url}/api/v1/sync/overpass`,
      {
        method: 'POST',
        headers: {
          'X-API-Key': polygonConfig.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          countryCode,
          adminLevels: [2, 4, 6, 8, 9, 10], // Country, region, county, city, district, neighborhood
          skipRecent: true, // Skip areas updated in last 30 days
        }),
        signal: AbortSignal.timeout(polygonConfig.timeout),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      workerLog.error({
        countryCode,
        status: response.status,
        data: errorData,
      }, 'Polygon sync API error');
      throw new Error(`Polygon sync failed: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    const data = await response.json() as any;

    workerLog.info({
      countryCode,
      areasProcessed: data.areasProcessed,
      areasCreated: data.areasCreated,
      areasUpdated: data.areasUpdated,
      durationMs: data.durationMs,
    }, 'Polygon sync completed successfully');

    return data;
  } catch (error: any) {
    workerLog.error({ countryCode, error: error.message }, 'Polygon sync error');
    throw error;
  }
}

/**
 * Start the polygon sync checker: creates a scheduled repeatable job
 * and a worker to process it.
 */
export function startPolygonSync(redisConnection: {
  host: string;
  port: number;
  password?: string;
}): { queue: Queue; worker: Worker } {
  const queue = new Queue(QUEUE_NAME, {
    connection: redisConnection,
  });

  const countryCode = getCountryCode(config.instance.country);
  const cronPattern = process.env.POLYGON_SYNC_CRON || DEFAULT_CRON_PATTERN;

  // Register repeatable job via BullMQ v5 job scheduler
  queue.upsertJobScheduler(
    'polygon-sync-scheduled',
    { pattern: cronPattern },
    {
      name: 'sync-polygons',
      data: {
        country: config.instance.country,
        countryCode,
      } as PolygonSyncJobData,
    }
  );

  workerLog.info({
    country: config.instance.country,
    countryCode,
    cronPattern,
  }, 'Polygon sync scheduler registered');

  const worker = new Worker<PolygonSyncJobData>(
    QUEUE_NAME,
    async (job) => {
      const { country, countryCode } = job.data;
      workerLog.info({ country, countryCode }, 'Running polygon sync');

      try {
        const result = await triggerPolygonSync(countryCode);

        workerLog.info({
          country,
          countryCode,
          result,
        }, 'Polygon sync job complete');

        return result;
      } catch (error: any) {
        workerLog.error({ country, countryCode, err: error }, 'Polygon sync job failed');
        throw error;
      }
    },
    {
      connection: redisConnection,
      concurrency: 1, // One sync at a time per country
    }
  );

  worker.on('completed', (job) => {
    workerLog.debug({ jobId: job.id, result: job.returnvalue }, 'Polygon sync job completed');
  });

  worker.on('failed', (job, err) => {
    workerLog.error({ jobId: job?.id, error: err.message }, 'Polygon sync job failed');
  });

  worker.on('error', (err) => {
    workerLog.error({ error: err.message }, 'Polygon sync worker error');
  });

  return { queue, worker };
}
