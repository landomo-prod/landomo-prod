import axios from 'axios';
import { KMSearchResponse, KMListing, KMScrapeTarget } from '../types/kiinteistomaailmaTypes';
import { getRandomUserAgent } from '../utils/userAgents';

const KM_BASE_URL = 'https://www.kiinteistomaailma.fi';
const KM_API_URL = `${KM_BASE_URL}/api/km/KM/`;

/**
 * Scrape targets: for-sale and rental listings.
 *
 * Kiinteistömaailma is a residential-only agency chain. All listing types
 * (apartment, house, land) appear in a single API endpoint differentiated
 * by the `type` field in the response.
 *
 * API stats (Feb 2026):
 *   For sale: ~6,278
 *   Rental:   ~418
 *   Total:    ~6,696
 */
const SCRAPE_TARGETS: KMScrapeTarget[] = [
  { rental: false, name: 'myytavat-kohteet' },
  { rental: true, name: 'vuokra-kohteet' },
];

const PAGE_SIZE = 100;
const CONCURRENT_PAGES = 5;
const DELAY_BETWEEN_TARGETS_MS = 1000;
const DELAY_BETWEEN_BATCHES_MS = 300;
const REQUEST_TIMEOUT_MS = 30000;

/**
 * Build request headers for Kiinteistömaailma API calls.
 * The API does not require auth tokens — it is a public REST API.
 */
function buildHeaders(): Record<string, string> {
  return {
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': 'fi-FI,fi;q=0.9,en;q=0.8',
    Referer: `${KM_BASE_URL}/haku`,
    'User-Agent': getRandomUserAgent(),
  };
}

/**
 * Fetch a single page of search results from the Kiinteistömaailma API.
 */
async function fetchPage(rental: boolean, offset: number): Promise<KMSearchResponse> {
  const params = new URLSearchParams({
    areaType: 'living',
    limit: String(PAGE_SIZE),
    offset: String(offset),
    rental: String(rental),
    sort: 'latestPublishTimestamp',
    sortOrder: 'desc',
    type: 'property',
    maxArea: '',
    minArea: '',
    maxYearBuilt: '',
    minYearBuilt: '',
  });

  const url = `${KM_API_URL}?${params.toString()}`;

  const response = await axios.get<KMSearchResponse>(url, {
    headers: buildHeaders(),
    timeout: REQUEST_TIMEOUT_MS,
  });

  return response.data;
}

/**
 * Scrape all listings for a single target (for-sale or rental).
 * Uses parallel page fetching for efficiency.
 */
async function scrapeTarget(
  target: KMScrapeTarget,
  onBatch?: (batch: KMListing[]) => Promise<void>
): Promise<KMListing[]> {
  const allListings: KMListing[] = [];

  // Fetch first page to determine total count
  const firstPage = await fetchPage(target.rental, 0);

  if (!firstPage.success) {
    throw new Error(`API returned success=false for target ${target.name}`);
  }

  const totalMatches = firstPage.data.matches;

  console.log(JSON.stringify({
    level: 'info',
    service: 'kiinteistomaailma-fi-scraper',
    msg: 'Scraping target',
    target: target.name,
    rental: target.rental,
    totalMatches,
  }));

  if (firstPage.data.results.length === 0) {
    return allListings;
  }

  allListings.push(...firstPage.data.results);
  if (onBatch && firstPage.data.results.length > 0) {
    await onBatch(firstPage.data.results);
  }

  if (totalMatches <= PAGE_SIZE) {
    return allListings;
  }

  // Build remaining offsets
  const remainingOffsets: number[] = [];
  for (let offset = PAGE_SIZE; offset < totalMatches; offset += PAGE_SIZE) {
    remainingOffsets.push(offset);
  }

  // Process in concurrent batches
  for (let i = 0; i < remainingOffsets.length; i += CONCURRENT_PAGES) {
    const batchOffsets = remainingOffsets.slice(i, i + CONCURRENT_PAGES);

    const pageResults = await Promise.allSettled(
      batchOffsets.map(offset => fetchPage(target.rental, offset))
    );

    const batchListings: KMListing[] = [];

    for (const result of pageResults) {
      if (result.status === 'fulfilled' && result.value.success) {
        batchListings.push(...result.value.data.results);
      } else {
        const reason =
          result.status === 'rejected' ? result.reason?.message || String(result.reason) : 'API returned success=false';
        console.error(JSON.stringify({
          level: 'error',
          service: 'kiinteistomaailma-fi-scraper',
          msg: 'Failed to fetch page',
          target: target.name,
          err: reason,
        }));
      }
    }

    if (batchListings.length > 0) {
      allListings.push(...batchListings);
      if (onBatch) {
        try {
          await onBatch(batchListings);
        } catch (err: any) {
          console.error(JSON.stringify({
            level: 'error',
            service: 'kiinteistomaailma-fi-scraper',
            msg: 'Batch callback failed',
            target: target.name,
            err: err.message,
          }));
        }
      }
    }

    if (allListings.length >= totalMatches) break;

    if (i + CONCURRENT_PAGES < remainingOffsets.length) {
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES_MS));
    }
  }

  console.log(JSON.stringify({
    level: 'info',
    service: 'kiinteistomaailma-fi-scraper',
    msg: 'Target scrape complete',
    target: target.name,
    scraped: allListings.length,
    expected: totalMatches,
  }));

  return allListings;
}

/**
 * Main scraper class for Kiinteistömaailma.fi.
 *
 * Strategy:
 * 1. Scrape for-sale listings (GET /api/km/KM/?rental=false)
 * 2. Scrape rental listings (GET /api/km/KM/?rental=true)
 * 3. Stream batches via onBatch callback as they arrive
 *
 * No authentication required — the API is public.
 *
 * API Stats (Feb 2026):
 *   For sale: ~6,278 listings
 *   Rental:   ~418 listings
 *   Total:    ~6,696 listings
 *
 * Expected runtime: 2-5 minutes with parallel fetching.
 */
export class ListingsScraper {
  /**
   * Scrape all Kiinteistömaailma listings.
   * @param onBatch - Optional streaming callback, called after each page batch
   */
  async scrapeAll(onBatch?: (batch: KMListing[]) => Promise<void>): Promise<KMListing[]> {
    console.log(JSON.stringify({
      level: 'info',
      service: 'kiinteistomaailma-fi-scraper',
      msg: 'Starting Kiinteistömaailma.fi scrape',
      targets: SCRAPE_TARGETS.map(t => t.name),
    }));

    const allListings: KMListing[] = [];

    for (let i = 0; i < SCRAPE_TARGETS.length; i++) {
      const target = SCRAPE_TARGETS[i];

      try {
        const listings = await scrapeTarget(target, onBatch);
        allListings.push(...listings);
      } catch (err: any) {
        console.error(JSON.stringify({
          level: 'error',
          service: 'kiinteistomaailma-fi-scraper',
          msg: 'Failed to scrape target',
          target: target.name,
          err: err.message,
        }));
        // Continue with remaining targets
      }

      if (i < SCRAPE_TARGETS.length - 1) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_TARGETS_MS));
      }
    }

    console.log(JSON.stringify({
      level: 'info',
      service: 'kiinteistomaailma-fi-scraper',
      msg: 'All targets scraped',
      totalListings: allListings.length,
    }));

    return allListings;
  }
}
