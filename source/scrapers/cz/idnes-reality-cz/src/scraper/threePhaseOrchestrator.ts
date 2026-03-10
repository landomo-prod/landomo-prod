import { ChecksumClient } from '@landomo/core';
import { fetchAllPages, resetAdaptiveDelay } from '../utils/fetchData';
import { batchCreateIdnesChecksums } from '../utils/checksumExtractor';
import { addDetailJobs } from '../queue/detailQueue';

const CATEGORIES = [
  { name: 'Flats for Sale', url: 'https://reality.idnes.cz/s/prodej/byty/', type: 'sale', propertyType: 'apartment' },
  { name: 'Flats for Rent', url: 'https://reality.idnes.cz/s/pronajem/byty/', type: 'rent', propertyType: 'apartment' },
  { name: 'Houses for Sale', url: 'https://reality.idnes.cz/s/prodej/domy/', type: 'sale', propertyType: 'house' },
  { name: 'Houses for Rent', url: 'https://reality.idnes.cz/s/pronajem/domy/', type: 'rent', propertyType: 'house' },
  { name: 'Land for Sale', url: 'https://reality.idnes.cz/s/prodej/pozemky/', type: 'sale', propertyType: 'land' },
  { name: 'Land for Rent', url: 'https://reality.idnes.cz/s/pronajem/pozemky/', type: 'rent', propertyType: 'land' },
  { name: 'Commercial for Sale', url: 'https://reality.idnes.cz/s/prodej/komercni-nemovitosti/', type: 'sale', propertyType: 'commercial' },
  { name: 'Commercial for Rent', url: 'https://reality.idnes.cz/s/pronajem/komercni-nemovitosti/', type: 'rent', propertyType: 'commercial' },
  { name: 'Recreation for Sale', url: 'https://reality.idnes.cz/s/prodej/chaty-chalupy/', type: 'sale', propertyType: 'recreation' },
];

export interface PhaseStats {
  phase1: {
    categoriesProcessed: number;
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
  phase3: {
    queued: number;
    durationMs: number;
  };
}

/**
 * Three-Phase Checksum-Based Scraping Orchestrator for iDNES Reality
 *
 * Phase 1: Collect Checksums (2-5 minutes)
 * - Fetch all listing pages for all 8 categories in parallel
 * - Extract lightweight checksums (price, title, location, area)
 * - ~100k listings, minimal data transfer
 *
 * Phase 2: Detect Changes (10-30 seconds)
 * - Send checksums to ingest API for comparison (batched)
 * - Identify new/changed/unchanged properties
 * - Expected: 90-95% unchanged (no fetch needed)
 *
 * Phase 3: Selective Fetching (10-20 minutes for ~5-10k changed)
 * - Queue only new/changed properties for detail fetching
 * - Use BullMQ queue system with 50-100 workers
 * - ~90% time savings vs full fetch
 *
 * @param scrapeRunId - Optional scrape run ID for tracking
 * @returns Statistics about the scrape
 */
export async function runThreePhaseScrape(scrapeRunId?: string, categories?: string[], maxPages?: number): Promise<PhaseStats> {
  const stats: PhaseStats = {
    phase1: { categoriesProcessed: 0, totalListings: 0, durationMs: 0 },
    phase2: { totalChecked: 0, new: 0, changed: 0, unchanged: 0, savingsPercent: 0, durationMs: 0 },
    phase3: { queued: 0, durationMs: 0 },
  };

  const checksumClient = new ChecksumClient(
    process.env.INGEST_API_URL || 'http://localhost:3000',
    process.env.INGEST_API_KEY || ''
  );

  console.log('\n📋 Starting streaming three-phase scrape (Phase 3 workers start immediately)...');
  const overallStart = Date.now();

  resetAdaptiveDelay();

  // Filter categories if specified (recreation maps to house)
  const effectiveCategories = categories
    ? CATEGORIES.filter(c => categories.includes(c.propertyType) || (c.propertyType === 'recreation' && categories.includes('house')))
    : CATEGORIES;

  if (categories) {
    console.log(`📋 Category filter: ${categories.join(', ')} (${effectiveCategories.length}/${CATEGORIES.length} categories)`);
  }
  if (maxPages) {
    console.log(`📋 Page limit: ${maxPages} pages per category (newest-first quick scan)`);
  }

  // Global dedup: prevent same listing from being queued twice across categories
  const seenIds = new Set<string>();
  let duplicatesSkipped = 0;

  // Phase 3 workers are already running (started in index.ts).
  // We stream pages directly into the detail queue as they arrive —
  // workers start processing from page 1 while Phase 1 crawl continues.

  const phase1Start = Date.now();
  let phase2TotalMs = 0;
  let phase3TotalMs = 0;

  // Run all categories in parallel; each feeds the queue per page (streaming)
  await Promise.all(effectiveCategories.map(async (category) => {
    console.log(`  [${category.name}] Starting...`);
    const categoryStart = Date.now();
    let categoryListings = 0;

    const onPageFetched = async (pageListings: any[]) => {
      if (pageListings.length === 0) return;

      // Deduplicate across categories
      const uniqueListings = pageListings.filter(l => {
        if (!l.id || seenIds.has(l.id)) {
          duplicatesSkipped++;
          return false;
        }
        seenIds.add(l.id);
        return true;
      });
      if (uniqueListings.length === 0) return;
      categoryListings += uniqueListings.length;

      // Phase 2: compare checksums for this page's listings
      const p2Start = Date.now();
      const checksums = batchCreateIdnesChecksums(uniqueListings);
      const checksumMap = new Map(checksums.map(c => [c.portalId, c]));

      let toFetch: any[] = [];
      try {
        const comparison = await checksumClient.compareChecksumsInBatches(checksums, scrapeRunId);
        stats.phase2.totalChecked += comparison.total;
        stats.phase2.new += comparison.new;
        stats.phase2.changed += comparison.changed;
        stats.phase2.unchanged += comparison.unchanged;

        const changedIds = new Set(
          comparison.results.filter((r: any) => r.status !== 'unchanged').map((r: any) => r.portalId)
        );
        toFetch = uniqueListings.filter(l => changedIds.has(l.id));
      } catch (err: any) {
        // Fallback: queue all listings on checksum failure
        console.error(`  [${category.name}] Checksum compare failed: ${err.message}. Queuing all.`);
        toFetch = uniqueListings;
      }
      phase2TotalMs += Date.now() - p2Start;

      // Phase 3: immediately queue new/changed listings for detail fetch
      if (toFetch.length > 0) {
        const p3Start = Date.now();
        const jobs = toFetch.map(listing => ({
          listingId: listing.id,
          url: listing.url,
          propertyType: listing.propertyType,
          transactionType: listing.transactionType,
          checksum: checksumMap.get(listing.id),
        }));
        await addDetailJobs(jobs);
        stats.phase3.queued += jobs.length;
        phase3TotalMs += Date.now() - p3Start;
      }
    };

    await fetchAllPages(category.url, category.type, category.propertyType, 1, onPageFetched, maxPages);

    console.log(`  [${category.name}] ✅ done: ${categoryListings} listings in ${((Date.now() - categoryStart) / 1000).toFixed(1)}s`);
    stats.phase1.categoriesProcessed++;
  }));

  stats.phase1.durationMs = Date.now() - phase1Start;
  stats.phase2.durationMs = phase2TotalMs;
  stats.phase3.durationMs = phase3TotalMs;
  stats.phase1.totalListings = stats.phase2.totalChecked;

  stats.phase2.savingsPercent = stats.phase2.totalChecked > 0
    ? Math.round((stats.phase2.unchanged / stats.phase2.totalChecked) * 100)
    : 100;

  console.log(`\n✅ Streaming crawl done: ${stats.phase2.totalChecked} unique listings (${duplicatesSkipped} cross-category duplicates skipped), ${stats.phase3.queued} queued for detail fetch`);

  return stats;
}

/**
 * Print final summary of three-phase scrape
 */
export function printThreePhaseSummary(stats: PhaseStats): void {
  const totalMs = stats.phase1.durationMs + stats.phase2.durationMs + stats.phase3.durationMs;

  console.log('\n' + '='.repeat(60));
  console.log('📊 THREE-PHASE SCRAPE SUMMARY');
  console.log('='.repeat(60));
  console.log(`Phase 1 (Discovery):   ${stats.phase1.totalListings} listings in ${(stats.phase1.durationMs / 1000).toFixed(1)}s`);
  console.log(`Phase 2 (Comparison):  ${stats.phase2.totalChecked} checksums in ${(stats.phase2.durationMs / 1000).toFixed(1)}s`);
  console.log(`  - New:      ${stats.phase2.new}`);
  console.log(`  - Changed:  ${stats.phase2.changed}`);
  console.log(`  - Unchanged: ${stats.phase2.unchanged} (${stats.phase2.savingsPercent}%)`);
  console.log(`Phase 3 (Queuing):     ${stats.phase3.queued} jobs in ${(stats.phase3.durationMs / 1000).toFixed(1)}s`);
  console.log(`\n💰 Total Savings: ${stats.phase2.savingsPercent}% fewer API calls`);
  console.log(`⏱️  Total Time: ${(totalMs / 1000).toFixed(1)}s (setup only, workers continue)`);
  console.log('='.repeat(60) + '\n');
}
