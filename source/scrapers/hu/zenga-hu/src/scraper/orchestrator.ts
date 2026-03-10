import { ChecksumClient } from '@landomo/core';
import { ListingsScraper } from '../scrapers/listingsScraper';
import { addDetailJobs } from '../queue/detailQueue';
import { createHash } from 'crypto';
import { ZengaListing } from '../types/zengaTypes';

const log = (level: string, msg: string, extra: Record<string, any> = {}) =>
  console.log(JSON.stringify({ level, service: 'zenga-hu', msg, ...extra }));

export interface PhaseStats {
  phase1: {
    regionsProcessed: number;
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

function createListingChecksum(listing: ZengaListing): string {
  const key = `${listing.price}|${listing.area}|${listing.rooms}|${listing.title}|${listing.modifiedDate || ''}`;
  return createHash('md5').update(key).digest('hex');
}

export async function runTwoPhaseScrape(scrapeRunId?: string): Promise<PhaseStats> {
  const stats: PhaseStats = {
    phase1: { regionsProcessed: 0, totalListings: 0, durationMs: 0 },
    phase2: { totalChecked: 0, new: 0, changed: 0, unchanged: 0, savingsPercent: 0, durationMs: 0 },
    phase3: { queued: 0, durationMs: 0 },
  };

  const checksumClient = new ChecksumClient(
    process.env.INGEST_API_URL || 'http://localhost:3004',
    process.env.INGEST_API_KEY || ''
  );

  const scraper = new ListingsScraper();

  // Phase 1: Fast scan - fetch all listings from API
  const phase1Start = Date.now();
  log('info', 'Phase 1: Starting fast scan');

  const allListings = await scraper.scrapeAll();
  stats.phase1.totalListings = allListings.length;
  stats.phase1.regionsProcessed = scraper.getRegionCount();
  stats.phase1.durationMs = Date.now() - phase1Start;

  log('info', 'Phase 1 complete', { totalListings: allListings.length, durationMs: stats.phase1.durationMs });

  if (allListings.length === 0) return stats;

  // Phase 2: Checksum comparison - filter new/changed
  const phase2Start = Date.now();
  log('info', 'Phase 2: Comparing checksums');

  const checksums = allListings.map(listing => ({
    portal: 'zenga-hu',
    portalId: `zenga-${listing.id}`,
    contentHash: createListingChecksum(listing),
  }));

  const comparison = await checksumClient.compareChecksumsInBatches(
    checksums,
    scrapeRunId,
    5000,
    (current, total) => {
      log('info', 'Checksum progress', { current, total });
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

  // Store checksums
  try {
    await checksumClient.updateChecksums(checksums, scrapeRunId);
  } catch (error: any) {
    log('error', 'Failed to store checksums', { err: error.message });
  }

  log('info', 'Phase 2 complete', {
    new: comparison.new,
    changed: comparison.changed,
    unchanged: comparison.unchanged,
    savingsPercent: stats.phase2.savingsPercent,
  });

  // Phase 3: Queue new/changed listings for ingestion
  const phase3Start = Date.now();
  const toFetchSet = new Set(
    comparison.results.filter(r => r.status !== 'unchanged').map(r => r.portalId)
  );

  const listingsToIngest = allListings.filter(
    listing => toFetchSet.has(`zenga-${listing.id}`)
  );

  if (listingsToIngest.length > 0) {
    await addDetailJobs(listingsToIngest.map(listing => ({ listing })));
  }

  stats.phase3.queued = listingsToIngest.length;
  stats.phase3.durationMs = Date.now() - phase3Start;

  log('info', 'Phase 3 complete', { queued: stats.phase3.queued });

  return stats;
}

export function printPhaseSummary(stats: PhaseStats): void {
  const totalMs = stats.phase1.durationMs + stats.phase2.durationMs + stats.phase3.durationMs;
  log('info', 'Two-phase scrape summary', {
    phase1: { totalListings: stats.phase1.totalListings, durationMs: stats.phase1.durationMs },
    phase2: { totalChecked: stats.phase2.totalChecked, new: stats.phase2.new, changed: stats.phase2.changed, unchanged: stats.phase2.unchanged, savingsPercent: stats.phase2.savingsPercent, durationMs: stats.phase2.durationMs },
    phase3: { queued: stats.phase3.queued, durationMs: stats.phase3.durationMs },
    totalMs,
  });
}
