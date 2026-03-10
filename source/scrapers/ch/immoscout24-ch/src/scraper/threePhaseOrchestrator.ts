import { ChecksumClient } from '@landomo/core';
import { fetchAllProperties } from '../utils/fetchData';
import { batchCreateChecksums } from '../utils/checksumExtractor';
import { addDetailJobs } from '../queue/detailQueue';

/**
 * Search configurations for Swiss property categories
 * NOTE: offerTypeId and propertyType params need verification against the live API.
 * Based on research: s=offerType (buy/rent), t=propertyTypeId
 */
const SEARCH_CONFIGS = [
  { offerType: 'buy', propertyType: 'apartment', label: 'apartment-sale' },
  { offerType: 'rent', propertyType: 'apartment', label: 'apartment-rent' },
  { offerType: 'buy', propertyType: 'house', label: 'house-sale' },
  { offerType: 'rent', propertyType: 'house', label: 'house-rent' },
  { offerType: 'buy', propertyType: 'land', label: 'land-sale' },
  { offerType: 'buy', propertyType: 'commercial', label: 'commercial-sale' },
  { offerType: 'rent', propertyType: 'commercial', label: 'commercial-rent' },
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
    process.env.INGEST_API_URL || 'http://localhost:3010',
    process.env.INGEST_API_KEY || ''
  );

  const phase1Start = Date.now();

  for (const config of SEARCH_CONFIGS) {
    console.log(JSON.stringify({ level: 'info', service: 'immoscout24-ch', msg: 'Fetching category', category: config.label }));

    const response = await fetchAllProperties({
      s: config.offerType === 'buy' ? 1 : 2,
      t: config.propertyType,
    });

    const listings = response.items || [];
    stats.phase1.categoriesProcessed++;
    stats.phase1.totalListings += listings.length;
    console.log(JSON.stringify({ level: 'info', service: 'immoscout24-ch', msg: 'Category fetched', category: config.label, count: listings.length }));

    if (listings.length === 0) continue;

    // Phase 2: compare checksums
    const phase2Start = Date.now();
    const checksums = batchCreateChecksums(listings);

    const comparison = await checksumClient.compareChecksumsInBatches(
      checksums,
      scrapeRunId,
      5000,
      (current, total) => {
        console.log(JSON.stringify({ level: 'info', service: 'immoscout24-ch', msg: 'Checksum progress', category: config.label, current, total }));
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
      console.error(JSON.stringify({ level: 'error', service: 'immoscout24-ch', msg: 'Failed to store checksums', category: config.label, err: error.message }));
    }

    // Phase 3: queue detail jobs for new/changed
    const phase3Start = Date.now();
    const toFetchSet = new Set(
      comparison.results.filter((r) => r.status !== 'unchanged').map((r) => r.portalId)
    );

    const jobs = listings
      .filter((listing: any) => toFetchSet.has(listing.id?.toString()))
      .map((listing: any) => ({
        propertyId: listing.id.toString(),
        category: config.label,
      }));

    if (jobs.length > 0) {
      await addDetailJobs(jobs);
    }

    stats.phase3.queued += jobs.length;
    stats.phase3.durationMs += Date.now() - phase3Start;

    console.log(JSON.stringify({ level: 'info', service: 'immoscout24-ch', msg: 'Category processed', category: config.label, new: comparison.new, changed: comparison.changed, unchanged: comparison.unchanged, queued: jobs.length }));
  }

  stats.phase1.durationMs = Date.now() - phase1Start;
  stats.phase2.savingsPercent = stats.phase2.totalChecked > 0
    ? Math.round((stats.phase2.unchanged / stats.phase2.totalChecked) * 100)
    : 0;

  return stats;
}

export function printThreePhaseSummary(stats: PhaseStats): void {
  console.log(JSON.stringify({
    level: 'info',
    service: 'immoscout24-ch',
    msg: 'Three-phase scrape summary',
    phase1: { totalListings: stats.phase1.totalListings, durationMs: stats.phase1.durationMs },
    phase2: { totalChecked: stats.phase2.totalChecked, new: stats.phase2.new, changed: stats.phase2.changed, unchanged: stats.phase2.unchanged, savingsPercent: stats.phase2.savingsPercent, durationMs: stats.phase2.durationMs },
    phase3: { queued: stats.phase3.queued, durationMs: stats.phase3.durationMs },
  }));
}
