import { ChecksumClient } from '@landomo/core';
import { fetchAllListingPages, getAllCategoryConfigs, CategoryScrapeConfig } from '../scrapers/listingsScraper';
import { batchCreateAdresowoChecksums } from '../utils/checksumExtractor';
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
    process.env.INGEST_API_URL || 'http://localhost:3004',
    process.env.INGEST_API_KEY || ''
  );

  const configs = getAllCategoryConfigs();
  const phase1Start = Date.now();

  for (const config of configs) {
    const label = `${config.transactionSlug} (${config.transactionType})`;

    // Phase 1: Fetch all listing pages for this category
    console.log(JSON.stringify({ level: 'info', service: 'adresowo-scraper', msg: 'Phase 1: Fetching listings', category: label }));
    const listings = await fetchAllListingPages(config);
    stats.phase1.categoriesProcessed++;
    stats.phase1.totalListings += listings.length;
    console.log(JSON.stringify({ level: 'info', service: 'adresowo-scraper', msg: 'Category fetched', category: label, count: listings.length }));

    if (listings.length === 0) continue;

    // Phase 2: Compare checksums
    const phase2Start = Date.now();
    const checksums = batchCreateAdresowoChecksums(listings);

    const comparison = await checksumClient.compareChecksumsInBatches(
      checksums,
      scrapeRunId,
      2000,
      (current, total) => {
        console.log(JSON.stringify({ level: 'info', service: 'adresowo-scraper', msg: 'Checksum progress', category: label, current, total }));
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
      console.error(JSON.stringify({ level: 'error', service: 'adresowo-scraper', msg: 'Failed to store checksums', category: label, err: error.message }));
    }

    // Phase 3: Queue detail jobs for new/changed listings
    const phase3Start = Date.now();
    const toFetchSet = new Set(
      comparison.results.filter((r) => r.status !== 'unchanged').map((r) => r.portalId)
    );

    const jobs = listings
      .filter((listing) => toFetchSet.has(listing.portalId))
      .map((listing) => ({
        portalId: listing.portalId,
        url: listing.url,
        categorySlug: config.transactionSlug,
        summary: listing,
      }));

    if (jobs.length > 0) {
      await addDetailJobs(jobs);
    }

    stats.phase3.queued += jobs.length;
    stats.phase3.durationMs += Date.now() - phase3Start;

    console.log(JSON.stringify({ level: 'info', service: 'adresowo-scraper', msg: 'Category processed', category: label, new: comparison.new, changed: comparison.changed, unchanged: comparison.unchanged, queued: jobs.length }));
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
    service: 'adresowo-scraper',
    msg: 'Three-phase scrape summary',
    phase1: { totalListings: stats.phase1.totalListings, durationMs: stats.phase1.durationMs },
    phase2: { totalChecked: stats.phase2.totalChecked, new: stats.phase2.new, changed: stats.phase2.changed, unchanged: stats.phase2.unchanged, savingsPercent: stats.phase2.savingsPercent, durationMs: stats.phase2.durationMs },
    phase3: { queued: stats.phase3.queued, durationMs: stats.phase3.durationMs },
    totalMs,
  }));
}
