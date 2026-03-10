import { ChecksumClient, ListingChecksum, ChecksumComparisonResult } from '@landomo/core';
import { RealityApiScraper } from '../scrapers/realityApiScraper';
import { RealityApiListItem } from '../types/realityTypes';
import { batchCreateListItemChecksums } from '../utils/checksumExtractor';
import { addDetailJobs, DetailJob } from '../queue/detailQueue';

const ITEMS_PER_REQUEST = 100;
const CHECKSUM_BATCH_SIZE = 5000;
// Force-refresh listings not seen in this many hours even if checksum unchanged
const FORCE_REFRESH_HOURS = parseInt(process.env.FORCE_REFRESH_HOURS || '24');

const OFFER_TYPES = [
  { offerType: 'prodej' as const, transactionType: 'sale' as const },
  { offerType: 'pronajem' as const, transactionType: 'rent' as const },
];
const PROPERTY_TYPES = ['byty', 'domy', 'pozemky', 'komercni'] as const;

// Reality.cz API caps results at 1001 per query. Querying by region bypasses this limit.
const CZECH_REGIONS = [
  'Praha', 'Stredocesky-kraj', 'Jihomoravsky-kraj', 'Moravskoslezsky-kraj',
  'Plzensky-kraj', 'Ustecky-kraj', 'Olomoucky-kraj', 'Liberecky-kraj',
  'Kralovehradecky-kraj', 'Pardubicky-kraj', 'Jihocesky-kraj', 'Zlinsky-kraj',
  'Kraj-Vysocina', 'Karlovarsky-kraj',
];

export interface PhaseStats {
  phase1: { totalListings: number; durationMs: number };
  phase2: { total: number; new: number; changed: number; unchanged: number; savingsPercent: number; durationMs: number };
  phase3: { queued: number; durationMs: number };
}

/**
 * Three-Phase Checksum-Based Scraping Orchestrator for Reality.cz
 *
 * Phase 1: Fast search scan (~5-10 min)
 *   - Paginate through all search results (ID + price + type + place)
 *   - No detail page fetches — search results contain enough for checksums
 *
 * Phase 2: Checksum comparison (~10-30 sec)
 *   - Compare all checksums against ingest API DB
 *   - Identify new/changed/unchanged listings
 *   - Expected: 80-95% unchanged on repeat runs
 *
 * Phase 3: Queue selective detail fetches (seconds)
 *   - Queue only new/changed listings for detail fetching, with their checksum
 *   - BullMQ workers fetch details concurrently (default 10 workers, 500ms jitter)
 *   - Checksums are saved AFTER successful ingest in detailQueue.ts flushBatch
 *   - Workers run in background; orchestrator returns immediately
 */
export async function runThreePhaseScrape(scrapeRunId?: string, categories?: string[]): Promise<PhaseStats> {
  const stats: PhaseStats = {
    phase1: { totalListings: 0, durationMs: 0 },
    phase2: { total: 0, new: 0, changed: 0, unchanged: 0, savingsPercent: 0, durationMs: 0 },
    phase3: { queued: 0, durationMs: 0 },
  };

  const scraper = new RealityApiScraper();

  // Map portal property types to standard categories
  const PROPERTY_TYPE_MAP: Record<string, string> = {
    byty: 'apartment', domy: 'house', pozemky: 'land', komercni: 'commercial'
  };
  const effectivePropertyTypes = categories
    ? PROPERTY_TYPES.filter(pt => categories.includes(PROPERTY_TYPE_MAP[pt]))
    : [...PROPERTY_TYPES];

  if (categories) {
    console.log(`📋 Category filter: ${categories.join(', ')} (${effectivePropertyTypes.length}/${PROPERTY_TYPES.length} property types)`);
  }

  // ============================================================================
  // PHASE 1: Collect all listing IDs + checksums via search (no detail fetches)
  // ============================================================================
  console.log('\n📋 PHASE 1: Scanning all listings via search API...');
  const phase1Start = Date.now();

  // Map id → offerType so we know which transaction type to use when queueing detail jobs
  const listItemMap = new Map<string, { item: RealityApiListItem; transactionType: 'sale' | 'rent' }>();

  for (const { offerType, transactionType } of OFFER_TYPES) {
    for (const propertyType of effectivePropertyTypes) {
      let categoryTotal = 0;
      console.log(`  Scanning ${offerType}/${propertyType} across ${CZECH_REGIONS.length} regions...`);

      for (const region of CZECH_REGIONS) {
        try {
          const items = await scraper.fetchAllSearchResults(offerType, propertyType, region, ITEMS_PER_REQUEST);
          let regionNew = 0;
          for (const item of items) {
            if (!listItemMap.has(item.id)) {
              regionNew++;
            }
            listItemMap.set(item.id, { item, transactionType });
          }
          categoryTotal += regionNew;
        } catch (err: any) {
          console.warn(`    ⚠️  ${region}: ${err.message}`);
        }
      }
      console.log(`  ✓ ${offerType}/${propertyType}: ${categoryTotal} unique listings`);
    }
  }

  const allItems = Array.from(listItemMap.values());
  stats.phase1.totalListings = allItems.length;
  stats.phase1.durationMs = Date.now() - phase1Start;

  console.log(`✅ Phase 1 complete: ${stats.phase1.totalListings} listings in ${(stats.phase1.durationMs / 1000).toFixed(1)}s`);

  if (allItems.length === 0) {
    console.warn('No listings found in Phase 1, aborting.');
    return stats;
  }

  // ============================================================================
  // PHASE 2: Compare checksums against ingest API
  // ============================================================================
  console.log('\n🔍 PHASE 2: Comparing checksums...');
  const phase2Start = Date.now();

  const checksums = batchCreateListItemChecksums(allItems.map(e => e.item));

  // Build portalId → checksum map to attach to each queued job
  const checksumMap = new Map<string, ListingChecksum>(
    checksums.map(cs => [cs.portalId, cs])
  );

  const checksumClient = new ChecksumClient(
    process.env.INGEST_API_URL || 'http://cz-ingest:3000',
    process.env.INGEST_API_KEY || process.env[`INGEST_API_KEY_REALITY`] || 'dev_key_cz_1'
  );

  const comparison = await checksumClient.compareChecksumsInBatches(
    checksums,
    scrapeRunId,
    CHECKSUM_BATCH_SIZE,
    (current, total) => {
      process.stdout.write(`\r  Comparing: ${current.toLocaleString()}/${total.toLocaleString()}`);
    }
  );
  console.log(''); // newline after progress

  stats.phase2.total = comparison.total;
  stats.phase2.new = comparison.new;
  stats.phase2.changed = comparison.changed;
  stats.phase2.unchanged = comparison.unchanged;
  stats.phase2.savingsPercent = stats.phase2.total > 0
    ? Math.round((stats.phase2.unchanged / stats.phase2.total) * 100)
    : 0;
  stats.phase2.durationMs = Date.now() - phase2Start;

  console.log(`✅ Phase 2 complete in ${(stats.phase2.durationMs / 1000).toFixed(1)}s:`);
  console.log(`  🆕 New:       ${stats.phase2.new}`);
  console.log(`  🔄 Changed:   ${stats.phase2.changed}`);
  console.log(`  ✓  Unchanged: ${stats.phase2.unchanged} (${stats.phase2.savingsPercent}%) — skipped`);

  // NOTE: checksums are NOT saved here — they are saved in detailQueue.ts
  // after each batch is successfully flushed to ingest, preventing stale
  // checksums from masking uningested listings on worker crashes.

  // ============================================================================
  // PHASE 3: Queue only new/changed listings for detail fetch
  // ============================================================================
  console.log('\n📤 PHASE 3: Queuing changed/new listings for detail fetch...');
  const phase3Start = Date.now();

  const toFetch = new Set(
    comparison.results
      .filter((r: ChecksumComparisonResult) => r.status !== 'unchanged')
      .map((r: ChecksumComparisonResult) => r.portalId)
  );

  const jobs: DetailJob[] = allItems
    .filter(({ item }) => toFetch.has(item.id))
    .map(({ item, transactionType }) => ({
      id: item.id,
      transactionType,
      checksum: checksumMap.get(item.id),
    }));

  if (jobs.length > 0) {
    await addDetailJobs(jobs);
  }

  stats.phase3.queued = jobs.length;
  stats.phase3.durationMs = Date.now() - phase3Start;

  console.log(`✅ Phase 3 complete: ${stats.phase3.queued} jobs queued`);

  return stats;
}

export function printThreePhaseSummary(stats: PhaseStats): void {
  const totalMs = stats.phase1.durationMs + stats.phase2.durationMs + stats.phase3.durationMs;
  console.log('\n' + '='.repeat(60));
  console.log('📊 THREE-PHASE SCRAPE SUMMARY (reality.cz)');
  console.log('='.repeat(60));
  console.log(`Phase 1 (Discovery):  ${stats.phase1.totalListings} listings in ${(stats.phase1.durationMs / 1000).toFixed(1)}s`);
  console.log(`Phase 2 (Comparison): ${stats.phase2.total} checksums in ${(stats.phase2.durationMs / 1000).toFixed(1)}s`);
  console.log(`  - New:       ${stats.phase2.new}`);
  console.log(`  - Changed:   ${stats.phase2.changed}`);
  console.log(`  - Unchanged: ${stats.phase2.unchanged} (${stats.phase2.savingsPercent}%)`);
  console.log(`Phase 3 (Queuing):    ${stats.phase3.queued} jobs in ${(stats.phase3.durationMs / 1000).toFixed(1)}s`);
  console.log(`\n💰 Savings: ${stats.phase2.savingsPercent}% fewer detail fetches`);
  console.log(`⏱️  Total: ${(totalMs / 1000).toFixed(1)}s (workers continue in background)`);
  console.log('='.repeat(60) + '\n');
}
