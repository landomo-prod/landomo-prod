/**
 * Fetch a large sample of bazos listings + details and report distinct values per field.
 * Classifies listings into categories using title-based detection (bazos has no category field).
 * Usage: npx ts-node src/raw_samples/fetch-distinct-values.ts [--pages N]
 */
import axios from 'axios';
import { FieldCollector, parsePages, delay } from './analyze-fields';
import { detectPropertyCategory } from '../utils/categoryDetection';

const LIMIT = 20;
const DETAIL_CONCURRENCY = 5;

const CATEGORIES = ['apartment', 'house', 'land', 'commercial'] as const;

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Encoding': 'gzip, deflate, br',
  Connection: 'keep-alive',
};

async function main() {
  const pages = parsePages(10);

  // Per-category collectors
  const catListingCollectors: Record<string, FieldCollector> = {};
  const catDetailCollectors: Record<string, FieldCollector> = {};
  const categoryCounts: Record<string, { listings: number; details: number }> = {};

  for (const cat of CATEGORIES) {
    catListingCollectors[cat] = new FieldCollector();
    catDetailCollectors[cat] = new FieldCollector();
    categoryCounts[cat] = { listings: 0, details: 0 };
  }

  // Merged collectors for backward-compat top-level output
  const mergedListingCollector = new FieldCollector();
  const mergedDetailCollector = new FieldCollector();

  let totalListings = 0;
  let totalDetails = 0;
  const adEntries: Array<{ id: string; category: string }> = [];

  // Phase 1: Listing pages
  for (let page = 0; page < pages; page++) {
    const offset = page * LIMIT;
    const url = `https://www.bazos.cz/api/v1/ads.php?offset=${offset}&limit=${LIMIT}&section=RE`;
    try {
      const { data } = await axios.get(url, { headers: HEADERS });
      const ads = Array.isArray(data) ? data : (data?.ads || data?.results || []);
      if (ads.length === 0) break;
      for (const ad of ads) {
        mergedListingCollector.add(ad);
        totalListings++;

        // Classify by title using existing category detection
        const catName = detectPropertyCategory(ad.title || '', '');
        catListingCollectors[catName].add(ad);
        categoryCounts[catName].listings++;

        const id = ad.ad_id || ad.id;
        if (id) adEntries.push({ id: String(id), category: catName });
      }
      process.stderr.write(`\rListings: page ${page + 1}/${pages}, ${totalListings} items`);
    } catch (err: any) {
      process.stderr.write(`\nListing page ${page} failed: ${err.message}\n`);
    }
    await delay(300);
  }
  process.stderr.write('\n');

  // Phase 2: Detail pages
  for (let i = 0; i < adEntries.length; i += DETAIL_CONCURRENCY) {
    const batch = adEntries.slice(i, i + DETAIL_CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map(async ({ id }) => {
        const url = `https://www.bazos.cz/api/v1/ad-detail-2.php?ad_id=${id}`;
        const { data } = await axios.get(url, {
          headers: { ...HEADERS, Accept: 'application/json' },
        });
        return data;
      })
    );
    for (let j = 0; j < results.length; j++) {
      const r = results[j];
      if (r.status === 'fulfilled') {
        const catName = batch[j].category;
        catDetailCollectors[catName].add(r.value);
        mergedDetailCollector.add(r.value);
        categoryCounts[catName].details++;
        totalDetails++;
      }
    }
    process.stderr.write(`\rDetails: ${totalDetails}/${adEntries.length}`);
    await delay(200);
  }
  process.stderr.write('\n');

  // Build report with per-category sections + merged backward-compat top-level
  const report: Record<string, any> = {
    meta: {
      scraper: 'bazos-cz',
      categories_sampled: CATEGORIES.filter(c => categoryCounts[c].listings > 0),
      listings_fetched: totalListings,
      details_fetched: totalDetails,
      per_category_counts: categoryCounts,
      timestamp: new Date().toISOString(),
    },
  };

  for (const cat of CATEGORIES) {
    if (categoryCounts[cat].listings > 0 || categoryCounts[cat].details > 0) {
      report[cat] = {
        listing_fields: catListingCollectors[cat].report(),
        detail_fields: catDetailCollectors[cat].report(),
      };
    }
  }

  // Backward-compat merged top-level
  report.listing_fields = mergedListingCollector.report();
  report.detail_fields = mergedDetailCollector.report();

  console.log(JSON.stringify(report, null, 2));
}

main().catch(console.error);
