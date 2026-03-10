/**
 * Sync API Routes
 * Trigger Overpass boundary sync via API
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { OverpassSyncService } from '../services/OverpassSyncService';
import pino from 'pino';
import { config } from '../config';

const logger = pino({
  level: config.logging.level,
  base: { service: 'polygon-service', module: 'sync-routes' },
});

interface OverpassSyncBody {
  countryCode: string; // ISO 3166-1 alpha-2 (CZ, SK, HU, etc.)
  adminLevels?: number[];
  skipRecent?: boolean;
  force?: boolean;
}

export async function syncRoutes(fastify: FastifyInstance) {
  const syncService = new OverpassSyncService();

  /**
   * POST /api/v1/sync/overpass
   * Trigger Overpass boundary sync for a country
   */
  fastify.post<{
    Body: OverpassSyncBody;
  }>('/api/v1/sync/overpass', async (request, reply) => {
    const { countryCode, adminLevels, skipRecent = true, force = false } = request.body;

    if (!countryCode || countryCode.length !== 2) {
      return reply.code(400).send({
        error: 'Invalid countryCode - must be ISO 3166-1 alpha-2 (e.g., CZ, SK, HU)',
      });
    }

    try {
      logger.info({
        countryCode,
        adminLevels: adminLevels || 'default',
        skipRecent,
        force,
      }, 'Starting Overpass sync');

      const startTime = Date.now();

      const result = await syncService.sync({
        country: countryCode,
        adminLevels: adminLevels || [2, 4, 6, 8, 9, 10],
        skipRecentlyUpdated: skipRecent && !force,
      });

      const durationMs = Date.now() - startTime;

      logger.info({
        countryCode,
        savedCount: result.savedCount,
        skippedCount: result.skippedCount,
        failedCount: result.failedCount,
        durationMs,
      }, 'Overpass sync completed');

      return reply.send({
        success: result.success,
        countryCode,
        areasProcessed: result.savedCount + result.skippedCount + result.failedCount,
        areasCreated: result.savedCount,
        areasUpdated: 0, // TODO: Track updates separately
        areasSkipped: result.skippedCount,
        errors: result.errors.map((e: any) => e.message || String(e)),
        durationMs,
      });
    } catch (error: any) {
      logger.error({
        countryCode,
        error: error.message,
        stack: error.stack,
      }, 'Overpass sync failed');

      return reply.code(500).send({
        error: 'Sync failed',
        message: error.message,
      });
    }
  });

  /**
   * GET /api/v1/sync/status
   * Get current sync status (future: track in-progress syncs)
   */
  fastify.get('/api/v1/sync/status', async (request, reply) => {
    // TODO: Track active sync jobs in Redis
    return reply.send({
      active: false,
      message: 'No active sync jobs',
    });
  });
}
