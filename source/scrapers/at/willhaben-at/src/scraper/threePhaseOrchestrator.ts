import { ChecksumClient } from '@landomo/core';
import { ListingsScraper } from '../scrapers/listingsScraper';
import { batchCreateWillhabenChecksums } from '../utils/checksumExtractor';
import { addDetailJobs } from '../queue/detailQueue';
import { WillhabenListing, getAttribute } from '../types/willhabenTypes';

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
    process.env.INGEST_API_URL || 'http://localhost:3011',
    process.env.INGEST_API_KEY || ''
  );

  // Phase 1: Fetch all listing summaries
  const phase1Start = Date.now();
  const scraper = new ListingsScraper();
  const listings = await scraper.scrapeAll();
  stats.phase1.totalListings = listings.length;
  stats.phase1.durationMs = Date.now() - phase1Start;

  if (listings.length === 0) return stats;

  // Process in batches of 5000 for checksum comparison
  const BATCH_SIZE = 5000;
  for (let i = 0; i < listings.length; i += BATCH_SIZE) {
    const batch = listings.slice(i, i + BATCH_SIZE);

    // Phase 2: Compare checksums
    const phase2Start = Date.now();
    const checksums = batchCreateWillhabenChecksums(batch);

    const comparison = await checksumClient.compareChecksumsInBatches(
      checksums,
      scrapeRunId,
      5000,
      (current, total) => {
        console.log(JSON.stringify({ level: 'info', service: 'willhaben-scraper', msg: 'Checksum progress', current, total }));
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
      console.error(JSON.stringify({ level: 'error', service: 'willhaben-scraper', msg: 'Failed to store checksums', err: error.message }));
    }

    // Phase 3: Queue new/changed listings for ingestion
    const phase3Start = Date.now();
    const toFetchSet = new Set(
      comparison.results.filter((r) => r.status !== 'unchanged').map((r) => r.portalId)
    );

    const jobs = batch
      .filter((listing) => toFetchSet.has(listing.id?.toString()))
      .map((listing) => ({
        listingId: listing.id,
        propertyTypeId: getAttribute(listing, 'PROPERTY_TYPE_ID'),
      }));

    if (jobs.length > 0) {
      await addDetailJobs(jobs);
    }

    stats.phase3.queued += jobs.length;
    stats.phase3.durationMs += Date.now() - phase3Start;

    console.log(JSON.stringify({ level: 'info', service: 'willhaben-scraper', msg: 'Batch processed', batchStart: i, new: comparison.new, changed: comparison.changed, unchanged: comparison.unchanged, queued: jobs.length }));
  }

  stats.phase2.savingsPercent = stats.phase2.totalChecked > 0
    ? Math.round((stats.phase2.unchanged / stats.phase2.totalChecked) * 100)
    : 0;

  console.log(JSON.stringify({ level: 'info', service: 'willhaben-scraper', msg: 'Three-phase complete', totalListings: stats.phase1.totalListings, new: stats.phase2.new, changed: stats.phase2.changed, unchanged: stats.phase2.unchanged, savingsPercent: stats.phase2.savingsPercent, queued: stats.phase3.queued }));

  return stats;
}
