/**
 * Fetch a large sample of ulovdomov listings and report distinct values per field.
 * No detail endpoint needed — API returns full data.
 * Classifies listings into categories using the propertyType field from the API response.
 * Usage: npx ts-node src/raw_samples/fetch-distinct-values.ts [--pages N]
 */
import { FieldCollector, parsePages, delay } from './analyze-fields';

const PER_PAGE = 20;

const CZ_BOUNDS = {
  northEast: { lat: 51.06, lng: 18.87 },
  southWest: { lat: 48.55, lng: 12.09 },
};

const OFFER_TYPES = ['sale', 'rent'];

const CATEGORIES = ['apartment', 'house', 'land', 'commercial'] as const;

const PROPERTY_TYPE_MAP: Record<string, string> = {
  flat: 'apartment',
  room: 'apartment',
  house: 'house',
  land: 'land',
  commercial: 'commercial',
};

const HEADERS = {
  'Content-Type': 'application/json',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

async function main() {
  const pages = parsePages(10);

  // Per-category collectors (listing only — API returns full data)
  const catCollectors: Record<string, FieldCollector> = {};
  const categoryCounts: Record<string, { listings: number; details: number }> = {};

  for (const cat of CATEGORIES) {
    catCollectors[cat] = new FieldCollector();
    categoryCounts[cat] = { listings: 0, details: 0 };
  }

  // Merged collector for backward-compat top-level output
  const mergedCollector = new FieldCollector();
  let totalCount = 0;
  let skippedCount = 0;

  for (const offerType of OFFER_TYPES) {
    for (let page = 1; page <= pages; page++) {
      try {
        const res = await fetch(
          `https://ud.api.ulovdomov.cz/v1/offer/find?page=${page}&perPage=${PER_PAGE}&sorting=latest`,
          {
            method: 'POST',
            headers: HEADERS,
            body: JSON.stringify({ offerType, bounds: CZ_BOUNDS }),
          }
        );
        const data = await res.json();
        const offers = data?.data?.offers || data?.offers || data?.results || [];
        if (Array.isArray(offers)) {
          if (offers.length === 0) break;
          for (const offer of offers) {
            mergedCollector.add(offer);
            totalCount++;

            // Classify by propertyType field
            const catName = PROPERTY_TYPE_MAP[offer.propertyType];
            if (catName) {
              catCollectors[catName].add(offer);
              categoryCounts[catName].listings++;
            } else {
              skippedCount++;
            }
          }
        }
        process.stderr.write(`\r${offerType}: page ${page}/${pages}, total ${totalCount}`);
      } catch (err: any) {
        process.stderr.write(`\n${offerType} page ${page} failed: ${err.message}\n`);
      }
      await delay(300);
    }
  }
  process.stderr.write('\n');

  if (skippedCount > 0) {
    process.stderr.write(`Skipped ${skippedCount} offers with unmapped propertyType\n`);
  }

  // Build report with per-category sections + merged backward-compat top-level
  const report: Record<string, any> = {
    meta: {
      scraper: 'ulovdomov-cz',
      categories_sampled: CATEGORIES.filter(c => categoryCounts[c].listings > 0),
      listings_fetched: totalCount,
      details_fetched: 0,
      note: 'API returns full data in listing response',
      per_category_counts: categoryCounts,
      skipped_unmapped: skippedCount,
      timestamp: new Date().toISOString(),
    },
  };

  for (const cat of CATEGORIES) {
    if (categoryCounts[cat].listings > 0) {
      report[cat] = {
        listing_fields: catCollectors[cat].report(),
      };
    }
  }

  // Backward-compat merged top-level
  report.listing_fields = mergedCollector.report();

  console.log(JSON.stringify(report, null, 2));
}

main().catch(console.error);
