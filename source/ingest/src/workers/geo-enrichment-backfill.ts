/**
 * Geo Enrichment Backfill Worker
 *
 * Scheduled BullMQ job that backfills district and neighbourhood for
 * existing properties that have lat/lon but are missing geo enrichment.
 * Processes in batches to avoid overwhelming Pelias.
 */

import { Queue, Worker } from 'bullmq';
import { config } from '../config';
import { getCoreDatabase } from '../database/manager';
import { lookupGeoEnrichment } from '../services/district-lookup';
import { workerLog } from '../logger';

const QUEUE_NAME = `geo-backfill-${config.instance.country}`;
const BATCH_SIZE = parseInt(process.env.GEO_BACKFILL_BATCH_SIZE || '200', 10);
const THROTTLE_MS = parseInt(process.env.GEO_BACKFILL_THROTTLE_MS || '50', 10);

interface GeoBackfillJobData {
  country: string;
}

const PARTITION_TABLES = [
  'properties_apartment',
  'properties_house',
  'properties_land',
  'properties_commercial',
  'properties_other',
] as const;

/**
 * Start the geo enrichment backfill worker: creates a scheduled repeatable job
 * and a worker to process it.
 */
export function startGeoBackfill(redisConnection: {
  host: string;
  port: number;
  password?: string;
}): { queue: Queue; worker: Worker } {
  const queue = new Queue(QUEUE_NAME, {
    connection: redisConnection,
  });

  const cronPattern = process.env.GEO_BACKFILL_CRON || '0 3 * * *';

  queue.upsertJobScheduler(
    'geo-backfill-scheduled',
    { pattern: cronPattern },
    {
      name: 'geo-backfill',
      data: { country: config.instance.country } as GeoBackfillJobData,
    }
  );

  const worker = new Worker<GeoBackfillJobData>(
    QUEUE_NAME,
    async (job) => {
      const { country } = job.data;
      workerLog.info({ country }, 'Starting geo enrichment backfill');

      const pool = getCoreDatabase(country);
      let totalUpdated = 0;

      for (const table of PARTITION_TABLES) {
        let tableUpdated = 0;
        let tableSkipped = 0;
        let hasMore = true;
        let lastId = '00000000-0000-0000-0000-000000000000';

        while (hasMore) {
          // Fetch a batch of properties missing district AND neighbourhood.
          // Use id cursor to avoid re-processing same rows when enrichment
          // partially succeeds (e.g. neighbourhood found but district unavailable).
          const { rows } = await pool.query(
            `SELECT id, latitude, longitude
             FROM ${table}
             WHERE status = 'active'
               AND latitude IS NOT NULL
               AND longitude IS NOT NULL
               AND municipality IS NULL
               AND id > $1
             ORDER BY id
             LIMIT $2`,
            [lastId, BATCH_SIZE]
          );

          if (rows.length === 0) {
            hasMore = false;
            break;
          }

          lastId = rows[rows.length - 1].id;

          for (const row of rows) {
            const geo = await lookupGeoEnrichment(row.latitude, row.longitude);

            const updates: string[] = [];
            const params: any[] = [];
            let paramIdx = 1;

            if (geo.district) {
              updates.push(`district = $${paramIdx++}`);
              params.push(geo.district);
            }
            if (geo.neighbourhood) {
              updates.push(`neighbourhood = $${paramIdx++}`);
              params.push(geo.neighbourhood);
            }
            if (geo.municipality) {
              updates.push(`municipality = $${paramIdx++}`);
              params.push(geo.municipality);
            }
            if (geo.region) {
              updates.push(`region = COALESCE(region, $${paramIdx++})`);
              params.push(geo.region);
            }

            if (updates.length > 0) {
              params.push(row.id);
              await pool.query(
                `UPDATE ${table} SET ${updates.join(', ')} WHERE id = $${paramIdx}`,
                params
              );
              tableUpdated++;
            } else {
              tableSkipped++;
            }

            // Throttle to avoid hammering Pelias/polygon
            if (THROTTLE_MS > 0) {
              await new Promise((r) => setTimeout(r, THROTTLE_MS));
            }
          }

          // If we got fewer than BATCH_SIZE, we're done with this table
          if (rows.length < BATCH_SIZE) {
            hasMore = false;
          }

          workerLog.info({ table, tableUpdated, tableSkipped, lastId }, 'Geo backfill batch processed');
        }

        if (tableUpdated > 0 || tableSkipped > 0) {
          workerLog.info({ table, updated: tableUpdated, skipped: tableSkipped }, 'Geo backfill table complete');
        }
        totalUpdated += tableUpdated;
      }

      workerLog.info({ country, totalUpdated }, 'Geo enrichment backfill complete');
      return { totalUpdated };
    },
    {
      connection: redisConnection,
      concurrency: 1,
    }
  );

  worker.on('failed', (job, err) => {
    workerLog.error({ err, jobId: job?.id }, 'Geo backfill job failed');
  });

  return { queue, worker };
}
