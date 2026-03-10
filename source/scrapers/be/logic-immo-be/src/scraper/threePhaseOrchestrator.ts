import { ChecksumClient } from '@landomo/core';
import { fetchAllListingPages } from '../utils/fetchData';
import { batchCreateChecksums } from '../utils/checksumExtractor';
import { addDetailJobs, DetailJob } from '../queue/detailQueue';

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
    process.env.INGEST_API_KEY || 'dev_key_be_1'
  );

  // Phase 1: Fetch all listing pages
  const phase1Start = Date.now();
  console.log(JSON.stringify({ level: 'info', service: 'logic-immo-be-scraper', msg: 'Phase 1: Fetching all listings' }));

  const listings = await fetchAllListingPages();
  stats.phase1.totalListings = listings.length;
  stats.phase1.categoriesProcessed = 1;
  stats.phase1.durationMs = Date.now() - phase1Start;

  console.log(JSON.stringify({ level: 'info', service: 'logic-immo-be-scraper', msg: 'Phase 1 complete', totalListings: listings.length, durationMs: stats.phase1.durationMs }));

  if (listings.length === 0) return stats;

  // Phase 2: Compare checksums
  const phase2Start = Date.now();
  console.log(JSON.stringify({ level: 'info', service: 'logic-immo-be-scraper', msg: 'Phase 2: Comparing checksums' }));

  const checksums = batchCreateChecksums(listings);
  const comparison = await checksumClient.compareChecksumsInBatches(
    checksums,
    scrapeRunId,
    5000,
    (current, total) => {
      console.log(JSON.stringify({ level: 'info', service: 'logic-immo-be-scraper', msg: 'Checksum progress', current, total }));
    }
  );

  stats.phase2.totalChecked = comparison.total;
  stats.phase2.new = comparison.new;
  stats.phase2.changed = comparison.changed;
  stats.phase2.unchanged = comparison.unchanged;
  stats.phase2.durationMs = Date.now() - phase2Start;
  stats.phase2.savingsPercent = comparison.total > 0
    ? Math.round((comparison.unchanged / comparison.total) * 100)
    : 0;

  try {
    await checksumClient.updateChecksums(checksums, scrapeRunId);
  } catch (error: any) {
    console.error(JSON.stringify({ level: 'error', service: 'logic-immo-be-scraper', msg: 'Failed to store checksums', err: error.message }));
  }

  console.log(JSON.stringify({ level: 'info', service: 'logic-immo-be-scraper', msg: 'Phase 2 complete', new: comparison.new, changed: comparison.changed, unchanged: comparison.unchanged }));

  // Phase 3: Queue detail jobs for new/changed
  const phase3Start = Date.now();
  const toFetchSet = new Set(
    comparison.results.filter(r => r.status !== 'unchanged').map(r => r.portalId)
  );

  const jobs: DetailJob[] = listings
    .filter(listing => toFetchSet.has(listing.id?.toString()))
    .map(listing => ({
      listingId: listing.id.toString(),
      category: listing.type || 'apartment',
      transactionType: listing.transaction_type || 'sale',
      url: listing.url,
    }));

  if (jobs.length > 0) {
    await addDetailJobs(jobs);
  }

  stats.phase3.queued = jobs.length;
  stats.phase3.durationMs = Date.now() - phase3Start;

  console.log(JSON.stringify({ level: 'info', service: 'logic-immo-be-scraper', msg: 'Phase 3 complete', queued: jobs.length }));

  return stats;
}

export function printThreePhaseSummary(stats: PhaseStats): void {
  const totalMs = stats.phase1.durationMs + stats.phase2.durationMs + stats.phase3.durationMs;
  console.log(JSON.stringify({
    level: 'info',
    service: 'logic-immo-be-scraper',
    msg: 'Three-phase scrape summary',
    phase1: { totalListings: stats.phase1.totalListings, durationMs: stats.phase1.durationMs },
    phase2: { new: stats.phase2.new, changed: stats.phase2.changed, unchanged: stats.phase2.unchanged, savingsPercent: stats.phase2.savingsPercent },
    phase3: { queued: stats.phase3.queued, durationMs: stats.phase3.durationMs },
    totalMs,
  }));
}
