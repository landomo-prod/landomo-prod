import { ChecksumClient, ListingChecksum, createListingChecksum } from '@landomo/core';
import { scrapeListingCards, ListingCard } from '../scrapers/listingsScraper';
import { addDetailJobs, getQueueStats, DetailJob } from '../queue/detailQueue';

const CHECKSUM_BATCH_SIZE = 5000;

const CATEGORIES = [
  { name: 'apartments-sale', url: 'https://www.ceskereality.cz/prodej/byty/', category: 'apartment' as const },
  { name: 'houses-sale', url: 'https://www.ceskereality.cz/prodej/rodinne-domy/', category: 'house' as const },
  { name: 'land-sale', url: 'https://www.ceskereality.cz/prodej/pozemky/', category: 'land' as const },
  { name: 'commercial-sale', url: 'https://www.ceskereality.cz/prodej/komercni-prostory/', category: 'commercial' as const },
  { name: 'cottages-sale', url: 'https://www.ceskereality.cz/prodej/chaty-chalupy/', category: 'house' as const },
  { name: 'ostatni-sale', url: 'https://www.ceskereality.cz/prodej/ostatni/', category: 'commercial' as const },
  { name: 'apartments-rent', url: 'https://www.ceskereality.cz/pronajem/byty/', category: 'apartment' as const },
  { name: 'houses-rent', url: 'https://www.ceskereality.cz/pronajem/rodinne-domy/', category: 'house' as const },
  { name: 'land-rent', url: 'https://www.ceskereality.cz/pronajem/pozemky/', category: 'land' as const },
  { name: 'commercial-rent', url: 'https://www.ceskereality.cz/pronajem/komercni-prostory/', category: 'commercial' as const },
  { name: 'cottages-rent', url: 'https://www.ceskereality.cz/pronajem/chaty-chalupy/', category: 'house' as const },
  { name: 'ostatni-rent', url: 'https://www.ceskereality.cz/pronajem/ostatni/', category: 'commercial' as const },
];

const MAX_PAGES = parseInt(process.env.MAX_PAGES || '1000');

export interface PhaseStats {
  phase1: { totalUrls: number; durationMs: number };
  phase2: { total: number; new: number; unchanged: number; savingsPercent: number; durationMs: number };
  phase3: { queued: number; durationMs: number };
}

/**
 * Streaming Scraping Orchestrator for CeskeReality.cz
 *
 * Instead of collecting all URLs first then comparing checksums in bulk,
 * this processes each pagination page immediately:
 *   1. Scrape ~20 listing cards from a page (URL + price + title)
 *   2. Compare those 20 checksums against the ingest API
 *   3. Queue detail jobs for new/changed listings immediately
 *   4. Move to the next page
 *
 * This means the first new listing is ingested within seconds of the
 * scrape starting — enabling near real-time notifications for customers.
 * Detail workers pick up jobs as fast as they're discovered.
 *
 * Checksums are saved AFTER successful ingest (in detailQueue.ts flushBatch),
 * not here — this prevents stale checksums from masking uningested listings
 * on worker crashes.
 */
export async function runThreePhaseScrape(scrapeRunId?: string, categories?: string[], maxPages?: number): Promise<PhaseStats> {
  const stats: PhaseStats = {
    phase1: { totalUrls: 0, durationMs: 0 },
    phase2: { total: 0, new: 0, unchanged: 0, savingsPercent: 0, durationMs: 0 },
    phase3: { queued: 0, durationMs: 0 },
  };

  const checksumClient = new ChecksumClient(
    process.env.INGEST_API_URL || 'http://cz-ingest:3000',
    process.env.INGEST_API_KEY || process.env['INGEST_API_KEY_CESKEREALITY'] || 'dev_key_cz_1'
  );

  const startMs = Date.now();

  const effectiveCategories = categories
    ? CATEGORIES.filter(c => categories.includes(c.category))
    : CATEGORIES;

  if (categories) {
    console.log(`📋 Category filter: ${categories.join(', ')} (${effectiveCategories.length}/${CATEGORIES.length} category URLs)`);
  }

  const pageLimit = maxPages || MAX_PAGES;
  if (maxPages) {
    console.log(`📋 Page limit: ${maxPages} pages per category (newest-first quick scan)`);
  }

  for (const cat of effectiveCategories) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📂 Streaming: ${cat.name}`);
    console.log('='.repeat(60));

    let page = 1;
    let emptyPages = 0;
    let catTotal = 0;
    let catNew = 0;
    let catQueued = 0;

    while (page <= pageLimit) {
      const pageUrl = page === 1 ? cat.url : `${cat.url}?strana=${page}`;

      // Step 1: Scrape listing cards from this page (~20 listings)
      const cards = await scrapeListingCards(pageUrl);

      if (cards.length === 0) {
        emptyPages++;
        if (emptyPages >= 3) break;
        page++;
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      emptyPages = 0;
      catTotal += cards.length;

      // Step 2: Compare checksums for this page's cards immediately
      const checksums = cards.map(card =>
        createListingChecksum('ceskereality', card.portalId, card, () => ({
          price: card.price,
          title: card.title,
          description: null,
          sqm: null,
          disposition: null,
          floor: null,
        }))
      );

      // Build portalId → checksum map to attach to each queued job
      const checksumMap = new Map<string, ListingChecksum>(
        checksums.map(cs => [cs.portalId, cs])
      );

      let newOnPage = 0;
      try {
        const comparison = await checksumClient.compareChecksums(checksums, scrapeRunId);
        catNew += comparison.new + comparison.changed;
        newOnPage = comparison.new + comparison.changed;

        // Step 3: Queue detail jobs immediately for new/changed listings,
        // attaching the checksum so the worker can save it after successful ingest.
        const toFetch = comparison.results
          .filter(r => r.status !== 'unchanged')
          .map(r => cards.find(c => c.portalId === r.portalId))
          .filter((c): c is ListingCard => !!c)
          .map(card => ({
            url: card.url,
            category: cat.category,
            scrapeRunId,
            checksum: checksumMap.get(card.portalId),
          }));

        if (toFetch.length > 0) {
          await addDetailJobs(toFetch);
          catQueued += toFetch.length;
        }

        // NOTE: checksums are NOT saved here — they are saved in detailQueue.ts
        // after each batch is successfully flushed to ingest.

      } catch (err: any) {
        console.warn(`  ⚠️  Checksum error on page ${page}: ${err.message}`);
      }

      if (newOnPage > 0) {
        console.log(`  Page ${page}: ${newOnPage} new → queued (${catQueued} total queued)`);
      }

      page++;
      await new Promise(r => setTimeout(r, 300));
    }

    console.log(`✅ ${cat.name}: ${catTotal} listings scanned, ${catNew} new, ${catQueued} queued`);

    stats.phase1.totalUrls += catTotal;
    stats.phase2.total += catTotal;
    stats.phase2.new += catNew;
    stats.phase2.unchanged += (catTotal - catNew);
    stats.phase3.queued += catQueued;
  }

  const totalMs = Date.now() - startMs;
  stats.phase1.durationMs = totalMs;
  stats.phase2.durationMs = totalMs;
  stats.phase2.savingsPercent = stats.phase2.total > 0
    ? Math.round((stats.phase2.unchanged / stats.phase2.total) * 100)
    : 0;

  return stats;
}

export function printThreePhaseSummary(stats: PhaseStats): void {
  const totalMs = stats.phase1.durationMs;
  console.log('\n' + '='.repeat(60));
  console.log('📊 STREAMING SCRAPE SUMMARY (ceskereality.cz)');
  console.log('='.repeat(60));
  console.log(`Listings scanned: ${stats.phase1.totalUrls}`);
  console.log(`New/changed:      ${stats.phase2.new} (${100 - stats.phase2.savingsPercent}%)`);
  console.log(`Skipped:          ${stats.phase2.unchanged} (${stats.phase2.savingsPercent}%)`);
  console.log(`Detail jobs:      ${stats.phase3.queued} queued`);
  console.log(`Total scan time:  ${(totalMs / 1000).toFixed(1)}s`);
  console.log('='.repeat(60) + '\n');
}
