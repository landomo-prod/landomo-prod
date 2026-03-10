/**
 * Fetch a large sample of bezrealitky listings and report distinct values per field.
 * No detail endpoint needed — GraphQL returns full data.
 * Outputs per-category field breakdowns + merged backward-compat top-level.
 * Usage: npx ts-node src/raw_samples/fetch-distinct-values.ts [--pages N]
 */
import axios from 'axios';
import { getRandomUserAgent } from '../utils/userAgents';
import { FieldCollector, parsePages, delay } from './analyze-fields';

const LIMIT = 20;

const LISTINGS_QUERY = `query ListAdverts(
  $offerType: [OfferType],
  $estateType: [EstateType],
  $order: ResultOrder,
  $limit: Int,
  $offset: Int,
  $locale: Locale!
) {
  listAdverts(
    offerType: $offerType
    estateType: $estateType
    order: $order
    limit: $limit
    offset: $offset
    locale: $locale
  ) {
    totalCount
    list {
      id externalId hash uri code active isPausedBySystem isPausedByUser
      activationPending archived reserved highlighted isNew isEditable
      timeActivated timeDeactivated timeExpiration timeOrder daysActive
      title titleEnglish description descriptionEnglish descriptionSk
      imageAltText(locale: $locale)
      estateType offerType disposition landType houseType
      surface surfaceLand balconySurface loggiaSurface terraceSurface cellarSurface
      price priceFormatted(locale: $locale) deposit charges serviceCharges utilityCharges fee
      currency originalPrice isDiscounted serviceChargesNote utilityChargesNote
      gps { lat lng }
      address(locale: $locale) addressInput street houseNumber
      city(locale: $locale) cityDistrict(locale: $locale) zip
      region { id name uri }
      ruianId addressPointId
      isPrague isBrno isPragueWest isPragueEast isCityWithDistricts isTSRegion
      condition ownership equipped construction position situation
      floor totalFloors age execution reconstruction penb lowEnergy heating
      water sewage parking garage lift balcony terrace cellar loggia
      frontGarden newBuilding petFriendly barrierFree roommate shortTerm
      minRentDays maxRentDays availableFrom
      publicImages { id url(filter: RECORD_MAIN) order main filename }
      tour360 visitCount conversationCount locale charity
      showOwnest showPriceSuggestionButton threesome fivesome brizCount
      realmanExportEnabled hasContractRent rentPlatformStatus rentPlatformOrder
      tags(locale: $locale)
    }
  }
}`;

const OFFER_TYPES = ['PRODEJ', 'PRONAJEM'];

const ESTATE_TYPE_TO_CATEGORY: Record<string, string> = {
  BYT: 'apartment',
  DUM: 'house',
  POZEMEK: 'land',
  KOMERCNI: 'commercial',
};

const ESTATE_TYPES = Object.keys(ESTATE_TYPE_TO_CATEGORY);

async function main() {
  const pages = parsePages(10);

  // Per-category collectors
  const catCollectors: Record<string, FieldCollector> = {};
  const categoryCounts: Record<string, number> = {};

  for (const cat of Object.values(ESTATE_TYPE_TO_CATEGORY)) {
    catCollectors[cat] = new FieldCollector();
    categoryCounts[cat] = 0;
  }

  // Merged collector for backward-compat top-level output
  const mergedCollector = new FieldCollector();
  let totalCount = 0;

  for (const offerType of OFFER_TYPES) {
    for (const estateType of ESTATE_TYPES) {
      const catName = ESTATE_TYPE_TO_CATEGORY[estateType];
      for (let page = 0; page < pages; page++) {
        try {
          const { data } = await axios.post(
            'https://api.bezrealitky.cz/graphql/',
            {
              operationName: 'ListAdverts',
              variables: {
                offerType: [offerType],
                estateType: [estateType],
                order: 'TIMEORDER_DESC',
                limit: LIMIT,
                offset: page * LIMIT,
                locale: 'CS',
              },
              query: LISTINGS_QUERY,
            },
            {
              headers: {
                'Content-Type': 'application/json',
                'User-Agent': getRandomUserAgent(),
                Accept: 'application/json',
              },
            }
          );

          const list = data?.data?.listAdverts?.list || [];
          if (list.length === 0) break;

          for (const item of list) {
            catCollectors[catName].add(item);
            mergedCollector.add(item);
            categoryCounts[catName]++;
            totalCount++;
          }
          process.stderr.write(`\r${offerType}/${estateType}: page ${page + 1}/${pages}, total ${totalCount}`);
        } catch (err: any) {
          process.stderr.write(`\n${offerType}/${estateType} page ${page} failed: ${err.message}\n`);
        }
        await delay(300);
      }
    }
  }
  process.stderr.write('\n');

  // Build report with per-category sections + merged backward-compat top-level
  const report: Record<string, any> = {
    meta: {
      scraper: 'bezrealitky-cz',
      categories_sampled: Object.values(ESTATE_TYPE_TO_CATEGORY),
      listings_fetched: totalCount,
      details_fetched: 0,
      note: 'GraphQL returns full data in listing response',
      per_category_counts: categoryCounts,
      timestamp: new Date().toISOString(),
    },
  };

  for (const cat of Object.values(ESTATE_TYPE_TO_CATEGORY)) {
    report[cat] = {
      listing_fields: catCollectors[cat].report(),
    };
  }

  // Backward-compat merged top-level
  report.listing_fields = mergedCollector.report();

  console.log(JSON.stringify(report, null, 2));
}

main().catch(console.error);
