import { ChecksumClient } from '@landomo/core';
import { ListingsScraper } from '../scrapers/listingsScraper';
import { batchCreateSubitoChecksums } from '../utils/checksumExtractor';
import { addDetailJobs } from '../queue/detailQueue';
import { SubitoMinimalListing, SubitoSearchConfig } from '../types/subitoTypes';

const SERVICE = 'subito-scraper';

// Semaphore to cap concurrent checksum API calls
let activeChecksumCalls = 0;
const MAX_CONCURRENT_CHECKSUM = 2;
const checksumQueue: Array<() => void> = [];

function withChecksumSemaphore<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const run = () => {
      activeChecksumCalls++;
      fn().then(resolve, reject).finally(() => {
        activeChecksumCalls--;
        if (checksumQueue.length > 0) checksumQueue.shift()!();
      });
    };
    if (activeChecksumCalls < MAX_CONCURRENT_CHECKSUM) run();
    else checksumQueue.push(run);
  });
}

export interface PhaseStats {
  phase1: { totalListings: number; durationMs: number };
  phase2: {
    totalChecked: number;
    new: number;
    changed: number;
    unchanged: number;
    savingsPercent: number;
    durationMs: number;
  };
  phase3: { queued: number; durationMs: number };
}

/**
 * Streaming Three-Phase Scraping for Subito.it
 *
 * Per page of search results (streaming):
 *   Phase 1 + 2: Fetch page → compare checksums → identify new/changed listings
 *   Phase 3:     Queue detail jobs to Redis (BullMQ) for new/changed listings
 *
 * A BullMQ worker (started in index.ts) processes detail jobs:
 *   - Fetches detail page for richer data (with fallback to discovery data)
 *   - Transforms to TierI type
 *   - Sends to ingest API in batches of 100
 */
export async function runThreePhaseScrape(scrapeRunId?: string): Promise<PhaseStats> {
  const stats: PhaseStats = {
    phase1: { totalListings: 0, durationMs: 0 },
    phase2: { totalChecked: 0, new: 0, changed: 0, unchanged: 0, savingsPercent: 0, durationMs: 0 },
    phase3: { queued: 0, durationMs: 0 },
  };

  const checksumClient = new ChecksumClient(
    process.env.INGEST_API_URL || 'http://localhost:3000',
    process.env.INGEST_API_KEY || ''
  );
  const scraper = new ListingsScraper();

  const phase1Start = Date.now();
  console.log(JSON.stringify({
    level: 'info', service: SERVICE,
    msg: 'Three-phase scrape started: fetch -> checksum -> queue',
  }));

  /**
   * Callback invoked after each page of results is fetched (Phase 1 complete for that page).
   * Immediately runs Phase 2 (checksum comparison) and Phase 3 (queue detail jobs).
   */
  const onBatch = async (
    batch: SubitoMinimalListing[],
    config: SubitoSearchConfig
  ): Promise<void> => {
    // Phase 2: Compare checksums
    const checksums = batchCreateSubitoChecksums(batch);
    const comparison = await withChecksumSemaphore(() =>
      checksumClient.compareChecksumsInBatches(checksums, scrapeRunId)
    );

    stats.phase2.totalChecked += comparison.total;
    stats.phase2.new += comparison.new;
    stats.phase2.changed += comparison.changed;
    stats.phase2.unchanged += comparison.unchanged;

    // Mark checksums as seen (fire-and-forget)
    checksumClient.updateChecksums(checksums, scrapeRunId).catch(() => {});

    // Phase 3: Queue detail jobs for new/changed listings only
    const changedIds = new Set(
      comparison.results
        .filter(r => r.status !== 'unchanged')
        .map(r => r.portalId)
    );

    const toFetch = batch.filter(listing => changedIds.has(listing.portalId));

    if (toFetch.length > 0) {
      await addDetailJobs(toFetch);
      stats.phase3.queued += toFetch.length;
    }

    console.log(JSON.stringify({
      level: 'info', service: SERVICE,
      msg: 'Batch processed',
      category: config.category, contract: config.contract, region: config.regionSlug,
      batchSize: batch.length,
      new: comparison.new, changed: comparison.changed,
      unchanged: comparison.unchanged, queued: toFetch.length,
    }));
  };

  // Phase 1: Scrape all search pages (streaming, calls onBatch per page)
  const allListings = await scraper.scrapeAll(onBatch);

  stats.phase1.totalListings = allListings.length;
  stats.phase1.durationMs = Date.now() - phase1Start;
  stats.phase2.savingsPercent =
    stats.phase2.totalChecked > 0
      ? Math.round((stats.phase2.unchanged / stats.phase2.totalChecked) * 100)
      : 100;

  console.log(JSON.stringify({
    level: 'info', service: SERVICE,
    msg: 'Streaming complete - workers processing detail queue',
    totalListings: stats.phase1.totalListings,
    new: stats.phase2.new, changed: stats.phase2.changed,
    unchanged: stats.phase2.unchanged, savingsPercent: stats.phase2.savingsPercent,
    queued: stats.phase3.queued, durationMs: stats.phase1.durationMs,
  }));

  return stats;
}

export function printThreePhaseSummary(stats: PhaseStats): void {
  console.log(JSON.stringify({
    level: 'info', service: SERVICE,
    msg: 'Scrape summary',
    phase1_listings: stats.phase1.totalListings,
    phase1_ms: stats.phase1.durationMs,
    phase2_new: stats.phase2.new,
    phase2_changed: stats.phase2.changed,
    phase2_unchanged: stats.phase2.unchanged,
    phase2_savings_pct: stats.phase2.savingsPercent,
    phase3_queued: stats.phase3.queued,
    total_ms: stats.phase1.durationMs,
  }));
}
