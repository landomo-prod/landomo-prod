import { ChecksumClient } from '@landomo/core';
import { fetchAllListingPages } from '../scrapers/listingsScraper';
import { batchCreateFotocasaChecksums } from '../utils/checksumExtractor';
import { addDetailJobs } from '../queue/detailQueue';
import { FotocasaListing } from '../types/fotocasaTypes';

export interface PhaseStats {
  phase1: {
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

export async function runThreePhaseScrape(scrapeRunId?: string): Promise<PhaseStats> {
  const stats: PhaseStats = {
    phase1: { totalListings: 0, durationMs: 0 },
    phase2: { totalChecked: 0, new: 0, changed: 0, unchanged: 0, savingsPercent: 0, durationMs: 0 },
    phase3: { queued: 0, durationMs: 0 },
  };

  const checksumClient = new ChecksumClient(
    process.env.INGEST_API_URL || 'http://localhost:3000',
    process.env.INGEST_API_KEY || '',
  );

  // Phase 1: Fetch all listings from search API
  const phase1Start = Date.now();
  console.log(JSON.stringify({ level: 'info', service: 'fotocasa-scraper', msg: 'Phase 1: Fetching all listings' }));

  const listings = await fetchAllListingPages();
  stats.phase1.totalListings = listings.length;
  stats.phase1.durationMs = Date.now() - phase1Start;

  console.log(JSON.stringify({ level: 'info', service: 'fotocasa-scraper', msg: 'Phase 1 complete', totalListings: listings.length, durationMs: stats.phase1.durationMs }));

  if (listings.length === 0) return stats;

  // Phase 2: Compare checksums
  const phase2Start = Date.now();
  console.log(JSON.stringify({ level: 'info', service: 'fotocasa-scraper', msg: 'Phase 2: Comparing checksums' }));

  const checksums = batchCreateFotocasaChecksums(listings);

  const comparison = await checksumClient.compareChecksumsInBatches(
    checksums,
    scrapeRunId,
    5000,
    (current, total) => {
      console.log(JSON.stringify({ level: 'info', service: 'fotocasa-scraper', msg: 'Checksum progress', current, total }));
    },
  );

  stats.phase2.totalChecked = comparison.total;
  stats.phase2.new = comparison.new;
  stats.phase2.changed = comparison.changed;
  stats.phase2.unchanged = comparison.unchanged;
  stats.phase2.durationMs = Date.now() - phase2Start;
  stats.phase2.savingsPercent = stats.phase2.totalChecked > 0
    ? Math.round((stats.phase2.unchanged / stats.phase2.totalChecked) * 100)
    : 0;

  // Store checksums
  try {
    await checksumClient.updateChecksums(checksums, scrapeRunId);
  } catch (error: any) {
    console.error(JSON.stringify({ level: 'error', service: 'fotocasa-scraper', msg: 'Failed to store checksums', err: error.message }));
  }

  console.log(JSON.stringify({ level: 'info', service: 'fotocasa-scraper', msg: 'Phase 2 complete', new: comparison.new, changed: comparison.changed, unchanged: comparison.unchanged, savingsPercent: stats.phase2.savingsPercent }));

  // Phase 3: Queue new/changed listings for processing
  const phase3Start = Date.now();
  const toFetchSet = new Set(
    comparison.results.filter((r) => r.status !== 'unchanged').map((r) => r.portalId),
  );

  const toProcess = listings.filter((listing) => toFetchSet.has(listing.id.toString()));

  if (toProcess.length > 0) {
    await addDetailJobs(toProcess);
  }

  stats.phase3.queued = toProcess.length;
  stats.phase3.durationMs = Date.now() - phase3Start;

  console.log(JSON.stringify({ level: 'info', service: 'fotocasa-scraper', msg: 'Phase 3 complete', queued: toProcess.length }));

  return stats;
}

export function printThreePhaseSummary(stats: PhaseStats): void {
  const totalMs = stats.phase1.durationMs + stats.phase2.durationMs + stats.phase3.durationMs;
  console.log(JSON.stringify({
    level: 'info',
    service: 'fotocasa-scraper',
    msg: 'Three-phase scrape summary',
    phase1: { totalListings: stats.phase1.totalListings, durationMs: stats.phase1.durationMs },
    phase2: { totalChecked: stats.phase2.totalChecked, new: stats.phase2.new, changed: stats.phase2.changed, unchanged: stats.phase2.unchanged, savingsPercent: stats.phase2.savingsPercent, durationMs: stats.phase2.durationMs },
    phase3: { queued: stats.phase3.queued, durationMs: stats.phase3.durationMs },
    totalMs,
  }));
}
