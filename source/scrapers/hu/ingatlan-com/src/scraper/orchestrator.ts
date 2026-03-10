import { ChecksumClient, batchCreateChecksums, ListingChecksum } from '@landomo/core';
import { ListingsScraper } from '../scrapers/listingsScraper';
import { transformIngatlanToStandard } from '../transformers/ingatlanTransformer';
import { IngestAdapter } from '../adapters/ingestAdapter';
import { IngatlanListing } from '../types/ingatlanTypes';

const PORTAL = 'ingatlan-com';
const BATCH_SIZE = 100;

export interface PhaseStats {
  phase1: {
    regionsProcessed: number;
    totalListings: number;
    durationMs: number;
  };
  phase2: {
    totalChecked: number;
    new: number;
    changed: number;
    unchanged: number;
    savingsPercent: number;
    durationMs: number;
  };
  ingestion: {
    sent: number;
    failed: number;
    durationMs: number;
  };
}

/**
 * Two-phase orchestrator for ingatlan.com
 *
 * Ingatlan.com listing pages contain all data inline (no separate detail endpoint),
 * so we use a two-phase pattern:
 *   Phase 1: Fast scan - collect all listings from all regions
 *   Phase 2: Checksum comparison + selective ingestion of new/changed only
 */
export async function runOrchestrator(
  maxRegions?: number,
  maxPages?: number,
  scrapeRunId?: string
): Promise<PhaseStats> {
  const stats: PhaseStats = {
    phase1: { regionsProcessed: 0, totalListings: 0, durationMs: 0 },
    phase2: { totalChecked: 0, new: 0, changed: 0, unchanged: 0, savingsPercent: 0, durationMs: 0 },
    ingestion: { sent: 0, failed: 0, durationMs: 0 },
  };

  const checksumClient = new ChecksumClient(
    process.env.INGEST_API_URL || 'http://localhost:3004',
    process.env.INGEST_API_KEY || ''
  );
  const adapter = new IngestAdapter(PORTAL);
  const scraper = new ListingsScraper();

  // Phase 1: Fast scan all regions
  console.log(JSON.stringify({ level: 'info', service: PORTAL, msg: 'Phase 1: Fast scan starting' }));
  const phase1Start = Date.now();

  const listings = await scraper.scrapeAll(maxRegions, maxPages);
  stats.phase1.totalListings = listings.length;
  stats.phase1.regionsProcessed = maxRegions || scraper.getRegionCount();
  stats.phase1.durationMs = Date.now() - phase1Start;

  console.log(JSON.stringify({ level: 'info', service: PORTAL, msg: 'Phase 1 complete', totalListings: listings.length, durationMs: stats.phase1.durationMs }));

  if (listings.length === 0) {
    console.log(JSON.stringify({ level: 'info', service: PORTAL, msg: 'No listings found, skipping phase 2' }));
    return stats;
  }

  // Phase 2: Checksum comparison
  console.log(JSON.stringify({ level: 'info', service: PORTAL, msg: 'Phase 2: Checksum comparison starting' }));
  const phase2Start = Date.now();

  const checksums = batchCreateChecksums(
    PORTAL,
    listings,
    (listing: IngatlanListing) => listing.id,
    (listing: IngatlanListing) => ({
      price: listing.price,
      title: listing.title,
      sqm: listing.area,
      bedrooms: listing.rooms,
    })
  );

  const comparison = await checksumClient.compareChecksumsInBatches(
    checksums,
    scrapeRunId,
    5000,
    (current, total) => {
      console.log(JSON.stringify({ level: 'info', service: PORTAL, msg: 'Checksum progress', current, total }));
    }
  );

  stats.phase2.totalChecked = comparison.total;
  stats.phase2.new = comparison.new;
  stats.phase2.changed = comparison.changed;
  stats.phase2.unchanged = comparison.unchanged;
  stats.phase2.savingsPercent = comparison.total > 0
    ? Math.round((comparison.unchanged / comparison.total) * 100)
    : 0;
  stats.phase2.durationMs = Date.now() - phase2Start;

  console.log(JSON.stringify({ level: 'info', service: PORTAL, msg: 'Phase 2 complete', new: comparison.new, changed: comparison.changed, unchanged: comparison.unchanged, savingsPercent: stats.phase2.savingsPercent }));

  // Store checksums
  try {
    await checksumClient.updateChecksums(checksums, scrapeRunId);
  } catch (error: any) {
    console.log(JSON.stringify({ level: 'error', service: PORTAL, msg: 'Failed to store checksums', err: error.message }));
  }

  // Filter to only new/changed listings
  const toIngestSet = new Set(
    comparison.results.filter(r => r.status !== 'unchanged').map(r => r.portalId)
  );

  const toIngest = listings.filter(listing => toIngestSet.has(listing.id));

  if (toIngest.length === 0) {
    console.log(JSON.stringify({ level: 'info', service: PORTAL, msg: 'No new/changed listings to ingest' }));
    return stats;
  }

  // Transform and ingest in batches
  console.log(JSON.stringify({ level: 'info', service: PORTAL, msg: 'Ingesting new/changed listings', count: toIngest.length }));
  const ingestStart = Date.now();

  for (let i = 0; i < toIngest.length; i += BATCH_SIZE) {
    const batch = toIngest.slice(i, i + BATCH_SIZE);
    const properties = batch
      .map(listing => {
        try {
          return {
            portalId: listing.id,
            data: transformIngatlanToStandard(listing),
            rawData: listing,
          };
        } catch (error: any) {
          console.log(JSON.stringify({ level: 'error', service: PORTAL, msg: 'Transform failed', listingId: listing.id, err: error.message }));
          return null;
        }
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);

    if (properties.length > 0) {
      try {
        await adapter.sendProperties(properties);
        stats.ingestion.sent += properties.length;
      } catch (error: any) {
        stats.ingestion.failed += properties.length;
        console.log(JSON.stringify({ level: 'error', service: PORTAL, msg: 'Batch ingest failed', err: error.message }));
      }
    }

    // Small delay between batches
    if (i + BATCH_SIZE < toIngest.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  stats.ingestion.durationMs = Date.now() - ingestStart;

  console.log(JSON.stringify({ level: 'info', service: PORTAL, msg: 'Ingestion complete', sent: stats.ingestion.sent, failed: stats.ingestion.failed, durationMs: stats.ingestion.durationMs }));

  return stats;
}

export function printOrchestratorSummary(stats: PhaseStats): void {
  const totalMs = stats.phase1.durationMs + stats.phase2.durationMs + stats.ingestion.durationMs;
  console.log(JSON.stringify({
    level: 'info',
    service: PORTAL,
    msg: 'Orchestrator summary',
    phase1: { totalListings: stats.phase1.totalListings, durationMs: stats.phase1.durationMs },
    phase2: { totalChecked: stats.phase2.totalChecked, new: stats.phase2.new, changed: stats.phase2.changed, unchanged: stats.phase2.unchanged, savingsPercent: stats.phase2.savingsPercent, durationMs: stats.phase2.durationMs },
    ingestion: { sent: stats.ingestion.sent, failed: stats.ingestion.failed, durationMs: stats.ingestion.durationMs },
    totalMs,
  }));
}
