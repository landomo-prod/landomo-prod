import { ChecksumClient } from '@landomo/core';
import { fetchAllSearchPages, getAllSearchSegments } from '../scrapers/listingsScraper';
import { batchCreateDonpisoChecksums } from '../utils/checksumExtractor';
import { addDetailJobs } from '../queue/detailQueue';
import { DonpisoListingRaw } from '../types/donpisoTypes';

export interface PhaseStats {
  phase1: { segmentsProcessed: number; totalListings: number; durationMs: number };
  phase2: { totalChecked: number; new: number; changed: number; unchanged: number; savingsPercent: number; durationMs: number };
  phase3: { queued: number; durationMs: number };
}

export async function runThreePhaseScrape(scrapeRunId?: string): Promise<PhaseStats> {
  const stats: PhaseStats = {
    phase1: { segmentsProcessed: 0, totalListings: 0, durationMs: 0 },
    phase2: { totalChecked: 0, new: 0, changed: 0, unchanged: 0, savingsPercent: 0, durationMs: 0 },
    phase3: { queued: 0, durationMs: 0 },
  };

  const checksumClient = new ChecksumClient(
    process.env.INGEST_API_URL || 'http://localhost:3000',
    process.env.INGEST_API_KEY || ''
  );

  const segments = getAllSearchSegments();
  const phase1Start = Date.now();

  for (const segment of segments) {
    console.log(JSON.stringify({
      level: 'info', service: 'donpiso-scraper',
      msg: 'Phase 1: Fetching', segment: segment.label,
    }));

    let listings: DonpisoListingRaw[];
    try {
      listings = await fetchAllSearchPages(segment);
    } catch (error: any) {
      console.error(JSON.stringify({
        level: 'error', service: 'donpiso-scraper',
        msg: 'Phase 1 failed', segment: segment.label, err: error.message,
      }));
      continue;
    }

    stats.phase1.segmentsProcessed++;
    stats.phase1.totalListings += listings.length;

    if (listings.length === 0) {
      console.log(JSON.stringify({
        level: 'info', service: 'donpiso-scraper',
        msg: 'No listings found for segment', segment: segment.label,
      }));
      continue;
    }

    // Phase 2: Compare checksums
    const phase2Start = Date.now();
    const checksums = batchCreateDonpisoChecksums(listings);

    let comparison;
    try {
      comparison = await checksumClient.compareChecksumsInBatches(
        checksums, scrapeRunId, 1000,
        (current, total) => {
          if (current % 500 === 0) {
            console.log(JSON.stringify({
              level: 'info', service: 'donpiso-scraper',
              msg: 'Checksum progress', segment: segment.label, current, total,
            }));
          }
        }
      );
    } catch (error: any) {
      console.error(JSON.stringify({
        level: 'error', service: 'donpiso-scraper',
        msg: 'Checksum comparison failed', segment: segment.label, err: error.message,
      }));
      // Fall through: queue all listings
      comparison = {
        total: listings.length,
        new: listings.length,
        changed: 0,
        unchanged: 0,
        results: listings.map(l => ({ portalId: l.portalId, status: 'new' as const })),
      };
    }

    stats.phase2.totalChecked += comparison.total;
    stats.phase2.new += comparison.new;
    stats.phase2.changed += comparison.changed;
    stats.phase2.unchanged += comparison.unchanged;
    stats.phase2.durationMs += Date.now() - phase2Start;

    // Store checksums
    try {
      await checksumClient.updateChecksums(checksums, scrapeRunId);
    } catch (error: any) {
      console.error(JSON.stringify({
        level: 'error', service: 'donpiso-scraper',
        msg: 'Failed to store checksums', segment: segment.label, err: error.message,
      }));
    }

    // Phase 3: Queue detail jobs for new/changed listings
    const phase3Start = Date.now();
    const toFetchSet = new Set(
      comparison.results.filter(r => r.status !== 'unchanged').map(r => r.portalId)
    );

    const jobs = listings
      .filter(l => toFetchSet.has(l.portalId))
      .map(l => ({
        portalId: l.portalId,
        detailUrl: l.detailUrl,
        listingData: l,
      }));

    if (jobs.length > 0) {
      await addDetailJobs(jobs);
    }

    stats.phase3.queued += jobs.length;
    stats.phase3.durationMs += Date.now() - phase3Start;

    console.log(JSON.stringify({
      level: 'info', service: 'donpiso-scraper',
      msg: 'Segment processed',
      segment: segment.label,
      found: listings.length,
      new: comparison.new,
      changed: comparison.changed,
      unchanged: comparison.unchanged,
      queued: jobs.length,
    }));
  }

  stats.phase1.durationMs = Date.now() - phase1Start;
  stats.phase2.savingsPercent = stats.phase2.totalChecked > 0
    ? Math.round((stats.phase2.unchanged / stats.phase2.totalChecked) * 100)
    : 0;

  console.log(JSON.stringify({
    level: 'info', service: 'donpiso-scraper',
    msg: 'Three-phase complete',
    totalListings: stats.phase1.totalListings,
    new: stats.phase2.new,
    changed: stats.phase2.changed,
    unchanged: stats.phase2.unchanged,
    savingsPercent: stats.phase2.savingsPercent,
    queued: stats.phase3.queued,
  }));

  return stats;
}

export function printThreePhaseSummary(stats: PhaseStats): void {
  const totalMs = stats.phase1.durationMs + stats.phase2.durationMs + stats.phase3.durationMs;
  console.log(JSON.stringify({
    level: 'info', service: 'donpiso-scraper',
    msg: 'Three-phase scrape summary',
    phase1: stats.phase1,
    phase2: stats.phase2,
    phase3: stats.phase3,
    totalMs,
  }));
}
