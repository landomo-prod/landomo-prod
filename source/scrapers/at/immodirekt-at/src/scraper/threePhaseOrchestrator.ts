import { ChecksumClient, createLogger } from '@landomo/core';
import { ListingsScraper } from '../scrapers/listingsScraper';
import { batchCreateChecksums } from '../utils/checksumExtractor';
import { addDetailJobs, DetailJob } from '../queue/detailQueue';

const log = createLogger({ service: 'immodirekt-at-scraper', portal: 'immodirekt-at', country: 'at' });

const CHECKSUM_BATCH_SIZE = 5000;

export interface PhaseStats {
  phase1: { totalListings: number; durationMs: number };
  phase2: { total: number; new: number; changed: number; unchanged: number; savingsPercent: number; durationMs: number };
  phase3: { queued: number; durationMs: number };
}

/**
 * Three-Phase Checksum-Based Scraping Orchestrator for Immodirekt.at
 *
 * Phase 1: Discovery - paginate search results via Playwright + Cloudflare bypass
 * Phase 2: Checksum comparison - detect new/changed/unchanged via ingest API
 * Phase 3: Queue detail fetches - only new/changed go to BullMQ workers
 */
export async function runThreePhaseScrape(scrapeRunId?: string): Promise<PhaseStats> {
  const stats: PhaseStats = {
    phase1: { totalListings: 0, durationMs: 0 },
    phase2: { total: 0, new: 0, changed: 0, unchanged: 0, savingsPercent: 0, durationMs: 0 },
    phase3: { queued: 0, durationMs: 0 },
  };

  const checksumClient = new ChecksumClient(
    process.env.INGEST_API_URL || 'http://localhost:3000',
    process.env.INGEST_API_KEY || ''
  );

  // ==========================================================================
  // PHASE 1: Discovery - fetch all listing IDs via search pages
  // ==========================================================================
  const phase1Start = Date.now();

  const scraper = new ListingsScraper();
  let allItems: Array<{ item: any; transactionType: 'sale' | 'rent'; propertyType: string }> = [];

  try {
    // Use existing scrapeAll which handles all categories + Cloudflare bypass + pagination
    const listings = await scraper.scrapeAll();

    for (const listing of listings) {
      allItems.push({
        item: listing,
        transactionType: (listing.transactionType === 'rent' ? 'rent' : 'sale') as 'sale' | 'rent',
        propertyType: listing.propertyType || 'apartment',
      });
    }
  } catch (err: any) {
    log.error({ err: err.message }, 'Phase 1 discovery failed');
  } finally {
    await scraper.close();
  }

  stats.phase1.totalListings = allItems.length;
  stats.phase1.durationMs = Date.now() - phase1Start;

  if (allItems.length === 0) return stats;

  // ==========================================================================
  // PHASE 2: Checksum comparison
  // ==========================================================================
  const phase2Start = Date.now();

  const checksums = batchCreateChecksums(allItems.map(e => e.item));

  const comparison = await checksumClient.compareChecksumsInBatches(
    checksums,
    scrapeRunId,
    CHECKSUM_BATCH_SIZE,
    (current, total) => {
      log.info({ current, total }, 'Checksum progress');
    }
  );

  stats.phase2.total = comparison.total;
  stats.phase2.new = comparison.new;
  stats.phase2.changed = comparison.changed;
  stats.phase2.unchanged = comparison.unchanged;
  stats.phase2.savingsPercent = stats.phase2.total > 0
    ? Math.round((stats.phase2.unchanged / stats.phase2.total) * 100)
    : 0;
  stats.phase2.durationMs = Date.now() - phase2Start;

  // Store checksums for next run
  try {
    await checksumClient.updateChecksums(checksums, scrapeRunId);
  } catch (err: any) {
    log.warn({ err: err.message }, 'Failed to store checksums');
  }

  // ==========================================================================
  // PHASE 3: Queue new/changed for detail fetch
  // ==========================================================================
  const phase3Start = Date.now();

  const toFetch = new Set(
    comparison.results
      .filter(r => r.status !== 'unchanged')
      .map(r => r.portalId)
  );

  const jobs: DetailJob[] = allItems
    .filter(({ item }) => toFetch.has(item.id?.toString()))
    .map(({ item, transactionType, propertyType }) => ({
      id: item.id?.toString(),
      url: item.url,
      transactionType,
      propertyType,
    }));

  if (jobs.length > 0) {
    await addDetailJobs(jobs);
  }

  stats.phase3.queued = jobs.length;
  stats.phase3.durationMs = Date.now() - phase3Start;

  return stats;
}

export function printThreePhaseSummary(stats: PhaseStats): void {
  const totalMs = stats.phase1.durationMs + stats.phase2.durationMs + stats.phase3.durationMs;
  log.info({
    phase1: { totalListings: stats.phase1.totalListings, durationMs: stats.phase1.durationMs },
    phase2: { total: stats.phase2.total, new: stats.phase2.new, changed: stats.phase2.changed, unchanged: stats.phase2.unchanged, savingsPercent: stats.phase2.savingsPercent },
    phase3: { queued: stats.phase3.queued, durationMs: stats.phase3.durationMs },
    totalMs,
  }, 'Three-phase summary');
}
