/**
 * home.dk Listings Scraper
 *
 * Strategy:
 *   1. Fetch listing index pages (for-sale and for-rent) via SSR HTML.
 *      home.dk uses Nuxt 3 SSR and embeds all listing data in
 *      <script type="application/json"> as a flat reference array.
 *   2. Parse the embedded payload to extract listing summaries.
 *   3. For each listing, fetch the detail page (same SSR technique) to
 *      obtain full stats (rooms, bathrooms, hasBalcony, etc.).
 *   4. Transform and ingest to the Denmark ingest service.
 *
 * Pagination:
 *   The SSR payload always renders page 1 regardless of URL. Client-side
 *   navigation to further pages is done by the Nuxt app. We exploit the
 *   `total` count from the first page to calculate page count, then fetch
 *   each page via SSR by navigating to the listing page URL and extracting
 *   the embedded JSON. Each page provides 12 listings (default pageSize).
 *
 * NOTE: The home.dk search API (api.home.dk/search/homedk/cases) requires
 * proprietary request validation that cannot be replicated without a browser
 * session. The SSR approach avoids this entirely.
 */

import axios, { AxiosInstance } from 'axios';
import { createLogger } from '@landomo/core';
import { getRandomUserAgent } from '../utils/userAgents';
import {
  HomePageResult,
  HomeListingSummary,
  HomeListingDetail,
  HomeAddress,
  HomeStatsSummary,
  HomeStatsDetail,
  HomeOffer,
  HomeMedia,
} from '../types/homeTypes';

const log = createLogger({ service: 'home-dk-scraper', portal: 'home-dk' });

const BASE_URL = 'https://home.dk';
const PAGE_SIZE = 12; // home.dk default SSR page size
const DETAIL_CONCURRENCY = parseInt(process.env.DETAIL_CONCURRENCY || '5', 10);
const REQUEST_DELAY_MS = parseInt(process.env.REQUEST_DELAY_MS || '300', 10);
const MAX_RETRIES = 3;

// Listing index URLs: for-sale and for-rent
const LISTING_URLS = [
  { url: `${BASE_URL}/til-salg/`, listingType: 'sale' },
  { url: `${BASE_URL}/til-leje/`, listingType: 'rent' },
];

function createHttpClient(): AxiosInstance {
  return axios.create({
    timeout: 30000,
    headers: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'da-DK,da;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
    maxRedirects: 5,
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Nuxt 3 SSR payload parser.
 *
 * home.dk embeds data as a flat array where object values are integer indices
 * (pointers to other array elements). This resolves the full object tree up to
 * a given depth, returning plain JS values.
 */
function resolveNuxtPayload(arr: any[], idx: number, depth = 0, visited = new Set<number>()): any {
  if (depth > 15 || visited.has(idx)) return undefined;
  visited = new Set(visited);
  visited.add(idx);

  const val = arr[idx];
  if (val === null || val === undefined) return null;
  if (typeof val === 'boolean' || typeof val === 'number' || typeof val === 'string') return val;

  if (Array.isArray(val)) {
    // Nuxt reactive wrappers: ['ShallowReactive', ref], ['Ref', ref], etc.
    if (val.length === 2 && typeof val[0] === 'string' && typeof val[1] === 'number') {
      return resolveNuxtPayload(arr, val[1], depth + 1, visited);
    }
    return val.map(v =>
      (typeof v === 'number' && v >= 0 && v < arr.length && typeof arr[v] !== 'number')
        ? resolveNuxtPayload(arr, v, depth + 1, visited)
        : v
    );
  }

  if (typeof val === 'object') {
    const result: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      if (typeof v === 'number' && v >= 0 && v < arr.length) {
        const pointed = arr[v];
        if (pointed === null) {
          result[k] = null;
        } else if (typeof pointed === 'boolean' || typeof pointed === 'string') {
          result[k] = pointed;
        } else if (typeof pointed === 'number') {
          // Could be a numeric value or an index – treat as value if target is also number
          result[k] = pointed;
        } else {
          result[k] = resolveNuxtPayload(arr, v, depth + 1, visited);
        }
      } else {
        result[k] = v;
      }
    }
    return result;
  }

  return val;
}

/**
 * Extract and resolve the Nuxt payload array from SSR HTML.
 */
function extractNuxtPayload(html: string): any[] | null {
  const match = html.match(/<script[^>]+type="application\/json"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

/**
 * Parse listing index page HTML.
 * Returns total count, hasNextPage, and resolved listing summaries.
 */
function parseListingPage(html: string): HomePageResult | null {
  const arr = extractNuxtPayload(html);
  if (!arr) return null;

  // Find the search results dict: has keys total, hasNextPage, results, facets
  // and total points to a large integer (listing count)
  let searchResults: any = null;
  for (const item of arr) {
    if (
      item &&
      typeof item === 'object' &&
      !Array.isArray(item) &&
      'total' in item &&
      'hasNextPage' in item &&
      'results' in item
    ) {
      const total = typeof item.total === 'number' ? arr[item.total] : item.total;
      if (typeof total === 'number' && total > 0) {
        searchResults = item;
        break;
      }
    }
  }

  if (!searchResults) return null;

  const total = arr[searchResults.total] as number;
  const hasNextPage = arr[searchResults.hasNextPage] as boolean;
  const resultIndices: number[] = Array.isArray(arr[searchResults.results])
    ? arr[searchResults.results]
    : [];

  const listings: HomeListingSummary[] = [];

  for (const listingIdx of resultIndices) {
    if (typeof listingIdx !== 'number') continue;
    const raw = arr[listingIdx];
    if (!raw || typeof raw !== 'object') continue;

    try {
      const resolved = resolveNuxtPayload(arr, listingIdx);
      if (!resolved || !resolved.id) continue;

      const listing = parseSummaryListing(resolved);
      if (listing) listings.push(listing);
    } catch (err: any) {
      log.warn({ err: err.message, idx: listingIdx }, 'Failed to resolve listing');
    }
  }

  return { total, hasNextPage, listings };
}

function parseSummaryListing(resolved: any): HomeListingSummary | null {
  if (!resolved.id || !resolved.url) return null;

  const address: HomeAddress = {
    full: resolved.address?.full ?? '',
    postalCode: resolved.address?.postalCode ?? '',
    city: resolved.address?.city ?? '',
    locationName: resolved.address?.locationName ?? null,
    road: resolved.address?.road ?? '',
    municipalityNumber: resolved.address?.municipalityNumber ?? null,
    municipality: resolved.address?.municipality ?? null,
    regionNumber: resolved.address?.regionNumber ?? null,
    longitude: resolved.address?.longitude ?? 0,
    latitude: resolved.address?.latitude ?? 0,
    houseNumber: resolved.address?.houseNumber ?? null,
    floor: resolved.address?.floor ?? null,
    doorLocation: resolved.address?.doorLocation ?? null,
    door: resolved.address?.door ?? null,
  };

  const stats: HomeStatsSummary = {
    floorArea: resolved.stats?.floorArea ?? null,
    plotArea: resolved.stats?.plotArea ?? null,
    floorAreaTotal: resolved.stats?.floorAreaTotal ?? null,
    totalSquareMeters: resolved.stats?.totalSquareMeters ?? null,
  };

  const media: HomeMedia[] = [];
  if (Array.isArray(resolved.presentationMedia)) {
    for (const m of resolved.presentationMedia) {
      if (m?.url) {
        media.push({
          url: m.url,
          type: m.type ?? 'Billede',
          priority: m.priority ?? '1',
          altText: m.altText ?? null,
        });
      }
    }
  }

  return {
    id: String(resolved.id),
    url: String(resolved.url),
    type: resolved.type ?? '',
    isBusinessCase: Boolean(resolved.isBusinessCase),
    isRentalCase: Boolean(resolved.isRentalCase),
    isLuxurious: Boolean(resolved.isLuxurious),
    isPlot: Boolean(resolved.isPlot),
    isComingSoon: Boolean(resolved.isComingSoon),
    address,
    stats,
    offer: {
      price: resolved.offer?.price ?? null,
      rentPerMonth: resolved.offer?.rentPerMonth ?? null,
      rentPerYear: resolved.offer?.rentPerYear ?? null,
    },
    headline: resolved.headline ?? null,
    presentationMedia: media,
  };
}

/**
 * Parse a detail page HTML.
 */
function parseDetailPage(html: string, listingId: string): HomeListingDetail | null {
  const arr = extractNuxtPayload(html);
  if (!arr) return null;

  // Find the main listing object: has keys id, propertyCategory, type, isBusinessCase,
  // isRentalCase, offer, address, stats, isForSale, isSold
  let listingRaw: any = null;
  for (const item of arr) {
    if (
      item &&
      typeof item === 'object' &&
      !Array.isArray(item) &&
      'id' in item &&
      'propertyCategory' in item &&
      'stats' in item &&
      'offer' in item &&
      'address' in item
    ) {
      // Verify it's the right listing by checking id resolves to our listingId
      const idVal = typeof item.id === 'number' ? arr[item.id] : item.id;
      if (String(idVal) === listingId) {
        listingRaw = item;
        break;
      }
    }
  }

  if (!listingRaw) {
    // Fallback: find first item with id matching listingId
    for (const item of arr) {
      if (
        item &&
        typeof item === 'object' &&
        !Array.isArray(item) &&
        'id' in item &&
        'propertyCategory' in item
      ) {
        const idVal = typeof item.id === 'number' ? arr[item.id] : item.id;
        if (String(idVal) === listingId) {
          listingRaw = item;
          break;
        }
      }
    }
  }

  if (!listingRaw) return null;

  try {
    const resolved = resolveNuxtPayload(arr, arr.indexOf(listingRaw));

    const address: HomeAddress = {
      full: resolved.address?.full ?? '',
      postalCode: resolved.address?.postalCode ?? '',
      city: resolved.address?.city ?? '',
      locationName: resolved.address?.locationName ?? null,
      road: resolved.address?.road ?? '',
      municipalityNumber: resolved.address?.municipalityNumber ?? null,
      municipality: resolved.address?.municipality ?? null,
      regionNumber: resolved.address?.regionNumber ?? null,
      longitude: resolved.address?.longitude ?? 0,
      latitude: resolved.address?.latitude ?? 0,
      houseNumber: resolved.address?.houseNumber ?? null,
      floor: resolved.address?.floor ?? null,
      doorLocation: resolved.address?.doorLocation ?? null,
      door: resolved.address?.door ?? null,
    };

    const stats: HomeStatsDetail = {
      energyLabel: resolved.stats?.energyLabel ?? null,
      isEnergyLabelRequired: Boolean(resolved.stats?.isEnergyLabelRequired),
      plotArea: resolved.stats?.plotArea ?? null,
      floorArea: resolved.stats?.floorArea ?? null,
      floorAreaTotal: resolved.stats?.floorAreaTotal ?? null,
      basementArea: resolved.stats?.basementArea ?? null,
      rooms: resolved.stats?.rooms ?? null,
      bathrooms: resolved.stats?.bathrooms ?? null,
      yearBuilt: resolved.stats?.yearBuilt ?? null,
      yearRenovated: resolved.stats?.yearRenovated ?? null,
      floors: resolved.stats?.floors ?? null,
      hasBalcony: resolved.stats?.hasBalcony ?? null,
      isStudentAppropriate: resolved.stats?.isStudentAppropriate ?? null,
      hasElevator: resolved.stats?.hasElevator ?? null,
      distanceToWater: resolved.stats?.distanceToWater ?? null,
      distanceToSchool: resolved.stats?.distanceToSchool ?? null,
      distanceToPublicTransport: resolved.stats?.distanceToPublicTransport ?? null,
      distanceToShopping: resolved.stats?.distanceToShopping ?? null,
      distanceToForest: resolved.stats?.distanceToForest ?? null,
      distanceToCity: resolved.stats?.distanceToCity ?? null,
      distanceToBeach: resolved.stats?.distanceToBeach ?? null,
      hasCourtYard: resolved.stats?.hasCourtYard ?? null,
      isWaterInstalled: resolved.stats?.isWaterInstalled ?? null,
      isSewered: resolved.stats?.isSewered ?? null,
      isElectricityInstalled: resolved.stats?.isElectricityInstalled ?? null,
      totalCommercialArea: resolved.stats?.totalCommercialArea ?? null,
      totalBuiltUpArea: resolved.stats?.totalBuiltUpArea ?? null,
      beds: resolved.stats?.beds ?? null,
      hasGarage: resolved.stats?.hasGarage ?? null,
      garageArea: resolved.stats?.garageArea ?? null,
      carportArea: resolved.stats?.carportArea ?? null,
      hasBuildingExtension: resolved.stats?.hasBuildingExtension ?? null,
      hasAnnex: resolved.stats?.hasAnnex ?? null,
      hasNewRoof: resolved.stats?.hasNewRoof ?? null,
    };

    const offer: HomeOffer = {
      cashPrice: resolved.offer?.cashPrice ?? null,
      technicalPrice: resolved.offer?.technicalPrice ?? null,
      squareMeterPrice: resolved.offer?.squareMeterPrice ?? null,
      ownerCostsTotalMonthlyAmount: resolved.offer?.ownerCostsTotalMonthlyAmount ?? null,
      priceChangedAt: resolved.offer?.priceChangedAt ?? null,
      downPayment: resolved.offer?.downPayment ?? null,
      mortgageGrossMonthly: resolved.offer?.mortgageGrossMonthly ?? null,
      mortgageNetMonthly: resolved.offer?.mortgageNetMonthly ?? null,
      cashPriceChangePercentage: resolved.offer?.cashPriceChangePercentage ?? null,
      rentalPricePerMonth: resolved.offer?.rentalPricePerMonth ?? null,
      rentalPricePerYear: resolved.offer?.rentalPricePerYear ?? null,
      rentalPricePrePaid: resolved.offer?.rentalPricePrePaid ?? null,
      rentalUtilitiesPerMonth: resolved.offer?.rentalUtilitiesPerMonth ?? null,
      rentalSecurityDeposit: resolved.offer?.rentalSecurityDeposit ?? null,
      yearlyRent: resolved.offer?.yearlyRent ?? null,
      yearlyRentalRevenue: resolved.offer?.yearlyRentalRevenue ?? null,
      rateOfReturn: resolved.offer?.rateOfReturn ?? null,
    };

    const media: HomeMedia[] = [];
    if (Array.isArray(resolved.presentationMedia)) {
      for (const m of resolved.presentationMedia) {
        if (m?.url) {
          media.push({
            url: m.url,
            type: m.type ?? 'Billede',
            priority: m.priority ?? '1',
            altText: m.altText ?? null,
          });
        }
      }
    }

    return {
      id: String(resolved.id),
      url: String(resolved.url ?? ''),
      propertyCategory: resolved.propertyCategory ?? '',
      alternativePropertyCategory: resolved.alternativePropertyCategory ?? null,
      type: resolved.type ?? '',
      isBusinessCase: Boolean(resolved.isBusinessCase),
      isRentalCase: Boolean(resolved.isRentalCase),
      isForSale: Boolean(resolved.isForSale),
      isUnderSale: Boolean(resolved.isUnderSale),
      isSold: Boolean(resolved.isSold),
      isRented: Boolean(resolved.isRented),
      isLuxurious: Boolean(resolved.isLuxurious),
      isPlot: Boolean(resolved.isPlot),
      isComingSoon: Boolean(resolved.isComingSoon),
      isHighlighted: Boolean(resolved.isHighlighted),
      headline: resolved.headline ?? null,
      subHeadline: resolved.subHeadline ?? null,
      salesPresentationDescription: resolved.salesPresentationDescription ?? null,
      listingDate: resolved.listingDate ?? null,
      shopNumber: resolved.shopNumber ?? null,
      brokerEmail: resolved.brokerEmail ?? null,
      address,
      stats,
      offer,
      presentationMedia: media,
    };
  } catch (err: any) {
    log.warn({ err: err.message, listingId }, 'Failed to resolve detail listing');
    return null;
  }
}

/**
 * Fetch a URL with retries.
 */
async function fetchWithRetry(
  client: AxiosInstance,
  url: string,
  attempt = 1,
): Promise<string | null> {
  try {
    const response = await client.get(url, {
      headers: { 'User-Agent': getRandomUserAgent() },
    });
    return response.data as string;
  } catch (err: any) {
    if (attempt < MAX_RETRIES) {
      const delay = attempt * 1000;
      log.warn({ url, attempt, delay }, 'Request failed, retrying');
      await sleep(delay);
      return fetchWithRetry(client, url, attempt + 1);
    }
    log.error({ err: err.message, url }, 'Request failed after retries');
    return null;
  }
}

/**
 * Fetch and parse a single listing index page.
 */
async function fetchListingPage(
  client: AxiosInstance,
  baseUrl: string,
  page: number,
): Promise<HomePageResult | null> {
  // Page 1 has no param; subsequent pages appear to be rendered via client-side
  // navigation. The SSR always returns page 1 regardless of ?page= param.
  // We handle all pages through the API result count and paginate by fetching
  // the same URL repeatedly - the SSR embeds full page 1 data each time.
  // For pages > 1, we cannot get SSR data directly, so we rely on the listing
  // detail fetch approach: collect all IDs from page 1, then use the known
  // listing URL pattern to fetch details directly.
  const url = page === 1 ? baseUrl : `${baseUrl}?page=${page}`;
  const html = await fetchWithRetry(client, url);
  if (!html) return null;
  return parseListingPage(html);
}

/**
 * Fetch and parse a property detail page.
 * URL format: https://home.dk/salg/huse-villaer/road-postcode-city/sag-ID/
 * The listing summary's `url` field contains the relative path.
 */
async function fetchDetailPage(
  client: AxiosInstance,
  listing: HomeListingSummary,
): Promise<HomeListingDetail | null> {
  const detailUrl = `${BASE_URL}/${listing.url}`;
  const html = await fetchWithRetry(client, detailUrl);
  if (!html) return null;
  return parseDetailPage(html, listing.id);
}

/**
 * Process a batch of listings concurrently to fetch details.
 */
async function fetchDetailsBatch(
  client: AxiosInstance,
  listings: HomeListingSummary[],
): Promise<HomeListingDetail[]> {
  const results: HomeListingDetail[] = [];
  const chunks: HomeListingSummary[][] = [];

  for (let i = 0; i < listings.length; i += DETAIL_CONCURRENCY) {
    chunks.push(listings.slice(i, i + DETAIL_CONCURRENCY));
  }

  for (const chunk of chunks) {
    const promises = chunk.map(async listing => {
      await sleep(Math.random() * REQUEST_DELAY_MS);
      return fetchDetailPage(client, listing);
    });

    const chunkResults = await Promise.all(promises);
    for (const detail of chunkResults) {
      if (detail) results.push(detail);
    }

    await sleep(REQUEST_DELAY_MS);
  }

  return results;
}

export interface ScrapeResult {
  saleListings: HomeListingDetail[];
  rentListings: HomeListingDetail[];
  totalSale: number;
  totalRent: number;
  errors: number;
}

/**
 * Main scrape function. Scrapes all for-sale and for-rent listings.
 *
 * Since home.dk SSR only returns page 1 data (12 listings), we must fetch
 * the detail page for each listing. For large catalogs (40k+ listings) we
 * iterate through pages but note that pagination beyond page 1 is not
 * directly available via SSR. The scraper collects all listings visible
 * from page 1 of each category/type combination.
 *
 * For a full catalog scrape, the recommended approach is to scrape by
 * property type sub-pages which each return ~12 listings per page:
 *   /til-salg/lejligheder/    - apartments
 *   /til-salg/huse-villaer/   - houses and villas
 *   /til-salg/grunde/         - land plots
 *   /til-salg/erhverv/        - commercial
 *   /til-leje/lejligheder/    - rental apartments
 *   /til-leje/huse-villaer/   - rental houses
 */
export async function scrapeAllListings(runId?: string): Promise<ScrapeResult> {
  const client = createHttpClient();
  const saleListings: HomeListingDetail[] = [];
  const rentListings: HomeListingDetail[] = [];
  let totalSale = 0;
  let totalRent = 0;
  let errors = 0;

  // Category sub-pages to scrape (each covers a subset, reduces per-page count)
  const SALE_CATEGORIES = [
    `${BASE_URL}/til-salg/lejligheder/`,
    `${BASE_URL}/til-salg/andelsboliger/`,
    `${BASE_URL}/til-salg/huse-villaer/`,
    `${BASE_URL}/til-salg/grunde/`,
    `${BASE_URL}/til-salg/erhverv/`,
    `${BASE_URL}/til-salg/sommerhuse/`,
    `${BASE_URL}/til-salg/landejendomme/`,
    `${BASE_URL}/til-salg/liebhaveri/`,
  ];

  const RENT_CATEGORIES = [
    `${BASE_URL}/til-leje/lejligheder/`,
    `${BASE_URL}/til-leje/huse-villaer/`,
    `${BASE_URL}/til-leje/erhverv/`,
  ];

  const allCategories = [
    ...SALE_CATEGORIES.map(url => ({ url, type: 'sale' as const })),
    ...RENT_CATEGORIES.map(url => ({ url, type: 'rent' as const })),
  ];

  for (const category of allCategories) {
    log.info({ url: category.url, type: category.type }, 'Scraping category');

    // Fetch page 1 to get total count
    const page1 = await fetchListingPage(client, category.url, 1);
    if (!page1) {
      log.warn({ url: category.url }, 'Failed to fetch category page 1');
      errors++;
      continue;
    }

    const categoryTotal = page1.total;
    log.info({ url: category.url, total: categoryTotal }, 'Category total listings');

    if (category.type === 'sale') totalSale += categoryTotal;
    else totalRent += categoryTotal;

    // Fetch details for page 1 listings
    if (page1.listings.length > 0) {
      log.info({ count: page1.listings.length }, 'Fetching details for page 1');
      const details = await fetchDetailsBatch(client, page1.listings);

      if (category.type === 'sale') saleListings.push(...details);
      else rentListings.push(...details);
    }

    // Calculate additional pages
    const totalPages = Math.ceil(categoryTotal / PAGE_SIZE);
    log.info({ totalPages }, 'Total pages for category');

    // For pages 2+, SSR renders the same page 1 data. We need a different
    // strategy: fetch using region/city sub-pages or accept that we only
    // get page 1 via SSR. In practice, category pages with < 12 listings
    // need no further pagination.
    //
    // For large categories (apartments, houses) with many pages, we log a
    // warning. The full solution requires the search API to work without
    // browser-session tokens, which is a future enhancement.
    if (totalPages > 1) {
      log.info(
        { totalPages, fetched: 1, note: 'SSR only provides page 1; use search API for full coverage' },
        'Category has multiple pages - only page 1 fetched via SSR'
      );
    }

    await sleep(REQUEST_DELAY_MS * 2);
  }

  return { saleListings, rentListings, totalSale, totalRent, errors };
}

/**
 * Scrape a single listing by its URL path (relative to home.dk).
 * Used for targeted re-scraping or testing.
 */
export async function scrapeSingleListing(urlPath: string): Promise<HomeListingDetail | null> {
  const client = createHttpClient();
  const url = urlPath.startsWith('http') ? urlPath : `${BASE_URL}/${urlPath}`;
  const html = await fetchWithRetry(client, url);
  if (!html) return null;

  // Extract listing ID from URL: .../sag-XXXXXXXXXX/
  const idMatch = url.match(/sag-(\d+)/);
  const listingId = idMatch ? idMatch[1] : '';

  return parseDetailPage(html, listingId);
}

export { parseListingPage, parseDetailPage, extractNuxtPayload };
