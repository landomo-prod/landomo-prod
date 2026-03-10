import axios, { AxiosError, CancelTokenSource } from 'axios';
import { DanboligListResponse, DanboligPropertyRaw, DanboligFilter } from '../types/danboligTypes';
import { getRandomUserAgent } from '../utils/userAgents';

const BASE_URL = 'https://danbolig.dk';
const API_ENDPOINT = `${BASE_URL}/api/v1/properties/list`;
const ITEMS_PER_PAGE = 30;
const REQUEST_DELAY_MS = parseInt(process.env.REQUEST_DELAY_MS || '300', 10);
const MAX_RETRIES = 3;

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function buildHeaders(): Record<string, string> {
  return {
    'User-Agent': getRandomUserAgent(),
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'da-DK,da;q=0.9,en-US;q=0.8,en;q=0.7',
    'Content-Type': 'application/json',
    'Origin': 'https://danbolig.dk',
    'Referer': 'https://danbolig.dk/bolig/',
  };
}

/**
 * Fetch a single page from the danbolig.dk properties list API.
 */
async function fetchPage(
  page: number,
  filters: DanboligFilter[] = [],
  cancelToken?: CancelTokenSource
): Promise<DanboligListResponse> {
  const body = {
    filters,
    orderBy: 'relevant',
    page,
  };

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await axios.post<DanboligListResponse>(API_ENDPOINT, body, {
        headers: buildHeaders(),
        timeout: 30_000,
        cancelToken: cancelToken?.token,
      });
      return response.data;
    } catch (err) {
      if (axios.isCancel(err)) throw err;

      const axiosErr = err as AxiosError;
      const status = axiosErr.response?.status;

      if (status === 404 || status === 410) {
        throw new Error(`Page ${page} not found (HTTP ${status})`);
      }

      if (attempt < MAX_RETRIES) {
        const delayMs = REQUEST_DELAY_MS * Math.pow(2, attempt);
        console.warn(
          JSON.stringify({
            level: 'warn',
            service: 'danbolig-dk-scraper',
            msg: 'Fetch page retry',
            page,
            attempt,
            status,
            delayMs,
          })
        );
        await sleep(delayMs);
      } else {
        throw new Error(`Failed to fetch page ${page} after ${MAX_RETRIES} attempts: ${axiosErr.message}`);
      }
    }
  }

  throw new Error(`Unreachable: exhausted retries for page ${page}`);
}

/**
 * Extract only property items (filtering out ads and other response types).
 */
function extractProperties(response: DanboligListResponse): DanboligPropertyRaw[] {
  return response.data
    .filter(item => item.responseType === 'property')
    .map(item => item.data)
    .filter(Boolean);
}

export interface ScrapePage {
  properties: DanboligPropertyRaw[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
}

/**
 * Fetch a specific page and return structured result.
 */
export async function fetchListingsPage(
  page: number,
  filters: DanboligFilter[] = []
): Promise<ScrapePage> {
  const response = await fetchPage(page, filters);
  const properties = extractProperties(response);
  const totalPages = Math.ceil(response.totalCount / ITEMS_PER_PAGE);

  return {
    properties,
    totalCount: response.totalCount,
    totalPages,
    currentPage: page,
  };
}

/**
 * Scrape ALL pages from danbolig.dk with configurable concurrency.
 *
 * Strategy: Sequential page fetching with polite delays.
 * ~38k listings / 30 per page = ~1,267 pages total.
 * At 300ms delay: ~6-8 minutes.
 *
 * The onPage callback is called for each page so the caller
 * can process/ingest incrementally without buffering all listings.
 */
export async function scrapeAllListings(
  onPage: (page: ScrapePage) => Promise<void>,
  filters: DanboligFilter[] = []
): Promise<{ totalPages: number; totalListings: number; scrapedListings: number }> {
  // Fetch page 1 to determine total count
  const firstPage = await fetchListingsPage(1, filters);

  await onPage(firstPage);

  const totalPages = firstPage.totalPages;
  let scrapedListings = firstPage.properties.length;

  console.log(
    JSON.stringify({
      level: 'info',
      service: 'danbolig-dk-scraper',
      msg: 'Scrape started',
      totalListings: firstPage.totalCount,
      totalPages,
    })
  );

  for (let page = 2; page <= totalPages; page++) {
    await sleep(REQUEST_DELAY_MS);

    try {
      const result = await fetchListingsPage(page, filters);
      scrapedListings += result.properties.length;

      await onPage(result);

      if (page % 50 === 0 || page === totalPages) {
        console.log(
          JSON.stringify({
            level: 'info',
            service: 'danbolig-dk-scraper',
            msg: 'Scrape progress',
            page,
            totalPages,
            scrapedListings,
            totalListings: firstPage.totalCount,
          })
        );
      }
    } catch (err: any) {
      console.error(
        JSON.stringify({
          level: 'error',
          service: 'danbolig-dk-scraper',
          msg: 'Failed to fetch page',
          page,
          err: err.message,
        })
      );
      // Continue with next page on error
    }
  }

  return {
    totalPages,
    totalListings: firstPage.totalCount,
    scrapedListings,
  };
}
