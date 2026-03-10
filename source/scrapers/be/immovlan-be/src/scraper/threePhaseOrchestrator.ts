import pLimit from 'p-limit';
import { ChecksumClient } from '@landomo/core';
import { fetchAllListingPages } from '../utils/fetchData';
import { batchCreateImmovlanChecksums } from '../utils/checksumExtractor';
import { addDetailJobs } from '../queue/detailQueue';

const CATEGORIES = ['apartment', 'house', 'land', 'commercial'];
const TRANSACTION_TYPES = ['sale', 'rent'];

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
    process.env.INGEST_API_URL || 'http://localhost:3004',
    process.env.INGEST_API_KEY || 'dev_key_be_1'
  );

  const phase1Start = Date.now();
  const limit = pLimit(3);

  const combos = CATEGORIES.flatMap(category =>
    TRANSACTION_TYPES.map(transactionType => ({ category, transactionType }))
  );

  const results = await Promise.allSettled(
    combos.map(({ category, transactionType }) => limit(async () => {
      console.log(JSON.stringify({ level: 'info', service: 'immovlan-scraper', msg: 'Fetching', category, type: transactionType }));
      const listings = await fetchAllListingPages(category, transactionType);
      stats.phase1.categoriesProcessed++;
      stats.phase1.totalListings += listings.length;

      if (listings.length === 0) return;

      const phase2Start = Date.now();
      const checksums = batchCreateImmovlanChecksums(listings);
      const comparison = await checksumClient.compareChecksumsInBatches(checksums, scrapeRunId, 5000);

      stats.phase2.totalChecked += comparison.total;
      stats.phase2.new += comparison.new;
      stats.phase2.changed += comparison.changed;
      stats.phase2.unchanged += comparison.unchanged;
      stats.phase2.durationMs += Date.now() - phase2Start;

      try { await checksumClient.updateChecksums(checksums, scrapeRunId); } catch (e: any) {
        console.error(JSON.stringify({ level: 'error', service: 'immovlan-scraper', msg: 'Checksum store failed', err: e.message }));
      }

      const phase3Start = Date.now();
      const toFetchSet = new Set(comparison.results.filter(r => r.status !== 'unchanged').map(r => r.portalId));

      const jobs = listings
        .filter(l => toFetchSet.has(l.id?.toString()))
        .map(l => ({ id: l.id, category, transactionType, listingData: l }));

      if (jobs.length > 0) await addDetailJobs(jobs);

      stats.phase3.queued += jobs.length;
      stats.phase3.durationMs += Date.now() - phase3Start;

      console.log(JSON.stringify({ level: 'info', service: 'immovlan-scraper', msg: 'Category done', category, type: transactionType, new: comparison.new, changed: comparison.changed, unchanged: comparison.unchanged }));
    }))
  );

  for (const result of results) {
    if (result.status === 'rejected') {
      console.error(JSON.stringify({ level: 'error', service: 'immovlan-scraper', msg: 'Category combo failed', err: result.reason?.message }));
    }
  }

  stats.phase1.durationMs = Date.now() - phase1Start;
  stats.phase2.savingsPercent = stats.phase2.totalChecked > 0
    ? Math.round((stats.phase2.unchanged / stats.phase2.totalChecked) * 100) : 0;

  return stats;
}

export function printThreePhaseSummary(stats: PhaseStats): void {
  console.log(JSON.stringify({ level: 'info', service: 'immovlan-scraper', msg: 'Summary', ...stats }));
}
