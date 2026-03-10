/**
 * Fetch a large sample of realingo listings + details and report distinct values per field.
 * Samples all 4 categories (apartment, house, land, commercial) x 2 transaction types (sale, rent).
 * Usage: npx ts-node src/raw_samples/fetch-distinct-values.ts [--pages N]
 */
import { FieldCollector, parsePages, delay } from './analyze-fields';

const FIRST = 20;
const DETAIL_CONCURRENCY = 5;

const listingQuery = `
  query SearchOffer($purpose: OfferPurpose, $property: PropertyType, $first: Int, $skip: Int) {
    searchOffer(filter: { purpose: $purpose, property: $property }, first: $first, skip: $skip) {
      total
      items {
        id adId category url property purpose
        location { address latitude longitude }
        price { total currency vat }
        area { floor plot garden built cellar balcony terrace loggia }
        photos { main list }
        updatedAt createdAt
      }
    }
  }
`;

function detailQuery(offerId: string) {
  return `{
    offer(id: "${offerId}") {
      id adId category url property purpose
      location { address latitude longitude }
      price { total currency vat }
      area { floor plot garden built cellar balcony terrace loggia }
      detail {
        description externalUrl buildingType buildingStatus buildingPosition
        houseType ownership furniture floor floorTotal yearBuild yearReconstructed
        parking parkingPlaces garages energyPerformance energyPerformanceValue
        heating electricity waterSupply gas balcony loggia terrace lift cellar
        isBarrierFree isAuction roomCount flatCount flatClass availableFromDate ceilingHeight
      }
      photos { main list }
      updatedAt createdAt
    }
  }`;
}

const PURPOSES = ['SELL', 'RENT'];

const PROPERTY_TO_CATEGORY: Record<string, string> = {
  FLAT: 'apartment',
  HOUSE: 'house',
  LAND: 'land',
  COMMERCIAL: 'commercial',
};

const PROPERTIES = Object.keys(PROPERTY_TO_CATEGORY);

const HEADERS = {
  'Content-Type': 'application/json',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

async function gql(query: string, variables?: any): Promise<any> {
  const res = await fetch('https://www.realingo.cz/graphql', {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify(variables ? { query, variables } : { query }),
  });
  return res.json();
}

async function main() {
  const pages = parsePages(5);

  // Per-category collectors
  const catListingCollectors: Record<string, FieldCollector> = {};
  const catDetailCollectors: Record<string, FieldCollector> = {};
  const categoryCounts: Record<string, { listings: number; details: number }> = {};

  for (const cat of Object.values(PROPERTY_TO_CATEGORY)) {
    catListingCollectors[cat] = new FieldCollector();
    catDetailCollectors[cat] = new FieldCollector();
    categoryCounts[cat] = { listings: 0, details: 0 };
  }

  // Merged collectors for backward-compat top-level output
  const mergedListingCollector = new FieldCollector();
  const mergedDetailCollector = new FieldCollector();

  let totalListings = 0;
  let totalDetails = 0;
  const allIds: Array<{ id: string; category: string }> = [];

  // Phase 1: Listing pages
  for (const purpose of PURPOSES) {
    for (const property of PROPERTIES) {
      const catName = PROPERTY_TO_CATEGORY[property];
      for (let page = 0; page < pages; page++) {
        try {
          const data = await gql(listingQuery, { purpose, property, first: FIRST, skip: page * FIRST });
          const items = data?.data?.searchOffer?.items || [];
          if (items.length === 0) break;
          for (const item of items) {
            catListingCollectors[catName].add(item);
            mergedListingCollector.add(item);
            categoryCounts[catName].listings++;
            totalListings++;
            if (item.id) allIds.push({ id: item.id, category: catName });
          }
          process.stderr.write(`\rListings [${catName}/${purpose}]: page ${page + 1}, total ${totalListings}`);
        } catch (err: any) {
          process.stderr.write(`\n${purpose}/${property} page ${page} failed: ${err.message}\n`);
        }
        await delay(300);
      }
    }
  }
  process.stderr.write('\n');

  // Phase 2: Detail pages
  for (let i = 0; i < allIds.length; i += DETAIL_CONCURRENCY) {
    const batch = allIds.slice(i, i + DETAIL_CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map(async ({ id }) => {
        const data = await gql(detailQuery(id));
        return data?.data?.offer;
      })
    );
    for (let j = 0; j < results.length; j++) {
      const r = results[j];
      if (r.status === 'fulfilled' && r.value) {
        const catName = batch[j].category;
        catDetailCollectors[catName].add(r.value);
        mergedDetailCollector.add(r.value);
        categoryCounts[catName].details++;
        totalDetails++;
      }
    }
    process.stderr.write(`\rDetails: ${totalDetails}/${allIds.length}`);
    await delay(200);
  }
  process.stderr.write('\n');

  // Build report with per-category sections + merged backward-compat top-level
  const report: Record<string, any> = {
    meta: {
      scraper: 'realingo-cz',
      categories_sampled: Object.values(PROPERTY_TO_CATEGORY),
      listings_fetched: totalListings,
      details_fetched: totalDetails,
      per_category_counts: categoryCounts,
      timestamp: new Date().toISOString(),
    },
  };

  for (const cat of Object.values(PROPERTY_TO_CATEGORY)) {
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
