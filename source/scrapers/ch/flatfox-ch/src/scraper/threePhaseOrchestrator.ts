import { ChecksumClient } from '@landomo/core';
import { fetchAllListingPages } from '../utils/fetchData';
import { batchCreateFlatfoxChecksums } from '../utils/checksumExtractor';
import { addDetailJobs } from '../queue/detailQueue';
import { FlatfoxListing } from '../types/flatfoxTypes';

// Flatfox categories based on object_category + offer_type
// Flatfox is primarily rentals but also has some sales
const CATEGORIES = [
  { objectCategory: 'APARTMENT', offerType: 'RENT' },
  { objectCategory: 'APARTMENT', offerType: 'SALE' },
  { objectCategory: 'HOUSE', offerType: 'RENT' },
  { objectCategory: 'HOUSE', offerType: 'SALE' },
  { objectCategory: 'COMMERCIAL', offerType: 'RENT' },
  { objectCategory: 'COMMERCIAL', offerType: 'SALE' },
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

export async function runThreePhaseScrape(scrapeRunId?: string): Promise<PhaseStats> {
  const stats: PhaseStats = {
    phase1: { categoriesProcessed: 0, totalListings: 0, durationMs: 0 },
    phase2: { totalChecked: 0, new: 0, changed: 0, unchanged: 0, savingsPercent: 0, durationMs: 0 },
    phase3: { queued: 0, durationMs: 0 },
  };

  const checksumClient = new ChecksumClient(
    process.env.INGEST_API_URL || 'http://localhost:3000',
    process.env.INGEST_API_KEY || ''
  );

  const phase1Start = Date.now();

  for (const { objectCategory, offerType } of CATEGORIES) {
    console.log(JSON.stringify({ level: 'info', service: 'flatfox-ch', msg: 'Fetching category', objectCategory, offerType }));

    const listings = await fetchAllListingPages(objectCategory, offerType);
    stats.phase1.categoriesProcessed++;
    stats.phase1.totalListings += listings.length;

    console.log(JSON.stringify({ level: 'info', service: 'flatfox-ch', msg: 'Category fetched', objectCategory, offerType, count: listings.length }));

    if (listings.length === 0) continue;

    // Phase 2: Compare checksums
    const phase2Start = Date.now();
    const checksums = batchCreateFlatfoxChecksums(listings);

    const comparison = await checksumClient.compareChecksumsInBatches(
      checksums,
      scrapeRunId,
      5000,
      (current, total) => {
        console.log(JSON.stringify({ level: 'info', service: 'flatfox-ch', msg: 'Checksum progress', objectCategory, offerType, current, total }));
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
      console.error(JSON.stringify({ level: 'error', service: 'flatfox-ch', msg: 'Failed to store checksums', err: error.message }));
    }

    // Phase 3: Queue detail jobs for changed/new
    const phase3Start = Date.now();
    const toFetchSet = new Set(
      comparison.results.filter(r => r.status !== 'unchanged').map(r => r.portalId)
    );

    const jobs = listings
      .filter(listing => toFetchSet.has(listing.pk.toString()))
      .map(listing => ({
        pk: listing.pk,
        listingData: listing,
      }));

    if (jobs.length > 0) {
      await addDetailJobs(jobs);
    }

    stats.phase3.queued += jobs.length;
    stats.phase3.durationMs += Date.now() - phase3Start;

    console.log(JSON.stringify({ level: 'info', service: 'flatfox-ch', msg: 'Category processed', objectCategory, offerType, new: comparison.new, changed: comparison.changed, unchanged: comparison.unchanged, queued: jobs.length }));
  }

  stats.phase1.durationMs = Date.now() - phase1Start;
  stats.phase2.savingsPercent = stats.phase2.totalChecked > 0
    ? Math.round((stats.phase2.unchanged / stats.phase2.totalChecked) * 100)
    : 0;

  return stats;
}

export function printThreePhaseSummary(stats: PhaseStats): void {
  const totalMs = stats.phase1.durationMs + stats.phase2.durationMs + stats.phase3.durationMs;
  console.log(JSON.stringify({
    level: 'info',
    service: 'flatfox-ch',
    msg: 'Three-phase scrape summary',
    phase1: { totalListings: stats.phase1.totalListings, durationMs: stats.phase1.durationMs },
    phase2: { totalChecked: stats.phase2.totalChecked, new: stats.phase2.new, changed: stats.phase2.changed, unchanged: stats.phase2.unchanged, savingsPercent: stats.phase2.savingsPercent, durationMs: stats.phase2.durationMs },
    phase3: { queued: stats.phase3.queued, durationMs: stats.phase3.durationMs },
    totalMs,
  }));
}
