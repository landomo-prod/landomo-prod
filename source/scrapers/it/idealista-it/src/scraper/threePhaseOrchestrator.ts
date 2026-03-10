import { ChecksumClient } from '@landomo/core';
import { ListingsScraper } from '../scrapers/listingsScraper';
import { batchCreateIdealistaChecksums } from '../utils/checksumExtractor';
import { addDetailJobs } from '../queue/detailQueue';
import { IdealistaListing } from '../types/idealistaTypes';

let activeChecksumCalls = 0;
const MAX_CONCURRENT_CHECKSUM = 2;
const checksumQueue: Array<() => void> = [];

function withChecksumSemaphore<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const run = () => {
      activeChecksumCalls++;
      fn().then(resolve, reject).finally(() => {
        activeChecksumCalls--;
        if (checksumQueue.length > 0) checksumQueue.shift()!();
      });
    };
    if (activeChecksumCalls < MAX_CONCURRENT_CHECKSUM) run();
    else checksumQueue.push(run);
  });
}

export interface PhaseStats {
  phase1: { totalListings: number; durationMs: number };
  phase2: { totalChecked: number; new: number; changed: number; unchanged: number; savingsPercent: number; durationMs: number };
  phase3: { queued: number; durationMs: number };
}

export async function runThreePhaseScrape(scrapeRunId?: string): Promise<PhaseStats> {
  const stats: PhaseStats = {
    phase1: { totalListings: 0, durationMs: 0 },
    phase2: { totalChecked: 0, new: 0, changed: 0, unchanged: 0, savingsPercent: 0, durationMs: 0 },
    phase3: { queued: 0, durationMs: 0 },
  };

  const checksumClient = new ChecksumClient(
    process.env.INGEST_API_URL || 'http://localhost:3000',
    process.env.INGEST_API_KEY || ''
  );
  const scraper = new ListingsScraper();

  const phase1Start = Date.now();
  console.log(JSON.stringify({ level: 'info', service: 'idealista-scraper', msg: 'Streaming phase started: fetch -> checksum -> queue' }));

  const pageHandler = async (page: IdealistaListing[]) => {
    const checksums = batchCreateIdealistaChecksums(page);
    const comparison = await withChecksumSemaphore(() =>
      checksumClient.compareChecksumsInBatches(checksums, scrapeRunId)
    );

    stats.phase2.totalChecked += comparison.total;
    stats.phase2.new += comparison.new;
    stats.phase2.changed += comparison.changed;
    stats.phase2.unchanged += comparison.unchanged;
    stats.phase3.durationMs = Date.now() - phase1Start;

    checksumClient.updateChecksums(checksums, scrapeRunId).catch(() => {});

    const changedIds = new Set(
      comparison.results.filter(r => r.status !== 'unchanged').map(r => r.portalId)
    );
    const toFetch = page.filter(l => changedIds.has(l.id));

    if (toFetch.length > 0) {
      await addDetailJobs(toFetch);
      stats.phase3.queued += toFetch.length;
    }

    console.log(JSON.stringify({
      level: 'info', service: 'idealista-scraper', msg: 'Page streamed',
      new: comparison.new, changed: comparison.changed,
      unchanged: comparison.unchanged, queued: toFetch.length,
    }));
  };

  const allListings = await scraper.scrapeAll(pageHandler);

  stats.phase1.totalListings = allListings.length;
  stats.phase1.durationMs = Date.now() - phase1Start;
  stats.phase2.savingsPercent = stats.phase2.totalChecked > 0
    ? Math.round((stats.phase2.unchanged / stats.phase2.totalChecked) * 100)
    : 100;

  console.log(JSON.stringify({
    level: 'info', service: 'idealista-scraper', msg: 'Streaming complete',
    totalListings: stats.phase1.totalListings,
    new: stats.phase2.new, changed: stats.phase2.changed,
    unchanged: stats.phase2.unchanged, savingsPercent: stats.phase2.savingsPercent,
    queued: stats.phase3.queued, durationMs: stats.phase1.durationMs,
  }));

  return stats;
}

export function printThreePhaseSummary(stats: PhaseStats): void {
  console.log(JSON.stringify({
    level: 'info', service: 'idealista-scraper', msg: 'Scrape summary',
    phase1_listings: stats.phase1.totalListings,
    phase1_ms: stats.phase1.durationMs,
    phase2_new: stats.phase2.new, phase2_changed: stats.phase2.changed,
    phase2_unchanged: stats.phase2.unchanged, phase2_savings_pct: stats.phase2.savingsPercent,
    phase3_queued: stats.phase3.queued,
    total_ms: stats.phase1.durationMs,
  }));
}
