import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getCoreDatabase, getInstanceCountry } from '../database/manager';

interface ListingChecksum {
  portal: string;
  portalId: string;
  contentHash: string;
}

interface CompareRequest {
  Body: {
    checksums: ListingChecksum[];
    scrapeRunId?: string;
  };
}

interface UpdateRequest {
  Body: {
    checksums: ListingChecksum[];
    scrapeRunId?: string;
  };
}

interface StatsRequest {
  Querystring: {
    portal: string;
  };
}

export default async function checksumRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/v1/checksums/compare
   *
   * Compare checksums against database to determine which properties need full fetching
   *
   * Request body:
   * {
   *   "checksums": [
   *     { "portal": "sreality", "portalId": "12345", "contentHash": "abc..." }
   *   ],
   *   "scrapeRunId": "uuid" (optional)
   * }
   *
   * Response:
   * {
   *   "scrapeRunId": "uuid",
   *   "total": 100,
   *   "new": 10,
   *   "changed": 15,
   *   "unchanged": 75,
   *   "results": [
   *     { "portalId": "12345", "status": "new", "newHash": "abc..." },
   *     { "portalId": "12346", "status": "changed", "oldHash": "def...", "newHash": "ghi..." },
   *     { "portalId": "12347", "status": "unchanged", "newHash": "jkl..." }
   *   ]
   * }
   */
  fastify.post<CompareRequest>(
    '/api/v1/checksums/compare',
    async (request: FastifyRequest<CompareRequest>, reply: FastifyReply) => {
      const { checksums, scrapeRunId } = request.body;

      if (!checksums || checksums.length === 0) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'checksums array is required and cannot be empty',
        });
      }

      try {
        const db = getCoreDatabase(getInstanceCountry());
        const portal = checksums[0].portal;

        // Process checksums in batches to avoid PostgreSQL parameter limit (65,535)
        // Each checksum uses 2 parameters (portal_id, hash), so batch size of 10,000 = 20,000 params
        const BATCH_SIZE = 10000;
        const allResults: any[] = [];

        for (let i = 0; i < checksums.length; i += BATCH_SIZE) {
          const batch = checksums.slice(i, i + BATCH_SIZE);
          const portalIds = batch.map((c) => c.portalId);
          const hashes = batch.map((c) => c.contentHash);

          // Compare checksums in batch
          const result = await db.query(
            `
            WITH incoming AS (
              SELECT
                unnest($1::text[]) AS portal_id,
                unnest($2::text[]) AS new_hash
            )
            SELECT
              i.portal_id,
              i.new_hash,
              pc.checksum AS old_hash,
              CASE
                WHEN pc.checksum IS NULL THEN 'new'
                WHEN pc.checksum != i.new_hash THEN 'changed'
                ELSE 'unchanged'
              END AS status
            FROM incoming i
            LEFT JOIN listing_checksums pc
              ON pc.portal = $3
              AND pc.portal_id = i.portal_id
            `,
            [portalIds, hashes, portal]
          );

          allResults.push(...result.rows);
        }

        const results = allResults.map((row: any) => ({
          portalId: row.portal_id,
          status: row.status as 'new' | 'changed' | 'unchanged',
          oldHash: row.old_hash,
          newHash: row.new_hash,
        }));

        const stats = {
          total: results.length,
          new: results.filter((r: any) => r.status === 'new').length,
          changed: results.filter((r: any) => r.status === 'changed').length,
          unchanged: results.filter((r: any) => r.status === 'unchanged').length,
        };

        return reply.code(200).send({
          scrapeRunId: scrapeRunId || null,
          ...stats,
          results,
        });
      } catch (error: any) {
        fastify.log.error({
          err: error,
          message: error.message,
          code: error.code,
          detail: error.detail,
          stack: error.stack,
        }, 'Failed to compare checksums');
        return reply.code(500).send({
          error: 'Internal Server Error',
          message: 'Failed to compare checksums',
          debug: error.message, // Include error message for debugging
        });
      }
    }
  );

  /**
   * POST /api/v1/checksums/update
   *
   * Update checksums after successful property ingestion
   * This marks properties as "seen" in the current scrape run
   *
   * Request body:
   * {
   *   "checksums": [
   *     { "portal": "sreality", "portalId": "12345", "contentHash": "abc..." }
   *   ],
   *   "scrapeRunId": "uuid" (optional)
   * }
   */
  fastify.post<UpdateRequest>(
    '/api/v1/checksums/update',
    async (request: FastifyRequest<UpdateRequest>, reply: FastifyReply) => {
      const { checksums, scrapeRunId } = request.body;

      if (!checksums || checksums.length === 0) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'checksums array is required and cannot be empty',
        });
      }

      try {
        const db = getCoreDatabase(getInstanceCountry());
        const portal = checksums[0].portal;

        // Deduplicate by portalId (keep last occurrence) to avoid
        // "ON CONFLICT DO UPDATE command cannot affect row a second time" error
        const seen = new Map<string, ListingChecksum>();
        for (const c of checksums) {
          seen.set(c.portalId, c);
        }
        // Sort by portalId so concurrent transactions acquire row locks in the
        // same order, preventing deadlocks on the listing_checksums index.
        const deduped = Array.from(seen.values()).sort((a, b) =>
          a.portalId < b.portalId ? -1 : a.portalId > b.portalId ? 1 : 0
        );

        // Process checksums in batches to avoid PostgreSQL parameter limit
        const BATCH_SIZE = 1000;
        let totalUpdated = 0;

        for (let i = 0; i < deduped.length; i += BATCH_SIZE) {
          const batch = deduped.slice(i, i + BATCH_SIZE);

          // UPSERT with retry on deadlock (40P01). Concurrent combo scrapes
          // can deadlock on B-tree index page locks in listing_checksums.
          const MAX_RETRIES = 3;
          for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            try {
              const values = batch
                .map(
                  (c, idx) =>
                    `($${idx * 3 + 1}, $${idx * 3 + 2}, $${idx * 3 + 3}, NOW())`
                )
                .join(',');
              const params = batch.flatMap((c) => [portal, c.portalId, c.contentHash]);

              await db.query(
                `
                INSERT INTO listing_checksums (
                  portal,
                  portal_id,
                  checksum,
                  last_seen_at
                )
                VALUES ${values}
                ON CONFLICT (portal, portal_id)
                DO UPDATE SET
                  checksum = EXCLUDED.checksum,
                  last_seen_at = EXCLUDED.last_seen_at
                `,
                params
              );

              // Also touch last_seen_at on the properties table so the staleness
              // checker doesn't mark unchanged (skipped) listings as removed.
              const portalIds = batch.map((c) => c.portalId);
              await db.query(
                `UPDATE properties SET last_seen_at = NOW()
                 WHERE source_platform = $1
                   AND portal_id = ANY($2)
                   AND status = 'active'`,
                [portal, portalIds]
              );

              break; // success
            } catch (batchErr: any) {
              if (batchErr.code === '40P01' && attempt < MAX_RETRIES - 1) {
                // Deadlock — wait briefly and retry
                await new Promise((r) => setTimeout(r, 50 + Math.random() * 100));
                continue;
              }
              throw batchErr;
            }
          }

          totalUpdated += batch.length;
        }

        return reply.code(200).send({
          success: true,
          updated: totalUpdated,
        });
      } catch (error: any) {
        fastify.log.error({
          err: error,
          message: error.message,
          code: error.code,
          detail: error.detail,
        }, 'Failed to update checksums');
        return reply.code(500).send({
          error: 'Internal Server Error',
          message: 'Failed to update checksums',
          debug: error.message, // Include error message in response for debugging
        });
      }
    }
  );

  /**
   * GET /api/v1/checksums/stats?portal=sreality
   *
   * Get checksum statistics for a portal
   */
  fastify.get<StatsRequest>(
    '/api/v1/checksums/stats',
    async (request: FastifyRequest<StatsRequest>, reply: FastifyReply) => {
      const { portal } = request.query;

      if (!portal) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'portal query parameter is required',
        });
      }

      try {
        const db = getCoreDatabase(getInstanceCountry());

        const result = await db.query(
          `
          SELECT
            COUNT(*) AS total_properties,
            MAX(last_seen_at) AS last_scraped_at
          FROM listing_checksums
          WHERE portal = $1
          `,
          [portal]
        );

        const stats = result.rows[0];

        return reply.code(200).send({
          totalProperties: parseInt(stats.total_properties || '0'),
          lastScrapedAt: stats.last_scraped_at,
          averageChangeRate: null, // TODO: Calculate from property_updates table
        });
      } catch (error: any) {
        fastify.log.error('Failed to get checksum stats:', error);
        return reply.code(500).send({
          error: 'Internal Server Error',
          message: 'Failed to get checksum stats',
        });
      }
    }
  );
}
