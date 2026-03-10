#!/usr/bin/env tsx
/**
 * Sync script for Overpass API
 * Run: npm run sync:overpass
 */

import { OverpassSyncService } from '../services/OverpassSyncService';
import { initializeSchema } from '../database/manager';
import pino from 'pino';

const logger = pino({
  level: 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
    },
  },
  base: { service: 'polygon-service', module: 'sync-script' },
});

async function main() {
  try {
    logger.info('Starting Overpass sync...');

    // Initialize database
    await initializeSchema();

    const syncService = new OverpassSyncService();

    // Sync Czech Republic boundaries by default
    const result = await syncService.sync({
      requestId: `manual-sync-${Date.now()}`,
      country: process.env.SYNC_COUNTRY || 'CZ',
      adminLevels: process.env.SYNC_ADMIN_LEVELS
        ? process.env.SYNC_ADMIN_LEVELS.split(',').map(Number)
        : undefined,
      skipRecentlyUpdated: process.env.SYNC_SKIP_RECENT !== 'false',
    });

    logger.info({
      success: result.success,
      saved: result.savedCount,
      failed: result.failedCount,
      skipped: result.skippedCount,
      durationMs: result.duration,
    }, 'Sync complete');

    if (result.errors.length > 0) {
      logger.warn({ errors: result.errors.slice(0, 10) }, 'Sync errors (showing first 10)');
    }

    process.exit(result.success ? 0 : 1);

  } catch (error) {
    logger.error({ error }, 'Sync failed');
    process.exit(1);
  }
}

main();
