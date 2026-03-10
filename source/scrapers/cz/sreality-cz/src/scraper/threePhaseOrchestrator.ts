import { ChecksumClient } from '@landomo/core';
import { fetchAllListingPages } from '../utils/fetchData';
import { batchCreateSRealityChecksums } from '../utils/checksumExtractor';
import { addDetailJobs } from '../queue/detailQueue';

const CATEGORIES = [1, 2, 3, 4, 5];
const CATEGORY_TYPES = [1, 2, 3]; // 1=sale, 2=rent, 3=auction

export interface PhaseStats {
  phase1: {
    categoriesProcessed: number;
    totalListings: number;
    uniqueListings: number;
    duplicatesSkipped: number;
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

export async function runThreePhaseScrape(scrapeRunId?: string, categories?: string[], maxPages?: number): Promise<PhaseStats> {
  const stats: PhaseStats = {
    phase1: { categoriesProcessed: 0, totalListings: 0, uniqueListings: 0, duplicatesSkipped: 0, durationMs: 0 },
    phase2: { totalChecked: 0, new: 0, changed: 0, unchanged: 0, savingsPercent: 0, durationMs: 0 },
    phase3: { queued: 0, durationMs: 0 },
  };

  const checksumClient = new ChecksumClient(
    process.env.INGEST_API_URL || 'http://localhost:3000',
    process.env.INGEST_API_KEY || ''
  );

  // Global dedup: track seen hash_ids across all categories to avoid queueing duplicates.
  // Parallel page fetching causes pagination drift — the same listing can appear on multiple pages.
  const seenHashIds = new Set<string>();

  const phase1Start = Date.now();

  // Map sreality numeric categories to standard names
  const CATEGORY_MAP: Record<number, string> = {
    1: 'apartment', 2: 'house', 3: 'land', 4: 'commercial', 5: 'commercial'
  };
  const effectiveCategories = categories
    ? CATEGORIES.filter(c => categories.includes(CATEGORY_MAP[c]))
    : CATEGORIES;

  if (categories) {
    console.log(JSON.stringify({ level: 'info', service: 'sreality-scraper', msg: 'Category filter', categories, effectiveCount: effectiveCategories.length, totalCount: CATEGORIES.length }));
  }
  // Always sort by newest (sort=3) — new listings hit the queue within seconds
  const sort = 3;
  if (maxPages) {
    console.log(JSON.stringify({ level: 'info', service: 'sreality-scraper', msg: 'Quick scan mode', maxPages, sort }));
  }

  // Process all category×type combos in parallel; each streams per-batch into Phase 2+3
  const combos = effectiveCategories.flatMap(category =>
    CATEGORY_TYPES.map(categoryType => ({ category, categoryType }))
  );

  await Promise.all(combos.map(async ({ category, categoryType }) => {
    const typeLabel = categoryType === 1 ? 'sale' : categoryType === 2 ? 'rent' : 'auction';
    console.log(JSON.stringify({ level: 'info', service: 'sreality-scraper', msg: 'Fetching category', category, type: typeLabel }));

    const onBatchFetched = async (batchListings: any[]) => {
      if (batchListings.length === 0) return;

      // Deduplicate: skip listings already seen in this run
      const uniqueListings = batchListings.filter(l => {
        const hashId = l.hash_id?.toString();
        if (!hashId || seenHashIds.has(hashId)) return false;
        seenHashIds.add(hashId);
        return true;
      });

      const dupsInBatch = batchListings.length - uniqueListings.length;
      if (dupsInBatch > 0) {
        stats.phase1.duplicatesSkipped += dupsInBatch;
      }

      if (uniqueListings.length === 0) return;

      // Phase 2: compare checksums for this batch immediately
      const phase2Start = Date.now();
      const checksums = batchCreateSRealityChecksums(uniqueListings);
      const checksumMap = new Map(checksums.map(c => [c.portalId, c]));

      let toFetch: any[] = [];
      try {
        const comparison = await checksumClient.compareChecksumsInBatches(checksums, scrapeRunId, 5000);
        stats.phase2.totalChecked += comparison.total;
        stats.phase2.new += comparison.new;
        stats.phase2.changed += comparison.changed;
        stats.phase2.unchanged += comparison.unchanged;
        stats.phase2.durationMs += Date.now() - phase2Start;

        const changedIds = new Set(
          comparison.results.filter((r: any) => r.status !== 'unchanged').map((r: any) => r.portalId)
        );
        toFetch = uniqueListings.filter(l => changedIds.has(l.hash_id.toString()));
      } catch (err: any) {
        console.error(JSON.stringify({ level: 'error', service: 'sreality-scraper', msg: 'Checksum compare failed, queuing all', category, type: typeLabel, err: err.message }));
        toFetch = uniqueListings;
      }

      // Phase 3: queue immediately
      if (toFetch.length > 0) {
        const phase3Start = Date.now();
        const jobs = toFetch.map(listing => ({
          hashId: listing.hash_id,
          category: listing.seo?.category_main_cb ?? 1,
          url: `https://www.sreality.cz/api/cs/v2/estates/${listing.hash_id}`,
          checksum: checksumMap.get(listing.hash_id.toString()),
        }));
        await addDetailJobs(jobs);
        stats.phase3.queued += jobs.length;
        stats.phase3.durationMs += Date.now() - phase3Start;
      }
    };

    await fetchAllListingPages(category, categoryType, maxPages, onBatchFetched, sort);

    stats.phase1.categoriesProcessed++;
    console.log(JSON.stringify({ level: 'info', service: 'sreality-scraper', msg: 'Category done', category, type: typeLabel }));
  }));

  stats.phase1.totalListings = stats.phase2.totalChecked + stats.phase1.duplicatesSkipped;
  stats.phase1.uniqueListings = stats.phase2.totalChecked;
  stats.phase1.durationMs = Date.now() - phase1Start;
  stats.phase2.savingsPercent = stats.phase2.totalChecked > 0
    ? Math.round((stats.phase2.unchanged / stats.phase2.totalChecked) * 100)
    : 0;

  console.log(JSON.stringify({
    level: 'info', service: 'sreality-scraper', msg: 'Three-phase complete',
    totalFetched: stats.phase1.totalListings,
    uniqueListings: stats.phase1.uniqueListings,
    duplicatesSkipped: stats.phase1.duplicatesSkipped,
    new: stats.phase2.new, changed: stats.phase2.changed, unchanged: stats.phase2.unchanged,
    savingsPercent: stats.phase2.savingsPercent, queued: stats.phase3.queued,
  }));

  return stats;
}

export function printThreePhaseSummary(stats: PhaseStats): void {
  const totalMs = stats.phase1.durationMs + stats.phase2.durationMs + stats.phase3.durationMs;
  console.log(JSON.stringify({
    level: 'info',
    service: 'sreality-scraper',
    msg: 'Three-phase scrape summary',
    phase1: { totalFetched: stats.phase1.totalListings, unique: stats.phase1.uniqueListings, duplicatesSkipped: stats.phase1.duplicatesSkipped, durationMs: stats.phase1.durationMs },
    phase2: { totalChecked: stats.phase2.totalChecked, new: stats.phase2.new, changed: stats.phase2.changed, unchanged: stats.phase2.unchanged, savingsPercent: stats.phase2.savingsPercent, durationMs: stats.phase2.durationMs },
    phase3: { queued: stats.phase3.queued, durationMs: stats.phase3.durationMs },
    totalMs,
  }));
}
