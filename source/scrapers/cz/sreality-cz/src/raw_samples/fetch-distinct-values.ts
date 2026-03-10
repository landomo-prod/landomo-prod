/**
 * Fetch a large sample of sreality listings + details and report distinct values per field.
 * Samples all 4 categories (apartment, house, land, commercial) x 2 transaction types (sale, rent).
 * Usage: npx ts-node src/raw_samples/fetch-distinct-values.ts [--pages N]
 */
import axios from 'axios';
import { getRealisticHeaders } from '../utils/headers';
import { FieldCollector, parsePages, delay } from './analyze-fields';

const PER_PAGE = 20;
const DETAIL_CONCURRENCY = 5;

const CATEGORIES: Record<number, string> = {
  1: 'apartment',
  2: 'house',
  3: 'land',
  4: 'commercial',
};

const TRANSACTION_TYPES: Record<number, string> = {
  1: 'sale',
  2: 'rent',
};

async function main() {
  const pages = parsePages(10);

  // Per-category collectors
  const catListingCollectors: Record<string, FieldCollector> = {};
  const catDetailCollectors: Record<string, FieldCollector> = {};
  const categoryCounts: Record<string, { listings: number; details: number }> = {};

  for (const cat of Object.values(CATEGORIES)) {
    catListingCollectors[cat] = new FieldCollector();
    catDetailCollectors[cat] = new FieldCollector();
    categoryCounts[cat] = { listings: 0, details: 0 };
  }

  // Merged collectors for backward-compat top-level output
  const mergedListingCollector = new FieldCollector();
  const mergedDetailCollector = new FieldCollector();

  let totalListings = 0;
  let totalDetails = 0;

  // Phase 1: Fetch listing pages for all category x transaction combos
  const allHashIds: Array<{ id: string; category: string }> = [];

  for (const [catCb, catName] of Object.entries(CATEGORIES)) {
    for (const [typeCb, typeName] of Object.entries(TRANSACTION_TYPES)) {
      for (let page = 1; page <= pages; page++) {
        const url = `https://www.sreality.cz/api/cs/v2/estates?page=${page}&per_page=${PER_PAGE}&category_main_cb=${catCb}&category_type_cb=${typeCb}&tms=${Date.now()}`;
        try {
          const { data } = await axios.get(url, { headers: getRealisticHeaders() });
          const estates = data?._embedded?.estates || data?.results || [];
          if (Array.isArray(estates)) {
            for (const estate of estates) {
              catListingCollectors[catName].add(estate);
              mergedListingCollector.add(estate);
              categoryCounts[catName].listings++;
              totalListings++;
              const hashId = estate.hash_id ? String(estate.hash_id) : estate.hashId ? String(estate.hashId) : null;
              if (hashId) allHashIds.push({ id: hashId, category: catName });
            }
          } else {
            catListingCollectors[catName].add(data);
            mergedListingCollector.add(data);
            categoryCounts[catName].listings++;
            totalListings++;
          }
          process.stderr.write(`\rListings [${catName}/${typeName}]: page ${page}/${pages}, total ${totalListings}`);
        } catch (err: any) {
          process.stderr.write(`\n[${catName}/${typeName}] page ${page} failed: ${err.message}\n`);
        }
        await delay(300);
      }
    }
  }
  process.stderr.write('\n');

  // Phase 2: Fetch details
  for (let i = 0; i < allHashIds.length; i += DETAIL_CONCURRENCY) {
    const batch = allHashIds.slice(i, i + DETAIL_CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map(async ({ id }) => {
        const url = `https://www.sreality.cz/api/cs/v2/estates/${id}`;
        const { data } = await axios.get(url, { headers: getRealisticHeaders() });
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
    process.stderr.write(`\rDetails: ${totalDetails}/${allHashIds.length}`);
    await delay(200);
  }
  process.stderr.write('\n');

  // Build report with per-category sections + merged backward-compat top-level
  const report: Record<string, any> = {
    meta: {
      scraper: 'sreality-cz',
      categories_sampled: Object.values(CATEGORIES),
      listings_fetched: totalListings,
      details_fetched: totalDetails,
      per_category_counts: categoryCounts,
      timestamp: new Date().toISOString(),
    },
  };

  for (const cat of Object.values(CATEGORIES)) {
    report[cat] = {
      listing_fields: catListingCollectors[cat].report(),
      detail_fields: catDetailCollectors[cat].report(),
    };
  }

  // Backward-compat merged top-level
  report.listing_fields = mergedListingCollector.report();
  report.detail_fields = mergedDetailCollector.report();

  console.log(JSON.stringify(report, null, 2));
}

main().catch(console.error);
