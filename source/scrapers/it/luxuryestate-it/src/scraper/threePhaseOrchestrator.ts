/**
 * Three-Phase Scraping Orchestrator for LuxuryEstate.com Italy
 *
 * Phase 1: Fetch search listing pages → extract minimal listings (ID + basic data)
 * Phase 2: Compare checksums via ingest API → identify new/changed listings only
 * Phase 3: Queue detail page fetches for new/changed listings via BullMQ
 *
 * A BullMQ worker (started in index.ts) picks up detail jobs:
 * - Fetches individual detail pages
 * - Extracts schema.org JSON-LD
 * - Transforms to ApartmentPropertyTierI / HousePropertyTierI
 * - Streams to ingest API in batches
 */

import { ChecksumClient, ChecksumFields, createListingChecksum, ListingChecksum } from '@landomo/core';
import { ListingsScraper, SEARCH_CONFIGS } from '../scrapers/listingsScraper';
import { addDetailJobs } from '../queue/detailQueue';
import { LuxuryEstateMinimalListing, SearchConfig } from '../types/luxuryEstateTypes';

// Limit concurrent checksum API calls
let activeChecksumCalls = 0;
const MAX_CONCURRENT_CHECKSUM = 2;
const checksumQueue: Array<() => void> = [];

function withChecksumSemaphore<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const run = () => {
      activeChecksumCalls++;
      fn()
        .then(resolve, reject)
        .finally(() => {
          activeChecksumCalls--;
          if (checksumQueue.length > 0) checksumQueue.shift()!();
        });
    };
    if (activeChecksumCalls < MAX_CONCURRENT_CHECKSUM) run();
    else checksumQueue.push(run);
  });
}

// ─── Checksum helpers ─────────────────────────────────────────────────────────

function extractChecksumFields(listing: LuxuryEstateMinimalListing): ChecksumFields {
  return {
    price: listing.price ?? null,
    title: listing.title ?? null,
    description: null,
    sqm: null,
    disposition: listing.categoryHint ?? null,
    purpose: listing.transactionHint ?? null,
  };
}

function createLuxuryEstateChecksum(listing: LuxuryEstateMinimalListing): ListingChecksum {
  if (!listing.id) throw new Error('Listing missing id');
  return createListingChecksum('luxuryestate-it', listing.id, listing, extractChecksumFields);
}

function batchCreateChecksums(listings: LuxuryEstateMinimalListing[]): ListingChecksum[] {
  const result: ListingChecksum[] = [];
  for (const listing of listings) {
    try {
      result.push(createLuxuryEstateChecksum(listing));
    } catch {
      // Skip listings without IDs
    }
  }
  return result;
}

// ─── Stats ────────────────────────────────────────────────────────────────────

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

// ─── Main orchestrator ────────────────────────────────────────────────────────

/**
 * Run the full three-phase scrape for LuxuryEstate.com Italy.
 *
 * Streams page-by-page: each page of search results is checksummed
 * and new/changed listings are queued for detail fetching immediately,
 * without waiting for all pages to finish.
 */
export async function runThreePhaseScrape(scrapeRunId?: string): Promise<PhaseStats> {
  const stats: PhaseStats = {
    phase1: { totalListings: 0, durationMs: 0 },
    phase2: {
      totalChecked: 0,
      new: 0,
      changed: 0,
      unchanged: 0,
      savingsPercent: 0,
      durationMs: 0,
    },
    phase3: { queued: 0, durationMs: 0 },
  };

  const checksumClient = new ChecksumClient(
    process.env.INGEST_API_URL || 'http://localhost:3000',
    process.env.INGEST_API_KEY || ''
  );

  const scraper = new ListingsScraper();
  const phase1Start = Date.now();

  console.log(
    JSON.stringify({
      level: 'info',
      service: 'luxuryestate-scraper',
      msg: 'Starting three-phase scrape',
      configs: SEARCH_CONFIGS.length,
      timestamp: new Date().toISOString(),
    })
  );

  /**
   * Called after each page of search results.
   * Performs checksum comparison and queues new/changed listings.
   */
  const onBatch = async (
    listings: LuxuryEstateMinimalListing[],
    config: SearchConfig
  ): Promise<void> => {
    const checksums = batchCreateChecksums(listings);
    if (checksums.length === 0) return;

    // Phase 2: compare checksums
    const comparison = await withChecksumSemaphore(() =>
      checksumClient.compareChecksumsInBatches(checksums, scrapeRunId)
    );

    stats.phase2.totalChecked += comparison.total;
    stats.phase2.new += comparison.new;
    stats.phase2.changed += comparison.changed;
    stats.phase2.unchanged += comparison.unchanged;

    // Mark checksums as seen (fire-and-forget - don't block pipeline)
    checksumClient.updateChecksums(checksums, scrapeRunId).catch(() => {});

    // Phase 3: queue detail jobs for new/changed listings only
    const changedIds = new Set(
      comparison.results
        .filter(r => r.status !== 'unchanged')
        .map(r => r.portalId)
    );
    const toFetch = listings.filter(l => changedIds.has(l.id));

    if (toFetch.length > 0) {
      await addDetailJobs(toFetch, config);
      stats.phase3.queued += toFetch.length;
    }

    console.log(
      JSON.stringify({
        level: 'info',
        service: 'luxuryestate-scraper',
        msg: 'Page batch processed',
        category: config.category,
        total: listings.length,
        new: comparison.new,
        changed: comparison.changed,
        unchanged: comparison.unchanged,
        queued: toFetch.length,
      })
    );
  };

  // Run all search configs (sequential to be polite to the server)
  const allResults = await scraper.scrapeAll(onBatch);

  const phase1End = Date.now();
  stats.phase1.totalListings = allResults.length;
  stats.phase1.durationMs = phase1End - phase1Start;
  stats.phase2.durationMs = phase1End - phase1Start;

  stats.phase2.savingsPercent =
    stats.phase2.totalChecked > 0
      ? Math.round((stats.phase2.unchanged / stats.phase2.totalChecked) * 100)
      : 100;

  console.log(
    JSON.stringify({
      level: 'info',
      service: 'luxuryestate-scraper',
      msg: 'Three-phase scrape complete - workers processing detail queue',
      totalListings: stats.phase1.totalListings,
      new: stats.phase2.new,
      changed: stats.phase2.changed,
      unchanged: stats.phase2.unchanged,
      savingsPercent: stats.phase2.savingsPercent,
      queued: stats.phase3.queued,
      durationMs: stats.phase1.durationMs,
    })
  );

  return stats;
}

export function printThreePhaseSummary(stats: PhaseStats): void {
  console.log(
    JSON.stringify({
      level: 'info',
      service: 'luxuryestate-scraper',
      msg: 'Scrape summary',
      phase1_listings: stats.phase1.totalListings,
      phase1_ms: stats.phase1.durationMs,
      phase2_new: stats.phase2.new,
      phase2_changed: stats.phase2.changed,
      phase2_unchanged: stats.phase2.unchanged,
      phase2_savings_pct: stats.phase2.savingsPercent,
      phase3_queued: stats.phase3.queued,
      total_ms: stats.phase1.durationMs,
    })
  );
}
