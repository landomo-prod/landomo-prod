import pLimit from 'p-limit';
import { ChecksumClient } from '@landomo/core';
import { fetchAllListingPages } from '../utils/fetchData';
import { batchCreateFundaChecksums } from '../utils/checksumExtractor';
import { addDetailJobs } from '../queue/detailQueue';
import { FundaSearchResult } from '../types/rawTypes';

const TRANSACTION_TYPES: Array<'koop' | 'huur'> = ['koop', 'huur'];

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

function mapPropertyType(type?: string): string {
  if (!type) return 'apartment';
  const t = type.toLowerCase();
  if (t.includes('woonhuis') || t.includes('villa') || t.includes('herenhuis')) return 'house';
  if (t.includes('bouwgrond') || t.includes('perceel')) return 'land';
  if (t.includes('bedrijf') || t.includes('kantoor') || t.includes('winkel')) return 'commercial';
  return 'apartment';
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

  const limit = pLimit(2);
  const phase1Start = Date.now();

  // Phase 1: Fetch koop and huur in parallel
  const txResults = await Promise.allSettled(
    TRANSACTION_TYPES.map(transactionType => limit(async () => {
      console.log(JSON.stringify({ level: 'info', service: 'funda-scraper', msg: 'Fetching listings', transactionType }));
      const listings = await fetchAllListingPages(transactionType);
      console.log(JSON.stringify({ level: 'info', service: 'funda-scraper', msg: 'Listings fetched', transactionType, count: listings.length }));
      return { transactionType, listings };
    }))
  );

  stats.phase1.durationMs = Date.now() - phase1Start;

  for (const result of txResults) {
    if (result.status !== 'fulfilled') continue;

    const { transactionType, listings } = result.value;
    stats.phase1.categoriesProcessed++;
    stats.phase1.totalListings += listings.length;

    if (listings.length === 0) continue;

    // Phase 2: compare checksums
    const phase2Start = Date.now();
    const checksums = batchCreateFundaChecksums(listings);

    const comparison = await checksumClient.compareChecksumsInBatches(
      checksums,
      scrapeRunId,
      5000,
      (current, total) => {
        console.log(JSON.stringify({ level: 'info', service: 'funda-scraper', msg: 'Checksum progress', transactionType, current, total }));
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
      console.error(JSON.stringify({ level: 'error', service: 'funda-scraper', msg: 'Failed to store checksums', transactionType, err: error.message }));
    }

    // Phase 3: queue detail jobs for new/changed
    const phase3Start = Date.now();
    const toFetchSet = new Set(
      comparison.results.filter(r => r.status !== 'unchanged').map(r => r.portalId)
    );

    const jobs = listings
      .filter(listing => toFetchSet.has(listing.Id?.toString()))
      .map(listing => ({
        listingId: listing.Id?.toString() || listing.GlobalId?.toString(),
        url: listing.URL,
        propertyType: mapPropertyType(listing.Type),
      }));

    if (jobs.length > 0) {
      await addDetailJobs(jobs);
    }

    stats.phase3.queued += jobs.length;
    stats.phase3.durationMs += Date.now() - phase3Start;

    console.log(JSON.stringify({ level: 'info', service: 'funda-scraper', msg: 'Transaction type processed', transactionType, new: comparison.new, changed: comparison.changed, unchanged: comparison.unchanged, queued: jobs.length }));
  }
  stats.phase2.savingsPercent = stats.phase2.totalChecked > 0
    ? Math.round((stats.phase2.unchanged / stats.phase2.totalChecked) * 100)
    : 0;

  return stats;
}

export function printThreePhaseSummary(stats: PhaseStats): void {
  const totalMs = stats.phase1.durationMs + stats.phase2.durationMs + stats.phase3.durationMs;
  console.log(JSON.stringify({
    level: 'info',
    service: 'funda-scraper',
    msg: 'Three-phase scrape summary',
    phase1: { totalListings: stats.phase1.totalListings, durationMs: stats.phase1.durationMs },
    phase2: { totalChecked: stats.phase2.totalChecked, new: stats.phase2.new, changed: stats.phase2.changed, unchanged: stats.phase2.unchanged, savingsPercent: stats.phase2.savingsPercent, durationMs: stats.phase2.durationMs },
    phase3: { queued: stats.phase3.queued, durationMs: stats.phase3.durationMs },
    totalMs,
  }));
}
