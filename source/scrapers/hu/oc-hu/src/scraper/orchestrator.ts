import { ChecksumClient } from '@landomo/core';
import { ListingsScraper } from '../scrapers/listingsScraper';
import { addDetailJobs } from '../queue/detailQueue';
import { createHash } from 'crypto';
import { OcListing } from '../types/ocTypes';

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

function createListingChecksum(listing: OcListing): string {
  const payload = JSON.stringify({
    id: listing.id,
    price: listing.price,
    title: listing.title,
    area: listing.area,
    location: listing.location,
    propertyType: listing.propertyType,
    transactionType: listing.transactionType,
  });
  return createHash('md5').update(payload).digest('hex');
}

export async function runTwoPhaseScrape(
  scrapeRunId?: string,
  maxRegions?: number,
  maxPages?: number
): Promise<PhaseStats> {
  const stats: PhaseStats = {
    phase1: { totalListings: 0, durationMs: 0 },
    phase2: { totalChecked: 0, new: 0, changed: 0, unchanged: 0, savingsPercent: 0, durationMs: 0 },
    phase3: { queued: 0, durationMs: 0 },
  };

  const checksumClient = new ChecksumClient(
    process.env.INGEST_API_URL || 'http://localhost:3004',
    process.env.INGEST_API_KEY || ''
  );

  // Phase 1: Fast scan - fetch all listings from dataLayer
  const phase1Start = Date.now();
  console.log(JSON.stringify({ level: 'info', service: 'oc-hu', msg: 'Phase 1: Fast scan starting' }));

  const scraper = new ListingsScraper();
  const listings = await scraper.scrapeAll(maxRegions, maxPages);
  stats.phase1.totalListings = listings.length;
  stats.phase1.durationMs = Date.now() - phase1Start;

  console.log(JSON.stringify({ level: 'info', service: 'oc-hu', msg: 'Phase 1 complete', totalListings: listings.length, durationMs: stats.phase1.durationMs }));

  if (listings.length === 0) return stats;

  // Phase 2: Checksum comparison
  const phase2Start = Date.now();
  console.log(JSON.stringify({ level: 'info', service: 'oc-hu', msg: 'Phase 2: Checksum comparison starting' }));

  const checksums = listings.map(listing => ({
    portal: 'oc-hu',
    portalId: listing.id,
    contentHash: createListingChecksum(listing),
  }));

  const comparison = await checksumClient.compareChecksumsInBatches(
    checksums,
    scrapeRunId,
    5000,
    (current, total) => {
      console.log(JSON.stringify({ level: 'info', service: 'oc-hu', msg: 'Checksum progress', current, total }));
    }
  );

  stats.phase2.totalChecked = comparison.total;
  stats.phase2.new = comparison.new;
  stats.phase2.changed = comparison.changed;
  stats.phase2.unchanged = comparison.unchanged;
  stats.phase2.durationMs = Date.now() - phase2Start;
  stats.phase2.savingsPercent = stats.phase2.totalChecked > 0
    ? Math.round((stats.phase2.unchanged / stats.phase2.totalChecked) * 100)
    : 0;

  console.log(JSON.stringify({ level: 'info', service: 'oc-hu', msg: 'Phase 2 complete', new: comparison.new, changed: comparison.changed, unchanged: comparison.unchanged, savingsPercent: stats.phase2.savingsPercent }));

  // Store checksums
  try {
    await checksumClient.updateChecksums(checksums, scrapeRunId);
  } catch (error: any) {
    console.error(JSON.stringify({ level: 'error', service: 'oc-hu', msg: 'Failed to store checksums', err: error.message }));
  }

  // Phase 3: Queue new/changed listings for transform + ingest
  const phase3Start = Date.now();
  const toFetchSet = new Set(
    comparison.results.filter(r => r.status !== 'unchanged').map(r => r.portalId)
  );

  const toProcess = listings.filter(listing => toFetchSet.has(listing.id));

  if (toProcess.length > 0) {
    await addDetailJobs(toProcess);
  }

  stats.phase3.queued = toProcess.length;
  stats.phase3.durationMs = Date.now() - phase3Start;

  console.log(JSON.stringify({ level: 'info', service: 'oc-hu', msg: 'Phase 3 complete', queued: toProcess.length }));

  return stats;
}

export function printPhaseSummary(stats: PhaseStats): void {
  const totalMs = stats.phase1.durationMs + stats.phase2.durationMs + stats.phase3.durationMs;
  console.log(JSON.stringify({
    level: 'info',
    service: 'oc-hu',
    msg: 'Two-phase scrape summary',
    phase1: { totalListings: stats.phase1.totalListings, durationMs: stats.phase1.durationMs },
    phase2: { totalChecked: stats.phase2.totalChecked, new: stats.phase2.new, changed: stats.phase2.changed, unchanged: stats.phase2.unchanged, savingsPercent: stats.phase2.savingsPercent, durationMs: stats.phase2.durationMs },
    phase3: { queued: stats.phase3.queued, durationMs: stats.phase3.durationMs },
    totalMs,
  }));
}
