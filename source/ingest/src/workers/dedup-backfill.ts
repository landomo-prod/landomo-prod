/**
 * Cross-Portal Deduplication Backfill Worker
 *
 * One-time backfill that processes all existing properties to find and link
 * cross-portal duplicates. Uses cursor-based ID paging to avoid memory issues.
 */

import { Queue, Worker } from 'bullmq';
import { config } from '../config';
import { getCoreDatabase } from '../database/manager';
import { findPotentialDuplicates, linkDuplicate, PORTAL_PRIORITY, PartitionTable } from '../database/dedup-operations';
import { workerLog } from '../logger';

const QUEUE_NAME = `dedup-backfill-${config.instance.country}`;
const BATCH_SIZE = parseInt(process.env.DEDUP_BACKFILL_BATCH_SIZE || '500', 10);
const THROTTLE_MS = parseInt(process.env.DEDUP_BACKFILL_THROTTLE_MS || '5', 10);

interface DedupBackfillJobData {
  country: string;
}

const PARTITION_TABLES: PartitionTable[] = [
  'properties_apartment',
  'properties_house',
  'properties_land',
  'properties_commercial',
];

/**
 * Start the dedup backfill worker.
 * Unlike geo-backfill, this has NO cron schedule — triggered manually via admin endpoint.
 */
export function startDedupBackfill(redisConnection: {
  host: string;
  port: number;
  password?: string;
}): { queue: Queue; worker: Worker } {
  const queue = new Queue(QUEUE_NAME, {
    connection: redisConnection,
  });

  const worker = new Worker<DedupBackfillJobData>(
    QUEUE_NAME,
    async (job) => {
      const { country } = job.data;
      workerLog.info({ country }, 'Starting dedup backfill');

      const pool = getCoreDatabase(country);
      let totalLinked = 0;
      let totalProcessed = 0;

      for (const table of PARTITION_TABLES) {
        let tableLinked = 0;
        let tableProcessed = 0;
        let hasMore = true;
        let lastId = '00000000-0000-0000-0000-000000000000';

        while (hasMore) {
          const { rows } = await pool.query(
            `SELECT id, portal, portal_id, latitude, longitude, price, transaction_type
             FROM ${table}
             WHERE status = 'active'
               AND canonical_property_id IS NULL
               AND latitude IS NOT NULL
               AND longitude IS NOT NULL
               AND price IS NOT NULL
               AND price > 0
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
            try {
              const matches = await findPotentialDuplicates(
                {
                  id: row.id,
                  latitude: parseFloat(row.latitude),
                  longitude: parseFloat(row.longitude),
                  price: parseFloat(row.price),
                  transaction_type: row.transaction_type,
                  portal: row.portal,
                  portal_id: row.portal_id,
                },
                table,
                pool
              );

              if (matches.length > 0) {
                const best = matches[0];
                const ourPriority = PORTAL_PRIORITY[row.portal] ?? 9;
                const theirPriority = PORTAL_PRIORITY[best.portal] ?? 9;

                if (ourPriority < theirPriority) {
                  await linkDuplicate(row.id, best.propertyId, best.confidence, best.method, pool);
                } else {
                  await linkDuplicate(best.propertyId, row.id, best.confidence, best.method, pool);
                }
                tableLinked++;
              }
            } catch (e) {
              workerLog.warn({ err: e, propertyId: row.id }, 'Dedup backfill: failed to process property');
            }

            tableProcessed++;

            if (THROTTLE_MS > 0) {
              await new Promise((r) => setTimeout(r, THROTTLE_MS));
            }
          }

          if (rows.length < BATCH_SIZE) {
            hasMore = false;
          }

          await job.updateProgress({
            table,
            tableProcessed,
            tableLinked,
            lastId,
          });

          workerLog.info({ table, tableProcessed, tableLinked, lastId }, 'Dedup backfill batch processed');
        }

        if (tableProcessed > 0) {
          workerLog.info({ table, processed: tableProcessed, linked: tableLinked }, 'Dedup backfill table complete');
        }
        totalLinked += tableLinked;
        totalProcessed += tableProcessed;
      }

      workerLog.info({ country, totalProcessed, totalLinked }, 'Dedup backfill complete');
      return { totalProcessed, totalLinked };
    },
    {
      connection: redisConnection,
      concurrency: 1,
    }
  );

  worker.on('failed', (job, err) => {
    workerLog.error({ err, jobId: job?.id }, 'Dedup backfill job failed');
  });

  return { queue, worker };
}
