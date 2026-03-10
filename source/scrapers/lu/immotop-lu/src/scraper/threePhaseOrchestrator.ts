import pLimit from 'p-limit';
import { ChecksumClient } from '@landomo/core';
import { fetchAllListingPages, SEARCH_CONFIGS, DiscoveredListing } from '../utils/fetchData';
import { batchCreateChecksums } from '../utils/checksumExtractor';
import { addDetailJobs } from '../queue/detailQueue';

export interface PhaseStats {
  phase1: { categoriesProcessed: number; totalListings: number; durationMs: number };
  phase2: { totalChecked: number; new: number; changed: number; unchanged: number; savingsPercent: number; durationMs: number };
  phase3: { queued: number; durationMs: number };
}

export async function runThreePhaseScrape(scrapeRunId?: string): Promise<PhaseStats> {
  const stats: PhaseStats = {
    phase1: { categoriesProcessed: 0, totalListings: 0, durationMs: 0 },
    phase2: { totalChecked: 0, new: 0, changed: 0, unchanged: 0, savingsPercent: 0, durationMs: 0 },
    phase3: { queued: 0, durationMs: 0 },
  };

  const checksumClient = new ChecksumClient(
    process.env.INGEST_API_URL || 'http://localhost:3004',
    process.env.INGEST_API_KEY || 'dev_key_lu_1'
  );

  // Phase 1: Fetch all categories in parallel (p-limit 3)
  const limit = pLimit(3);
  const phase1Start = Date.now();

  const configResults = await Promise.allSettled(
    SEARCH_CONFIGS.map(config => limit(async () => {
      console.log(JSON.stringify({ level: 'info', service: 'immotop-scraper', msg: 'Fetching category', category: config.category, transaction: config.transaction }));

      const listings = await fetchAllListingPages(config.path, config.category, config.transaction);
      console.log(JSON.stringify({ level: 'info', service: 'immotop-scraper', msg: 'Category fetched', category: config.category, transaction: config.transaction, count: listings.length }));

      return { config, listings };
    }))
  );

  stats.phase1.durationMs = Date.now() - phase1Start;

  // Process phase 2 & 3 for each successful result
  for (const result of configResults) {
    if (result.status !== 'fulfilled') continue;

    const { config, listings } = result.value;
    stats.phase1.categoriesProcessed++;
    stats.phase1.totalListings += listings.length;

    if (listings.length === 0) continue;

    // Phase 2: Compare checksums
    const phase2Start = Date.now();
    const checksums = batchCreateChecksums(listings);

    const comparison = await checksumClient.compareChecksumsInBatches(
      checksums, scrapeRunId, 5000,
      (current, total) => {
        console.log(JSON.stringify({ level: 'info', service: 'immotop-scraper', msg: 'Checksum progress', category: config.category, current, total }));
      }
    );

    stats.phase2.totalChecked += comparison.total;
    stats.phase2.new += comparison.new;
    stats.phase2.changed += comparison.changed;
    stats.phase2.unchanged += comparison.unchanged;
    stats.phase2.durationMs += Date.now() - phase2Start;

    try {
      await checksumClient.updateChecksums(checksums, scrapeRunId);
    } catch (error: any) {
      console.error(JSON.stringify({ level: 'error', service: 'immotop-scraper', msg: 'Failed to store checksums', err: error.message }));
    }

    // Phase 3: Queue detail jobs for new/changed
    const phase3Start = Date.now();
    const toFetchSet = new Set(
      comparison.results.filter(r => r.status !== 'unchanged').map(r => r.portalId)
    );

    const jobs = listings
      .filter(l => toFetchSet.has(`immotop-${l.id}`))
      .map(l => ({
        listingId: l.id,
        category: config.category,
        transactionType: config.transaction,
        url: l.url,
      }));

    if (jobs.length > 0) {
      await addDetailJobs(jobs);
    }

    stats.phase3.queued += jobs.length;
    stats.phase3.durationMs += Date.now() - phase3Start;

    console.log(JSON.stringify({ level: 'info', service: 'immotop-scraper', msg: 'Category processed', category: config.category, transaction: config.transaction, new: comparison.new, changed: comparison.changed, unchanged: comparison.unchanged, queued: jobs.length }));
  }

  stats.phase2.savingsPercent = stats.phase2.totalChecked > 0
    ? Math.round((stats.phase2.unchanged / stats.phase2.totalChecked) * 100)
    : 0;

  return stats;
}

export function printThreePhaseSummary(stats: PhaseStats): void {
  console.log(JSON.stringify({
    level: 'info', service: 'immotop-scraper', msg: 'Three-phase scrape summary',
    phase1: stats.phase1, phase2: stats.phase2, phase3: stats.phase3,
    totalMs: stats.phase1.durationMs + stats.phase2.durationMs + stats.phase3.durationMs,
  }));
}
