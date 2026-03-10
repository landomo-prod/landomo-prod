import { ChecksumClient } from '@landomo/core';
import { ListingsScraper } from '../scrapers/listingsScraper';
import { batchCreateImmoweltATChecksums } from '../utils/checksumExtractor';
import { addDetailJobs } from '../queue/detailQueue';

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
    process.env.INGEST_API_URL || 'http://localhost:3011',
    process.env.INGEST_API_KEY || 'dev_key_at_1'
  );

  const phase1Start = Date.now();

  // Phase 1: Use existing ListingsScraper to discover all listings
  const scraper = new ListingsScraper();

  try {
    console.log(JSON.stringify({ level: 'info', service: 'immowelt-at-scraper', msg: 'Phase 1: Fetching all listings' }));

    const listings = await scraper.scrapeAll();
    stats.phase1.categoriesProcessed = 4; // apartment sale/rent, house sale/rent
    stats.phase1.totalListings = listings.length;

    console.log(JSON.stringify({ level: 'info', service: 'immowelt-at-scraper', msg: 'Phase 1 complete', count: listings.length }));

    if (listings.length === 0) {
      stats.phase1.durationMs = Date.now() - phase1Start;
      return stats;
    }

    // Phase 2: Compare checksums
    const phase2Start = Date.now();
    const checksums = batchCreateImmoweltATChecksums(listings);

    if (checksums.length > 0) {
      const comparison = await checksumClient.compareChecksumsInBatches(
        checksums,
        scrapeRunId,
        5000,
        (current, total) => {
          console.log(JSON.stringify({ level: 'info', service: 'immowelt-at-scraper', msg: 'Checksum progress', current, total }));
        }
      );

      stats.phase2.totalChecked = comparison.total;
      stats.phase2.new = comparison.new;
      stats.phase2.changed = comparison.changed;
      stats.phase2.unchanged = comparison.unchanged;
      stats.phase2.durationMs = Date.now() - phase2Start;

      // Store checksums
      try {
        await checksumClient.updateChecksums(checksums, scrapeRunId);
      } catch (error: any) {
        console.error(JSON.stringify({ level: 'error', service: 'immowelt-at-scraper', msg: 'Failed to store checksums', err: error.message }));
      }

      // Phase 3: Queue detail jobs for new/changed
      const phase3Start = Date.now();
      const toFetchSet = new Set(
        comparison.results.filter(r => r.status !== 'unchanged').map(r => r.portalId)
      );

      const jobs = listings
        .filter(listing => toFetchSet.has(listing.id?.toString()))
        .map(listing => ({
          listingId: listing.id,
          url: listing.url || `https://www.immowelt.at/expose/${listing.id}`,
          transactionType: listing.transactionType,
          propertyType: listing.propertyType,
          searchData: listing,
        }));

      if (jobs.length > 0) {
        await addDetailJobs(jobs);
      }

      stats.phase3.queued = jobs.length;
      stats.phase3.durationMs = Date.now() - phase3Start;

      console.log(JSON.stringify({ level: 'info', service: 'immowelt-at-scraper', msg: 'Phase 2+3 complete', new: comparison.new, changed: comparison.changed, unchanged: comparison.unchanged, queued: jobs.length }));
    }
  } finally {
    await scraper.close();
  }

  stats.phase1.durationMs = Date.now() - phase1Start;
  stats.phase2.savingsPercent = stats.phase2.totalChecked > 0
    ? Math.round((stats.phase2.unchanged / stats.phase2.totalChecked) * 100)
    : 0;

  console.log(JSON.stringify({ level: 'info', service: 'immowelt-at-scraper', msg: 'Three-phase complete', totalListings: stats.phase1.totalListings, new: stats.phase2.new, changed: stats.phase2.changed, unchanged: stats.phase2.unchanged, savingsPercent: stats.phase2.savingsPercent, queued: stats.phase3.queued }));

  return stats;
}

export function printThreePhaseSummary(stats: PhaseStats): void {
  const totalMs = stats.phase1.durationMs + stats.phase2.durationMs + stats.phase3.durationMs;
  console.log(JSON.stringify({
    level: 'info',
    service: 'immowelt-at-scraper',
    msg: 'Three-phase scrape summary',
    phase1: { totalListings: stats.phase1.totalListings, durationMs: stats.phase1.durationMs },
    phase2: { totalChecked: stats.phase2.totalChecked, new: stats.phase2.new, changed: stats.phase2.changed, unchanged: stats.phase2.unchanged, savingsPercent: stats.phase2.savingsPercent, durationMs: stats.phase2.durationMs },
    phase3: { queued: stats.phase3.queued, durationMs: stats.phase3.durationMs },
    totalMs,
  }));
}
