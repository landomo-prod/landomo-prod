import { ChecksumClient } from '@landomo/core';
import { fetchAllCategories, SEARCH_CATEGORIES, RawListing } from '../scrapers/listingsScraper';
import { batchCreateChecksums } from '../utils/checksumExtractor';
import { addDetailJobs, DetailJob } from '../queue/detailQueue';

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
 * Three-phase checksum-optimized scrape:
 * 1. Discovery: Fetch all listing pages (HTML scraping)
 * 2. Comparison: Detect changes via checksums
 * 3. Selective Fetching: Queue only new/changed properties for detail fetch
 */
export async function runThreePhaseScrape(scrapeRunId?: string, categories?: string[]): Promise<PhaseStats> {
  const stats: PhaseStats = {
    phase1: { categoriesProcessed: 0, totalListings: 0, durationMs: 0 },
    phase2: { totalChecked: 0, new: 0, changed: 0, unchanged: 0, savingsPercent: 0, durationMs: 0 },
    phase3: { queued: 0, durationMs: 0 },
  };

  const checksumClient = new ChecksumClient(
    process.env.INGEST_API_URL || 'http://localhost:3004',
    process.env.INGEST_API_KEY || ''
  );

  // Phase 1: Discovery - fetch all listing pages per category
  const phase1Start = Date.now();

  for (const category of SEARCH_CATEGORIES) {
    if (categories && !categories.includes(category.urlSlug)) continue;

    for (const tx of category.transactionTypes) {
      const { fetchListingPages } = await import('../scrapers/listingsScraper');

      console.log(JSON.stringify({ level: 'info', service: 'nieruchomosci-online-scraper', msg: 'Phase 1: Fetching listings', category: category.urlSlug, transaction: tx.slug }));

      const listings = await fetchListingPages(category, tx.slug, tx.type);
      stats.phase1.categoriesProcessed++;
      stats.phase1.totalListings += listings.length;

      console.log(JSON.stringify({ level: 'info', service: 'nieruchomosci-online-scraper', msg: 'Phase 1: Category fetched', category: category.urlSlug, transaction: tx.slug, count: listings.length }));

      if (listings.length === 0) continue;

      // Phase 2: Compare checksums for this batch
      const phase2Start = Date.now();
      const checksums = batchCreateChecksums(listings);

      const comparison = await checksumClient.compareChecksumsInBatches(
        checksums,
        scrapeRunId,
        5000,
        (current, total) => {
          console.log(JSON.stringify({ level: 'info', service: 'nieruchomosci-online-scraper', msg: 'Checksum progress', category: category.urlSlug, current, total }));
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
        console.error(JSON.stringify({ level: 'error', service: 'nieruchomosci-online-scraper', msg: 'Failed to store checksums', err: error.message }));
      }

      // Phase 3: Queue detail fetches for new/changed
      const phase3Start = Date.now();
      const toFetchSet = new Set(
        comparison.results.filter(r => r.status !== 'unchanged').map(r => r.portalId)
      );

      const jobs: DetailJob[] = listings
        .filter(listing => toFetchSet.has(listing.id))
        .map(listing => ({
          id: listing.id,
          url: listing.detailUrl,
          propertyCategory: listing.propertyCategory,
          transactionType: listing.transactionType,
        }));

      if (jobs.length > 0) {
        await addDetailJobs(jobs);
      }

      stats.phase3.queued += jobs.length;
      stats.phase3.durationMs += Date.now() - phase3Start;

      console.log(JSON.stringify({ level: 'info', service: 'nieruchomosci-online-scraper', msg: 'Category processed', category: category.urlSlug, transaction: tx.slug, new: comparison.new, changed: comparison.changed, unchanged: comparison.unchanged, queued: jobs.length }));
    }
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
    service: 'nieruchomosci-online-scraper',
    msg: 'Three-phase scrape summary',
    phase1: { totalListings: stats.phase1.totalListings, durationMs: stats.phase1.durationMs },
    phase2: { totalChecked: stats.phase2.totalChecked, new: stats.phase2.new, changed: stats.phase2.changed, unchanged: stats.phase2.unchanged, savingsPercent: stats.phase2.savingsPercent, durationMs: stats.phase2.durationMs },
    phase3: { queued: stats.phase3.queued, durationMs: stats.phase3.durationMs },
    totalMs,
  }));
}
