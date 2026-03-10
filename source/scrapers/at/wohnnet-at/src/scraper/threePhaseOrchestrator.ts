import { ChecksumClient } from '@landomo/core';
import { fetchListingPage } from '../utils/fetchData';
import { parseListingsPage, extractPaginationMeta } from '../utils/htmlParser';
import { batchCreateChecksums } from '../utils/checksumExtractor';
import { addDetailJobs, DetailJob } from '../queue/detailQueue';
import { WohnnetListing } from '../types/wohnnetTypes';

const CHECKSUM_BATCH_SIZE = 5000;
const MAX_PAGES = parseInt(process.env.MAX_PAGES || '1500');

export interface PhaseStats {
  phase1: { totalListings: number; durationMs: number };
  phase2: { total: number; new: number; changed: number; unchanged: number; savingsPercent: number; durationMs: number };
  phase3: { queued: number; durationMs: number };
}

export async function runThreePhaseScrape(scrapeRunId?: string): Promise<PhaseStats> {
  const stats: PhaseStats = {
    phase1: { totalListings: 0, durationMs: 0 },
    phase2: { total: 0, new: 0, changed: 0, unchanged: 0, savingsPercent: 0, durationMs: 0 },
    phase3: { queued: 0, durationMs: 0 },
  };

  const checksumClient = new ChecksumClient(
    process.env.INGEST_API_URL || 'http://localhost:3000',
    process.env.INGEST_API_KEY || ''
  );

  // Phase 1: Discovery - paginate listing pages, collect IDs + minimal data
  const phase1Start = Date.now();
  const allListings: WohnnetListing[] = [];
  let currentPage = 1;
  let hasMorePages = true;

  while (hasMorePages && currentPage <= MAX_PAGES) {
    try {
      const html = await fetchListingPage(currentPage);
      const listings = parseListingsPage(html, currentPage);

      if (listings.length === 0) {
        hasMorePages = false;
        break;
      }

      allListings.push(...listings);

      const paginationMeta = extractPaginationMeta(html, currentPage);
      if (!paginationMeta.hasNextPage || currentPage >= paginationMeta.totalPages) {
        hasMorePages = false;
        break;
      }

      currentPage++;
    } catch (err: any) {
      console.warn(`Failed to scan page ${currentPage}: ${err.message}`);
      break;
    }
  }

  stats.phase1.totalListings = allListings.length;
  stats.phase1.durationMs = Date.now() - phase1Start;

  if (allListings.length === 0) return stats;

  // Phase 2: Checksum comparison
  const phase2Start = Date.now();

  const checksums = batchCreateChecksums(allListings);

  const comparison = await checksumClient.compareChecksumsInBatches(
    checksums,
    scrapeRunId,
    CHECKSUM_BATCH_SIZE,
    (current, total) => {
      console.log(`Checksum progress: ${current}/${total}`);
    }
  );

  stats.phase2.total = comparison.total;
  stats.phase2.new = comparison.new;
  stats.phase2.changed = comparison.changed;
  stats.phase2.unchanged = comparison.unchanged;
  stats.phase2.savingsPercent = stats.phase2.total > 0
    ? Math.round((stats.phase2.unchanged / stats.phase2.total) * 100)
    : 0;
  stats.phase2.durationMs = Date.now() - phase2Start;

  try {
    await checksumClient.updateChecksums(checksums, scrapeRunId);
  } catch (err: any) {
    console.warn(`Failed to store checksums: ${err.message}`);
  }

  // Phase 3: Queue new/changed for detail fetch
  const phase3Start = Date.now();

  const toFetch = new Set(
    comparison.results
      .filter(r => r.status !== 'unchanged')
      .map(r => r.portalId)
  );

  const jobs: DetailJob[] = allListings
    .filter(listing => toFetch.has(listing.id))
    .map(listing => ({
      id: listing.id,
      url: listing.url,
      title: listing.title,
      price: listing.price,
      rooms: listing.details?.rooms,
      sqm: listing.details?.sqm,
    }));

  if (jobs.length > 0) {
    await addDetailJobs(jobs);
  }

  stats.phase3.queued = jobs.length;
  stats.phase3.durationMs = Date.now() - phase3Start;

  return stats;
}

export function printThreePhaseSummary(stats: PhaseStats): void {
  const totalMs = stats.phase1.durationMs + stats.phase2.durationMs + stats.phase3.durationMs;
  console.log(JSON.stringify({
    msg: 'Three-phase summary',
    phase1: { totalListings: stats.phase1.totalListings, durationMs: stats.phase1.durationMs },
    phase2: { total: stats.phase2.total, new: stats.phase2.new, changed: stats.phase2.changed, unchanged: stats.phase2.unchanged, savingsPercent: stats.phase2.savingsPercent },
    phase3: { queued: stats.phase3.queued, durationMs: stats.phase3.durationMs },
    totalMs,
  }));
}
