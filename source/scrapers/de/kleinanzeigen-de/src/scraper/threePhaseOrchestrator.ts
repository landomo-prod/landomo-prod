import { ChecksumClient } from '@landomo/core';
import { batchCreateKleinanzeigenChecksums } from '../utils/checksumExtractor';
import { addDetailJobs } from '../queue/detailQueue';
import { REAL_ESTATE_CATEGORIES, KleinanzeigenListing } from '../types/kleinanzeigenTypes';
import { getMobileUserAgent } from '../utils/userAgents';
import { fetchListingsByState } from '../utils/fetchData';

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
    process.env.INGEST_API_URL || 'http://localhost:3010',
    process.env.INGEST_API_KEY || ''
  );

  const categories = [
    REAL_ESTATE_CATEGORIES.APARTMENTS_RENT,
    REAL_ESTATE_CATEGORIES.APARTMENTS_SALE,
    REAL_ESTATE_CATEGORIES.HOUSES_RENT,
    REAL_ESTATE_CATEGORIES.HOUSES_SALE,
    REAL_ESTATE_CATEGORIES.LAND_GARDENS,
    REAL_ESTATE_CATEGORIES.COMMERCIAL,
    REAL_ESTATE_CATEGORIES.PARKING,
    REAL_ESTATE_CATEGORIES.TEMPORARY_SHARED,
    REAL_ESTATE_CATEGORIES.VACATION_FOREIGN,
    REAL_ESTATE_CATEGORIES.CONTAINERS,
    REAL_ESTATE_CATEGORIES.NEW_CONSTRUCTION,
    REAL_ESTATE_CATEGORIES.MISCELLANEOUS,
  ];

  const phase1Start = Date.now();
  const userAgent = getMobileUserAgent();

  for (const categoryId of categories) {
    // Phase 1: Fetch listings for this category across all German states
    console.log(JSON.stringify({ level: 'info', service: 'kleinanzeigen-scraper', msg: 'Fetching category', categoryId }));

    const listings = await fetchListingsByState(categoryId, userAgent);

    stats.phase1.categoriesProcessed++;
    stats.phase1.totalListings += listings.length;

    console.log(JSON.stringify({ level: 'info', service: 'kleinanzeigen-scraper', msg: 'Category fetched', categoryId, count: listings.length }));

    if (listings.length === 0) continue;

    // Process in batches of 5000
    const BATCH_SIZE = 5000;
    for (let i = 0; i < listings.length; i += BATCH_SIZE) {
      const batch = listings.slice(i, i + BATCH_SIZE);

      // Phase 2: Compare checksums
      const phase2Start = Date.now();
      const checksums = batchCreateKleinanzeigenChecksums(batch);

      const comparison = await checksumClient.compareChecksumsInBatches(
        checksums,
        scrapeRunId,
        5000,
        (current, total) => {
          console.log(JSON.stringify({ level: 'info', service: 'kleinanzeigen-scraper', msg: 'Checksum progress', categoryId, current, total }));
        }
      );

      stats.phase2.totalChecked += comparison.total;
      stats.phase2.new += comparison.new;
      stats.phase2.changed += comparison.changed;
      stats.phase2.unchanged += comparison.unchanged;
      stats.phase2.durationMs += Date.now() - phase2Start;

      // Store checksums
      try {
        await checksumClient.updateChecksums(checksums, scrapeRunId);
      } catch (error: any) {
        console.error(JSON.stringify({ level: 'error', service: 'kleinanzeigen-scraper', msg: 'Failed to store checksums', categoryId, err: error.message }));
      }

      // Phase 3: Queue new/changed for detail fetch + ingestion
      const phase3Start = Date.now();
      const toFetchSet = new Set(
        comparison.results.filter((r) => r.status !== 'unchanged').map((r) => r.portalId)
      );

      const jobs = batch
        .filter((listing) => toFetchSet.has(listing.id?.toString()))
        .map((listing) => ({
          listingId: listing.id,
          categoryId: listing.categoryId || listing.category?.id,
        }));

      if (jobs.length > 0) {
        await addDetailJobs(jobs);
      }

      stats.phase3.queued += jobs.length;
      stats.phase3.durationMs += Date.now() - phase3Start;
    }

    console.log(JSON.stringify({ level: 'info', service: 'kleinanzeigen-scraper', msg: 'Category processed', categoryId, totalListings: listings.length }));
  }

  stats.phase1.durationMs = Date.now() - phase1Start;
  stats.phase2.savingsPercent = stats.phase2.totalChecked > 0
    ? Math.round((stats.phase2.unchanged / stats.phase2.totalChecked) * 100)
    : 0;

  console.log(JSON.stringify({ level: 'info', service: 'kleinanzeigen-scraper', msg: 'Three-phase complete', totalListings: stats.phase1.totalListings, new: stats.phase2.new, changed: stats.phase2.changed, unchanged: stats.phase2.unchanged, savingsPercent: stats.phase2.savingsPercent, queued: stats.phase3.queued }));

  return stats;
}

export function printThreePhaseSummary(stats: PhaseStats): void {
  const totalMs = stats.phase1.durationMs + stats.phase2.durationMs + stats.phase3.durationMs;
  console.log(JSON.stringify({
    level: 'info',
    service: 'kleinanzeigen-scraper',
    msg: 'Three-phase scrape summary',
    phase1: { totalListings: stats.phase1.totalListings, categoriesProcessed: stats.phase1.categoriesProcessed, durationMs: stats.phase1.durationMs },
    phase2: { totalChecked: stats.phase2.totalChecked, new: stats.phase2.new, changed: stats.phase2.changed, unchanged: stats.phase2.unchanged, savingsPercent: stats.phase2.savingsPercent, durationMs: stats.phase2.durationMs },
    phase3: { queued: stats.phase3.queued, durationMs: stats.phase3.durationMs },
    totalMs,
  }));
}
