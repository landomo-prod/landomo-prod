import { ChecksumClient } from '@landomo/core';
import { ListingsScraper } from '../scrapers/listingsScraper';
import { batchCreateHabitacliaChecksums } from '../utils/checksumExtractor';
import { addDetailJobs } from '../queue/detailQueue';
import { HabitacliaSearchConfig } from '../types/habitacliaTypes';
import { getAllSearchConfigs, getConfigLabel } from '../utils/habitacliaHelpers';
import { SPANISH_PROVINCES } from '../utils/fetchData';

export interface PhaseStats {
  phase1: { categoriesProcessed: number; totalListings: number; durationMs: number };
  phase2: { totalChecked: number; new: number; changed: number; unchanged: number; savingsPercent: number; durationMs: number };
  phase3: { queued: number; durationMs: number };
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

  // Use configured provinces or default top provinces
  const provinces = (process.env.HABITACLIA_PROVINCES || 'barcelona,madrid,valencia,alicante,malaga,tarragona,girona,lleida,baleares,sevilla').split(',');
  const configs = getAllSearchConfigs(provinces);

  const phase1Start = Date.now();

  for (const config of configs) {
    const label = getConfigLabel(config);
    console.log(JSON.stringify({ level: 'info', service: 'habitaclia-scraper', msg: 'Processing config', config: label }));

    // Phase 1: Fetch listings
    const scraper = new ListingsScraper([config]);
    const listings = await scraper.scrapeAll();
    stats.phase1.categoriesProcessed++;
    stats.phase1.totalListings += listings.length;

    if (listings.length === 0) continue;

    // Phase 2: Compare checksums
    const phase2Start = Date.now();
    const checksums = batchCreateHabitacliaChecksums(listings);

    const comparison = await checksumClient.compareChecksumsInBatches(
      checksums, scrapeRunId, 5000,
      (current, total) => {
        console.log(JSON.stringify({ level: 'info', service: 'habitaclia-scraper', msg: 'Checksum progress', config: label, current, total }));
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
      console.error(JSON.stringify({ level: 'error', service: 'habitaclia-scraper', msg: 'Failed to store checksums', config: label, err: error.message }));
    }

    // Phase 3: Queue detail jobs for new/changed
    const phase3Start = Date.now();
    const toFetchSet = new Set(
      comparison.results.filter(r => r.status !== 'unchanged').map(r => r.portalId)
    );

    const toFetch = listings.filter(l => toFetchSet.has(l.id));
    if (toFetch.length > 0) {
      await addDetailJobs(toFetch);
    }

    stats.phase3.queued += toFetch.length;
    stats.phase3.durationMs += Date.now() - phase3Start;

    console.log(JSON.stringify({ level: 'info', service: 'habitaclia-scraper', msg: 'Config processed', config: label, new: comparison.new, changed: comparison.changed, unchanged: comparison.unchanged, queued: toFetch.length }));
  }

  stats.phase1.durationMs = Date.now() - phase1Start;
  stats.phase2.savingsPercent = stats.phase2.totalChecked > 0
    ? Math.round((stats.phase2.unchanged / stats.phase2.totalChecked) * 100)
    : 0;

  console.log(JSON.stringify({ level: 'info', service: 'habitaclia-scraper', msg: 'Three-phase complete', ...stats }));
  return stats;
}
