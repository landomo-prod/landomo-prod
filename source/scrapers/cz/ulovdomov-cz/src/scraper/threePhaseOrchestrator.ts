import { ChecksumClient, ListingChecksum } from '@landomo/core';
import { ListingsScraper } from '../scrapers/listingsScraper';
import { UlovDomovOffer, UlovDomovOfferType } from '../types/ulovdomovTypes';
import { batchCreateUlovDomovChecksums } from '../utils/checksumExtractor';
import { addDetailJobs, DetailJob } from '../queue/detailQueue';

const OFFER_TYPES: UlovDomovOfferType[] = ['sale', 'rent', 'coliving'];
const CHECKSUM_BATCH_SIZE = 5000;

export interface PhaseStats {
  phase1: { totalListings: number; durationMs: number };
  phase2: { total: number; new: number; changed: number; unchanged: number; savingsPercent: number; durationMs: number };
  phase3: { queued: number; sent: number; durationMs: number };
}

/**
 * Three-Phase Checksum-Based Scraping Orchestrator for UlovDomov.cz
 *
 * Phase 1: Fetch all listings via API (discovery only — IDs + checksums)
 * Phase 2: Compare checksums — skip unchanged listings
 * Phase 3: Queue new/changed listings into BullMQ detail queue.
 *          Workers fetch each listing's detail page for rich data,
 *          then transform + ingest.
 *          Checksums are saved only after successful ingest.
 */
export async function runThreePhaseScrape(scrapeRunId?: string, categories?: string[]): Promise<PhaseStats> {
  const stats: PhaseStats = {
    phase1: { totalListings: 0, durationMs: 0 },
    phase2: { total: 0, new: 0, changed: 0, unchanged: 0, savingsPercent: 0, durationMs: 0 },
    phase3: { queued: 0, sent: 0, durationMs: 0 },
  };

  const scraper = new ListingsScraper();

  // ============================================================================
  // PHASE 1: Collect all listings from API
  // ============================================================================
  console.log(JSON.stringify({ level: 'info', service: 'ulovdomov-scraper', msg: 'Phase 1 started' }));
  const phase1Start = Date.now();

  const offerMap = new Map<string, UlovDomovOffer>();

  for (const offerType of OFFER_TYPES) {
    console.log(JSON.stringify({ level: 'info', service: 'ulovdomov-scraper', msg: 'Fetching offer type', offerType }));
    try {
      const offers = await scraper.scrapeByType(offerType);
      for (const offer of offers) {
        offerMap.set(String(offer.id), offer);
      }
      console.log(JSON.stringify({ level: 'info', service: 'ulovdomov-scraper', msg: 'Offer type fetched', offerType, count: offers.length }));
    } catch (err: any) {
      console.error(JSON.stringify({ level: 'error', service: 'ulovdomov-scraper', msg: 'Failed to fetch offer type', offerType, err: err.message }));
    }
  }

  const allOffers = Array.from(offerMap.values());
  stats.phase1.totalListings = allOffers.length;
  stats.phase1.durationMs = Date.now() - phase1Start;

  console.log(JSON.stringify({ level: 'info', service: 'ulovdomov-scraper', msg: 'Phase 1 complete', count: stats.phase1.totalListings, durationMs: stats.phase1.durationMs }));

  // Filter offers by category if specified
  const ULOVDOMOV_TYPE_MAP: Record<string, string> = {
    flat: 'apartment',
    house: 'house',
    room: 'apartment',
    land: 'land',
    commercial: 'commercial',
  };

  let filteredOffers: UlovDomovOffer[];
  if (categories) {
    filteredOffers = allOffers.filter(o => {
      const cat = ULOVDOMOV_TYPE_MAP[o.propertyType] || 'other';
      return categories.includes(cat);
    });
    console.log(JSON.stringify({ level: 'info', service: 'ulovdomov-scraper', msg: 'Category filter applied', categories, before: allOffers.length, after: filteredOffers.length }));
  } else {
    filteredOffers = allOffers;
  }

  if (filteredOffers.length === 0) {
    console.log(JSON.stringify({ level: 'info', service: 'ulovdomov-scraper', msg: 'No listings to process after filtering' }));
    return stats;
  }

  // ============================================================================
  // PHASE 2: Compare checksums against ingest API
  // ============================================================================
  console.log(JSON.stringify({ level: 'info', service: 'ulovdomov-scraper', msg: 'Phase 2 started' }));
  const phase2Start = Date.now();

  const checksums = batchCreateUlovDomovChecksums(filteredOffers);

  const checksumClient = new ChecksumClient(
    process.env.INGEST_API_URL || 'http://cz-ingest:3000',
    process.env.INGEST_API_KEY || process.env['INGEST_API_KEY_ULOVDOMOV'] || 'dev_key_cz_1'
  );

  const comparison = await checksumClient.compareChecksumsInBatches(
    checksums,
    scrapeRunId,
    CHECKSUM_BATCH_SIZE,
    (current: number, total: number) => {
      process.stdout.write(`\r  Comparing: ${current.toLocaleString()}/${total.toLocaleString()}`);
    }
  );
  console.log('');

  stats.phase2.total = comparison.total;
  stats.phase2.new = comparison.new;
  stats.phase2.changed = comparison.changed;
  stats.phase2.unchanged = comparison.unchanged;
  stats.phase2.savingsPercent = stats.phase2.total > 0
    ? Math.round((stats.phase2.unchanged / stats.phase2.total) * 100)
    : 0;
  stats.phase2.durationMs = Date.now() - phase2Start;

  console.log(JSON.stringify({ level: 'info', service: 'ulovdomov-scraper', msg: 'Phase 2 complete', new: stats.phase2.new, changed: stats.phase2.changed, unchanged: stats.phase2.unchanged, savings_pct: stats.phase2.savingsPercent, durationMs: stats.phase2.durationMs }));

  // ============================================================================
  // PHASE 3: Queue new/changed listings into BullMQ detail queue
  // Workers fetch detail page, transform, and ingest.
  // Checksums are saved only after successful ingest (in detailQueue.ts flushBatch).
  // ============================================================================
  console.log(JSON.stringify({ level: 'info', service: 'ulovdomov-scraper', msg: 'Phase 3 started' }));
  const phase3Start = Date.now();

  // Build portalId → checksum map
  const checksumMap = new Map<string, ListingChecksum>(
    checksums.map(cs => [cs.portalId, cs])
  );

  const toIngest = new Set(
    comparison.results
      .filter((r: any) => r.status !== 'unchanged')
      .map((r: any) => r.portalId)
  );

  const changedOffers = filteredOffers.filter(o => toIngest.has(String(o.id)));
  stats.phase3.queued = changedOffers.length;

  if (changedOffers.length > 0) {
    // Queue detail jobs in batches of 500
    const QUEUE_BATCH = 500;
    for (let i = 0; i < changedOffers.length; i += QUEUE_BATCH) {
      const slice = changedOffers.slice(i, i + QUEUE_BATCH);
      const jobs: DetailJob[] = slice.map(offer => ({
        offer,
        scrapeRunId,
        checksum: checksumMap.get(String(offer.id)),
      }));
      await addDetailJobs(jobs);
      console.log(JSON.stringify({ level: 'info', service: 'ulovdomov-scraper', msg: 'Queued detail jobs', batch: `${i + 1}-${Math.min(i + QUEUE_BATCH, changedOffers.length)}`, total: changedOffers.length }));
    }
  }

  stats.phase3.sent = changedOffers.length;
  stats.phase3.durationMs = Date.now() - phase3Start;
  console.log(JSON.stringify({ level: 'info', service: 'ulovdomov-scraper', msg: 'Phase 3 complete', queued: stats.phase3.queued, durationMs: stats.phase3.durationMs }));

  return stats;
}

export function printThreePhaseSummary(stats: PhaseStats): void {
  console.log(JSON.stringify({ level: 'info', service: 'ulovdomov-scraper', msg: 'Scrape summary', phase1_listings: stats.phase1.totalListings, phase1_durationMs: stats.phase1.durationMs, phase2_checked: stats.phase2.total, phase2_new: stats.phase2.new, phase2_changed: stats.phase2.changed, phase2_unchanged: stats.phase2.unchanged, savings_pct: stats.phase2.savingsPercent, phase3_queued: stats.phase3.queued, phase3_durationMs: stats.phase3.durationMs, total_durationMs: stats.phase1.durationMs + stats.phase2.durationMs + stats.phase3.durationMs }));
}
