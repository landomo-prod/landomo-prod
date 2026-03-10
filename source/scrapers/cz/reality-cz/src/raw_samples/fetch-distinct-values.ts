/**
 * Fetch a large sample of reality.cz listings + details and report distinct values per field.
 * Usage: npx ts-node src/raw_samples/fetch-distinct-values.ts [--pages N]
 */
import { RealityAuth } from '../utils/realityAuth';
import { FieldCollector, parsePages, delay } from './analyze-fields';

const TAKE = 20;
const DETAIL_CONCURRENCY = 3;

type Category = 'apartment' | 'house' | 'land' | 'commercial';

// Paths are relative — RealityAuth has baseURL https://api.reality.cz
const SEARCH_URLS: { url: string; category: Category }[] = [
  { url: '/prodej/byty/Ceska-republika/?skip={skip}&take={take}', category: 'apartment' },
  { url: '/prodej/domy/Ceska-republika/?skip={skip}&take={take}', category: 'house' },
  { url: '/prodej/pozemky/Ceska-republika/?skip={skip}&take={take}', category: 'land' },
  { url: '/prodej/komercni/Ceska-republika/?skip={skip}&take={take}', category: 'commercial' },
  { url: '/pronajem/byty/Ceska-republika/?skip={skip}&take={take}', category: 'apartment' },
  { url: '/pronajem/domy/Ceska-republika/?skip={skip}&take={take}', category: 'house' },
  { url: '/pronajem/pozemky/Ceska-republika/?skip={skip}&take={take}', category: 'land' },
  { url: '/pronajem/komercni/Ceska-republika/?skip={skip}&take={take}', category: 'commercial' },
];

async function main() {
  const pages = parsePages(5);
  const auth = new RealityAuth();

  // Per-category collectors
  const categoryCollectors: Record<Category, { listing: FieldCollector; detail: FieldCollector }> = {
    apartment: { listing: new FieldCollector(), detail: new FieldCollector() },
    house: { listing: new FieldCollector(), detail: new FieldCollector() },
    land: { listing: new FieldCollector(), detail: new FieldCollector() },
    commercial: { listing: new FieldCollector(), detail: new FieldCollector() },
  };

  // Merged collectors (backward compat)
  const listingCollector = new FieldCollector();
  const detailCollector = new FieldCollector();

  let listingCount = 0;
  let detailCount = 0;
  const idsByCategory: Record<Category, string[]> = {
    apartment: [], house: [], land: [], commercial: [],
  };

  // Phase 1: Listing pages
  for (const { url: urlTemplate, category } of SEARCH_URLS) {
    for (let page = 0; page < pages; page++) {
      const url = urlTemplate.replace('{skip}', String(page * TAKE)).replace('{take}', String(TAKE));
      try {
        const data = await auth.request(url);
        const ads = data?.advertisements || data?.results || [];
        if (!Array.isArray(ads) || ads.length === 0) {
          process.stderr.write(`\n  [debug] empty/no-array for ${url}, keys: ${data ? Object.keys(data).join(',') : 'null'}\n`);
          break;
        }
        for (const ad of ads) {
          listingCollector.add(ad);
          categoryCollectors[category].listing.add(ad);
          listingCount++;
          if (ad.id) idsByCategory[category].push(String(ad.id));
        }
        process.stderr.write(`\rListings: ${listingCount} items`);
      } catch (err: any) {
        process.stderr.write(`\nFailed ${url}: ${err.message}\n`);
      }
      await delay(500);
    }
  }
  process.stderr.write('\n');

  // Phase 2: Detail pages
  const allIds = Object.entries(idsByCategory);
  for (const [category, ids] of allIds) {
    for (let i = 0; i < ids.length; i += DETAIL_CONCURRENCY) {
      const batch = ids.slice(i, i + DETAIL_CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map(async (id) => {
          return await auth.request(`/${id}/`);
        })
      );
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value) {
          detailCollector.add(r.value);
          categoryCollectors[category as Category].detail.add(r.value);
          detailCount++;
        }
      }
      process.stderr.write(`\rDetails: ${detailCount}/${Object.values(idsByCategory).reduce((s, a) => s + a.length, 0)}`);
      await delay(500);
    }
  }
  process.stderr.write('\n');

  const categoriesSampled = (Object.keys(categoryCollectors) as Category[]).filter(
    (c) => idsByCategory[c].length > 0
  );

  const report: Record<string, any> = {
    meta: {
      scraper: 'reality-cz',
      categories_sampled: categoriesSampled,
      listings_fetched: listingCount,
      details_fetched: detailCount,
      timestamp: new Date().toISOString(),
    },
  };

  // Per-category sections
  for (const cat of categoriesSampled) {
    report[cat] = {
      listing_fields: categoryCollectors[cat].listing.report(),
      detail_fields: categoryCollectors[cat].detail.report(),
    };
  }

  // Backward-compat merged top-level
  report.listing_fields = listingCollector.report();
  report.detail_fields = detailCollector.report();

  console.log(JSON.stringify(report, null, 2));
}

main().catch(console.error);
