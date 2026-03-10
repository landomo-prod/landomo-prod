import { ChecksumClient } from '@landomo/core';
import { fetchOffers } from '../utils/fetchData';
import { scrapeListings, fetchDetailPage } from '../scrapers/htmlScraper';
import { batchCreateChecksums } from '../utils/checksumExtractor';
import { addDetailJobs, DetailJob } from '../queue/detailQueue';
import { CITY_IDS, CATEGORY_TYPES, WGGesuchtOffer } from '../types/wgGesuchtTypes';

const CITIES = [
  CITY_IDS.BERLIN,
  CITY_IDS.MUNICH,
  CITY_IDS.HAMBURG,
  CITY_IDS.COLOGNE,
  CITY_IDS.FRANKFURT,
];

const CATEGORIES = [
  CATEGORY_TYPES.WG_ROOM,
  CATEGORY_TYPES.ONE_ROOM,
  CATEGORY_TYPES.TWO_ROOM,
];

const CHECKSUM_BATCH_SIZE = 5000;

// Check if API auth is available
const USE_API = !!(process.env.WG_GESUCHT_USERNAME && process.env.WG_GESUCHT_PASSWORD);

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

  // Phase 1: Discovery - paginate search results per city x category
  const phase1Start = Date.now();
  const allItems: Array<{ item: WGGesuchtOffer; transactionType: 'rent' }> = [];

  console.log(`Phase 1: Discovery (mode=${USE_API ? 'api' : 'html'})`);

  for (const cityId of CITIES) {
    for (const category of CATEGORIES) {
      try {
        if (USE_API) {
          // Original API-based discovery (requires auth)
          let page = 1;
          const maxPages = 100;

          while (page <= maxPages) {
            const data = await fetchOffers(cityId, [category], { page });
            const offers: WGGesuchtOffer[] = data?.data?.offers || [];
            if (offers.length === 0) break;

            for (const item of offers) {
              allItems.push({ item, transactionType: 'rent' });
            }

            const pagination = data?.data?.pagination;
            if (!pagination || page >= pagination.total) break;
            page++;
          }
        } else {
          // HTML-based discovery (no auth needed)
          const offers = await scrapeListings(cityId, category, (pageOffers, pageNum) => {
            console.log(`  city=${cityId} cat=${category} page=${pageNum}: ${pageOffers.length} listings`);
          });

          for (const item of offers) {
            allItems.push({ item, transactionType: 'rent' });
          }
        }
        stats.phase1.categoriesProcessed++;
      } catch (err: any) {
        console.warn(`Failed to scan city=${cityId} cat=${category}: ${err.message}`);
      }
    }
  }

  stats.phase1.totalListings = allItems.length;
  stats.phase1.durationMs = Date.now() - phase1Start;

  if (allItems.length === 0) return stats;

  // Phase 2: Checksum comparison
  const phase2Start = Date.now();

  const checksums = batchCreateChecksums(allItems.map(e => e.item));

  const comparison = await checksumClient.compareChecksumsInBatches(
    checksums,
    scrapeRunId,
    CHECKSUM_BATCH_SIZE,
    (current, total) => {
      console.log(`Checksum progress: ${current}/${total}`);
    }
  );

  stats.phase2.totalChecked = comparison.total;
  stats.phase2.new = comparison.new;
  stats.phase2.changed = comparison.changed;
  stats.phase2.unchanged = comparison.unchanged;
  stats.phase2.savingsPercent = stats.phase2.totalChecked > 0
    ? Math.round((stats.phase2.unchanged / stats.phase2.totalChecked) * 100)
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

  const jobs: DetailJob[] = allItems
    .filter(({ item }) => toFetch.has(String(item.id || item.offer_id)))
    .map(({ item }) => ({
      id: String(item.id || item.offer_id),
      transactionType: 'rent' as const,
      category: item.category,
      url: item.url,
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
    level: 'info',
    service: 'wg-gesucht-de',
    msg: 'Three-phase scrape summary',
    mode: USE_API ? 'api' : 'html',
    phase1: { totalListings: stats.phase1.totalListings, categoriesProcessed: stats.phase1.categoriesProcessed, durationMs: stats.phase1.durationMs },
    phase2: { totalChecked: stats.phase2.totalChecked, new: stats.phase2.new, changed: stats.phase2.changed, unchanged: stats.phase2.unchanged, savingsPercent: stats.phase2.savingsPercent, durationMs: stats.phase2.durationMs },
    phase3: { queued: stats.phase3.queued, durationMs: stats.phase3.durationMs },
    totalMs,
  }));
}
