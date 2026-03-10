import { ChecksumClient, ListingChecksum } from '@landomo/core';
import { ListingsScraper } from '../scrapers/listingsScraper';
import { batchCreateRealingoChecksums } from '../utils/checksumExtractor';
import { addDetailJobs } from '../queue/detailQueue';
import { RealingoOffer } from '../types/realingoTypes';

// Semaphore: allow up to 2 concurrent checksum API calls (one per stream)
// Prevents 429s while keeping SELL+RENT truly parallel
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
  phase2: { totalChecked: number; new: number; changed: number; unchanged: number; savingsPercent: number; durationMs: number };
  phase3: { queued: number; durationMs: number };
}

/**
 * Streaming Three-Phase Scraping for Realingo (sreality pattern)
 *
 * Per page of results (100 items), as they stream in:
 *   1. Compare checksums — identify new/changed
 *   2. Queue detail jobs to Redis (BullMQ) for new/changed listings
 *
 * A BullMQ worker (started in index.ts) picks up jobs concurrently:
 *   - Alias-batch fetches offer(id).detail via GraphQL (50 IDs per request)
 *   - Transforms and streams to ingest API in batches of 100
 *
 * SELL and RENT run concurrently — each streams page-by-page.
 * No waiting for all of Phase 1 before work starts.
 */
export async function runThreePhaseScrape(scrapeRunId?: string, categories?: string[]): Promise<PhaseStats> {
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
  const seenIds = new Set<string>();
  console.log(JSON.stringify({ level: 'info', service: 'realingo-scraper', msg: 'Streaming phase started: fetch → checksum → queue' }));

  // Map standard categories to Realingo property types
  const REALINGO_PROPERTY_MAP: Record<string, 'FLAT' | 'HOUSE' | 'LAND' | 'COMMERCIAL'> = {
    apartment: 'FLAT',
    house: 'HOUSE',
    land: 'LAND',
    commercial: 'COMMERCIAL',
  };
  const propertyFilters = categories
    ? categories.map(c => REALINGO_PROPERTY_MAP[c]).filter(Boolean)
    : undefined;

  if (categories) {
    console.log(JSON.stringify({ level: 'info', service: 'realingo-scraper', msg: 'Category filter', categories, propertyFilters }));
  }

  // Per-page streaming handler: compare checksums, queue detail jobs immediately
  const makePageHandler = (purpose: 'SELL' | 'RENT') => async (page: RealingoOffer[]) => {
    // Ensure purpose is set on each offer and deduplicate across categories
    for (const o of page) if (!o.purpose) o.purpose = purpose;
    const dedupedPage = page.filter(o => {
      if (seenIds.has(o.id)) return false;
      seenIds.add(o.id);
      return true;
    });
    if (dedupedPage.length < page.length) {
      console.log(JSON.stringify({ level: 'info', service: 'realingo-scraper', msg: 'Cross-category dedup', purpose, original: page.length, deduped: dedupedPage.length, filtered: page.length - dedupedPage.length }));
    }
    page = dedupedPage;

    const checksums = batchCreateRealingoChecksums(page);
    const comparison = await withChecksumSemaphore(() =>
      checksumClient.compareChecksumsInBatches(checksums, scrapeRunId)
    );

    stats.phase2.totalChecked += comparison.total;
    stats.phase2.new += comparison.new;
    stats.phase2.changed += comparison.changed;
    stats.phase2.unchanged += comparison.unchanged;
    stats.phase3.durationMs = Date.now() - phase1Start; // rolling update

    // Build a map of portalId → checksum for changed offers so the worker
    // can save the checksum only after successful ingest
    const checksumMap = new Map<string, ListingChecksum>(
      checksums.map(c => [c.portalId, c])
    );

    // Queue detail jobs for new/changed only
    const changedIds = new Set(
      comparison.results.filter(r => r.status !== 'unchanged').map(r => r.portalId)
    );
    const toFetch = page.filter(o => changedIds.has(`realingo-${o.id}`));

    if (toFetch.length > 0) {
      // Pass checksum alongside each offer so the worker can persist it after ingest
      const toFetchWithChecksums = toFetch.map(o => ({
        ...o,
        _checksum: checksumMap.get(o.id),
      }));
      await addDetailJobs(toFetchWithChecksums, scrapeRunId);
      stats.phase3.queued += toFetch.length;
    }

    console.log(JSON.stringify({
      level: 'info', service: 'realingo-scraper', msg: 'Page streamed',
      purpose, new: comparison.new, changed: comparison.changed,
      unchanged: comparison.unchanged, queued: toFetch.length,
    }));
  };

  // Build purpose × property combos for parallel execution
  const purposes: ('SELL' | 'RENT')[] = ['SELL', 'RENT'];
  type Combo = { purpose: 'SELL' | 'RENT'; property?: 'FLAT' | 'HOUSE' | 'LAND' | 'COMMERCIAL' };
  const combos: Combo[] = [];
  for (const purpose of purposes) {
    if (propertyFilters && propertyFilters.length > 0) {
      for (const property of propertyFilters) {
        combos.push({ purpose, property });
      }
    } else {
      combos.push({ purpose });
    }
  }

  // Run all combos concurrently, each streaming page-by-page
  const results = await Promise.all(
    combos.map(combo =>
      scraper.scrapeAll(
        { purpose: combo.purpose, ...(combo.property ? { property: combo.property } : {}) },
        makePageHandler(combo.purpose)
      )
    )
  );

  stats.phase1.totalListings = results.reduce((sum, listings) => sum + listings.length, 0);
  stats.phase1.durationMs = Date.now() - phase1Start;
  stats.phase2.savingsPercent = stats.phase2.totalChecked > 0
    ? Math.round((stats.phase2.unchanged / stats.phase2.totalChecked) * 100)
    : 100;

  console.log(JSON.stringify({
    level: 'info', service: 'realingo-scraper', msg: 'Streaming complete — workers processing detail queue',
    totalListings: stats.phase1.totalListings,
    new: stats.phase2.new, changed: stats.phase2.changed,
    unchanged: stats.phase2.unchanged, savingsPercent: stats.phase2.savingsPercent,
    queued: stats.phase3.queued, durationMs: stats.phase1.durationMs,
  }));

  return stats;
}

export function printThreePhaseSummary(stats: PhaseStats): void {
  console.log(JSON.stringify({
    level: 'info', service: 'realingo-scraper', msg: 'Scrape summary',
    phase1_listings: stats.phase1.totalListings,
    phase1_ms: stats.phase1.durationMs,
    phase2_new: stats.phase2.new, phase2_changed: stats.phase2.changed,
    phase2_unchanged: stats.phase2.unchanged, phase2_savings_pct: stats.phase2.savingsPercent,
    phase3_queued: stats.phase3.queued,
    total_ms: stats.phase1.durationMs,
  }));
}
