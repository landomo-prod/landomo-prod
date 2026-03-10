import axios from 'axios';
import { HusaskjolListing } from '../transformers';

const BASE_URL = 'https://www.husaskjol.is';

const LISTING_URLS = [
  `${BASE_URL}/eignir-til-solu/`,
  `${BASE_URL}/eignir-til-leigu/`,
  `${BASE_URL}/soluskra/`,
];

const REQUEST_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'is-IS,is;q=0.9,en-US;q=0.8,en;q=0.7',
};

const DELAY_MS = parseInt(process.env.REQUEST_DELAY_MS || '800', 10);

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch a URL and extract the __NEXT_DATA__ JSON embedded in the HTML.
 * Returns null if the script tag is not found.
 */
async function fetchNextData(url: string): Promise<unknown | null> {
  try {
    const response = await axios.get(url, {
      headers: REQUEST_HEADERS,
      timeout: 30000,
      // Follow redirects
      maxRedirects: 5,
    });

    const html: string = response.data;
    const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    if (!match) {
      console.log(JSON.stringify({ level: 'warn', msg: '__NEXT_DATA__ not found', url }));
      return null;
    }

    return JSON.parse(match[1]);
  } catch (err: any) {
    console.error(JSON.stringify({ level: 'error', msg: 'Failed to fetch page', url, err: err.message }));
    return null;
  }
}

/**
 * Try to extract a listings array from various possible __NEXT_DATA__ structures.
 */
function extractListings(nextData: unknown): HusaskjolListing[] {
  if (!nextData || typeof nextData !== 'object') return [];

  const data = nextData as Record<string, unknown>;

  // Walk common paths
  const candidates = [
    getPath(data, ['props', 'pageProps', 'listings']),
    getPath(data, ['props', 'pageProps', 'properties']),
    getPath(data, ['props', 'pageProps', 'eignir']),
    getPath(data, ['props', 'pageProps', 'data', 'listings']),
    getPath(data, ['props', 'pageProps', 'data', 'properties']),
    getPath(data, ['props', 'pageProps', 'data', 'eignir']),
    getPath(data, ['props', 'pageProps', 'initialData', 'listings']),
    getPath(data, ['props', 'pageProps', 'initialData', 'properties']),
    getPath(data, ['props', 'pageProps', 'soluskra']),
    getPath(data, ['props', 'pageProps', 'items']),
    getPath(data, ['props', 'pageProps', 'results']),
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length > 0) {
      console.log(JSON.stringify({ level: 'info', msg: 'Found listings array', count: candidate.length }));
      return candidate as HusaskjolListing[];
    }
  }

  // If no known path works, try to find any array of objects that look like listings
  const found = findListingsArray(data);
  if (found.length > 0) {
    console.log(JSON.stringify({ level: 'info', msg: 'Found listings via deep scan', count: found.length }));
    return found;
  }

  // Log available top-level structure for debugging
  const pageProps = getPath(data, ['props', 'pageProps']);
  if (pageProps && typeof pageProps === 'object') {
    console.log(JSON.stringify({
      level: 'debug',
      msg: 'pageProps keys available',
      keys: Object.keys(pageProps as object),
    }));
  }

  return [];
}

function getPath(obj: unknown, path: string[]): unknown {
  let current: unknown = obj;
  for (const key of path) {
    if (current === null || current === undefined || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

/**
 * Deep-scan an object to find the largest array of objects that look like property listings
 * (have at least an id/slug and price or size field).
 */
function findListingsArray(obj: unknown, depth = 0): HusaskjolListing[] {
  if (depth > 5 || !obj || typeof obj !== 'object') return [];

  if (Array.isArray(obj)) {
    if (obj.length > 0 && isListingLike(obj[0])) {
      return obj as HusaskjolListing[];
    }
    // Recurse into array elements to find nested arrays
    for (const item of obj) {
      const found = findListingsArray(item, depth + 1);
      if (found.length > 0) return found;
    }
    return [];
  }

  const record = obj as Record<string, unknown>;
  let best: HusaskjolListing[] = [];

  for (const value of Object.values(record)) {
    const found = findListingsArray(value, depth + 1);
    if (found.length > best.length) {
      best = found;
    }
  }

  return best;
}

function isListingLike(obj: unknown): boolean {
  if (!obj || typeof obj !== 'object') return false;
  const keys = Object.keys(obj as object).map(k => k.toLowerCase());
  const hasIdentifier = keys.some(k => ['id', 'slug', 'url', 'fastanumer'].includes(k));
  const hasPropertyField = keys.some(k =>
    ['price', 'verd', 'size', 'sqm', 'fermetrar', 'type', 'tegund', 'address', 'heimilisfang'].includes(k)
  );
  return hasIdentifier && hasPropertyField;
}

/**
 * Try to extract pagination info from __NEXT_DATA__ and return total pages.
 */
function extractPaginationInfo(nextData: unknown): { totalPages: number; baseUrl?: string } {
  if (!nextData || typeof nextData !== 'object') return { totalPages: 1 };

  const data = nextData as Record<string, unknown>;
  const pageProps = getPath(data, ['props', 'pageProps']) as Record<string, unknown> | undefined;

  if (!pageProps) return { totalPages: 1 };

  // Check various pagination shapes
  const pagination = (pageProps['pagination'] ?? pageProps['paging'] ?? pageProps['meta']) as Record<string, unknown> | undefined;
  if (pagination) {
    const total = pagination['totalPages'] ?? pagination['total_pages'] ?? pagination['lastPage'] ?? pagination['pageCount'];
    if (total) return { totalPages: Number(total) };

    const count = pagination['total'] ?? pagination['count'] ?? pagination['totalCount'];
    const perPage = pagination['perPage'] ?? pagination['per_page'] ?? pagination['pageSize'] ?? 20;
    if (count) return { totalPages: Math.ceil(Number(count) / Number(perPage)) };
  }

  return { totalPages: 1 };
}

/**
 * Build a paginated URL. Husaskjol uses query params or path segments.
 * Try ?page=N first.
 */
function buildPageUrl(baseUrl: string, page: number): string {
  const url = new URL(baseUrl);
  url.searchParams.set('page', String(page));
  return url.toString();
}

/**
 * Fetch detail page for a single listing to get full data.
 * Falls back gracefully if detail fetch fails.
 */
async function fetchDetailListing(slug: string): Promise<HusaskjolListing | null> {
  const url = `${BASE_URL}/eign/${slug}`;
  const nextData = await fetchNextData(url);
  if (!nextData) return null;

  const data = nextData as Record<string, unknown>;
  const pageProps = getPath(data, ['props', 'pageProps']) as Record<string, unknown> | undefined;
  if (!pageProps) return null;

  // Detail page usually has a single property object
  const property =
    pageProps['listing'] ??
    pageProps['property'] ??
    pageProps['eign'] ??
    pageProps['data'];

  if (property && typeof property === 'object' && !Array.isArray(property)) {
    return property as HusaskjolListing;
  }

  return null;
}

/**
 * Scrape all listings from husaskjol.is.
 * Calls onBatch for each batch of listings found.
 */
export async function scrapeAll(
  onBatch: (listings: HusaskjolListing[]) => Promise<void>
): Promise<void> {
  const seenIds = new Set<string | number>();
  let totalScraped = 0;

  const FETCH_DETAILS = process.env.FETCH_DETAILS !== 'false'; // default true
  const MAX_PAGES = parseInt(process.env.MAX_PAGES || '50', 10);
  const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '50', 10);

  for (const listingUrl of LISTING_URLS) {
    console.log(JSON.stringify({ level: 'info', msg: 'Fetching listing page', url: listingUrl }));

    const firstPageData = await fetchNextData(listingUrl);
    if (!firstPageData) continue;

    const firstPageListings = extractListings(firstPageData);
    const { totalPages } = extractPaginationInfo(firstPageData);

    console.log(JSON.stringify({
      level: 'info',
      msg: 'Pagination info',
      url: listingUrl,
      totalPages,
      listingsOnPage: firstPageListings.length,
    }));

    // Process first page
    const newListings = firstPageListings.filter(l => {
      const id = l.id ?? l.slug;
      if (!id || seenIds.has(id)) return false;
      seenIds.add(id);
      return true;
    });

    if (newListings.length > 0) {
      const enriched = FETCH_DETAILS
        ? await enrichWithDetails(newListings)
        : newListings;
      await onBatch(enriched);
      totalScraped += enriched.length;
    }

    // Fetch remaining pages
    const pagesToFetch = Math.min(totalPages, MAX_PAGES);
    for (let page = 2; page <= pagesToFetch; page++) {
      await sleep(DELAY_MS);

      const pageUrl = buildPageUrl(listingUrl, page);
      console.log(JSON.stringify({ level: 'info', msg: 'Fetching page', url: pageUrl, page }));

      const pageData = await fetchNextData(pageUrl);
      if (!pageData) {
        console.log(JSON.stringify({ level: 'warn', msg: 'No data on page, stopping', page }));
        break;
      }

      const pageListings = extractListings(pageData);
      if (pageListings.length === 0) {
        console.log(JSON.stringify({ level: 'info', msg: 'Empty page, stopping pagination', page }));
        break;
      }

      const newPageListings = pageListings.filter(l => {
        const id = l.id ?? l.slug;
        if (!id || seenIds.has(id)) return false;
        seenIds.add(id);
        return true;
      });

      if (newPageListings.length === 0) {
        console.log(JSON.stringify({ level: 'info', msg: 'All listings already seen, stopping', page }));
        break;
      }

      const enrichedPage = FETCH_DETAILS
        ? await enrichWithDetails(newPageListings)
        : newPageListings;

      await onBatch(enrichedPage);
      totalScraped += enrichedPage.length;

      // Flush in sub-batches to avoid holding too many in memory
      if (newPageListings.length < BATCH_SIZE) break;
    }
  }

  console.log(JSON.stringify({ level: 'info', msg: 'Scrape complete', totalScraped }));
}

/**
 * Enrich listings with detail page data when a slug is available.
 * Falls back to original listing data if detail fetch fails.
 */
async function enrichWithDetails(listings: HusaskjolListing[]): Promise<HusaskjolListing[]> {
  const enriched: HusaskjolListing[] = [];

  for (const listing of listings) {
    const slug = listing.slug;
    if (slug) {
      await sleep(DELAY_MS);
      const detail = await fetchDetailListing(String(slug));
      if (detail) {
        // Merge: detail overrides index data, but keep index fields as fallback
        enriched.push({ ...listing, ...detail, slug: String(slug) });
        continue;
      }
    }
    enriched.push(listing);
  }

  return enriched;
}
