import axios from 'axios';
import { createLogger } from '@landomo/core';
import { OikotieApiResponse, OikotieAuthHeaders } from '../types/toriTypes';
import { getRandomUserAgent } from '../utils/userAgents';

const log = createLogger({ service: 'tori-fi-scraper', portal: 'oikotie', country: 'finland' });

const BASE_URL = 'https://asunnot.oikotie.fi';
const PAGE_SIZE = 24; // Oikotie's default
const MAX_PAGE_SIZE = 100; // Oikotie supports up to 100 per request
const REQUEST_DELAY_MS = parseInt(process.env.REQUEST_DELAY_MS || '500', 10);

/**
 * Card types to scrape.
 * 100 = residential for sale
 * 101 = residential for rent
 * 105 = commercial for sale
 * 106 = commercial for rent
 */
const CARD_TYPES = [100, 101, 105, 106];

/**
 * Fetch the three OTA-* authentication headers required by the Oikotie API.
 *
 * The Oikotie Angular frontend reads these from meta tags injected by the PHP
 * server-side renderer. A new token is generated per session and appears to be
 * valid for the duration of the server session (typically several minutes).
 * We re-fetch before each full scrape run so the token is always fresh.
 */
export async function fetchAuthHeaders(): Promise<OikotieAuthHeaders> {
  const ua = getRandomUserAgent();

  const response = await axios.get(`${BASE_URL}/myytavat-asunnot`, {
    headers: {
      'User-Agent': ua,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'fi-FI,fi;q=0.9,en;q=0.8',
    },
    timeout: 30_000,
    maxRedirects: 3,
  });

  const html: string = response.data;

  const apiToken = extractMeta(html, 'api-token');
  const loaded = extractMeta(html, 'loaded');
  const cuid = extractMeta(html, 'cuid');

  if (!apiToken || !loaded || !cuid) {
    throw new Error(
      `Failed to extract Oikotie auth headers from HTML (apiToken=${apiToken}, loaded=${loaded}, cuid=${cuid})`
    );
  }

  log.debug({ loaded }, 'Fetched fresh OTA auth headers');

  return {
    'OTA-token': apiToken,
    'OTA-loaded': loaded,
    'OTA-cuid': cuid,
  };
}

function extractMeta(html: string, name: string): string | null {
  const regex = new RegExp(`name="${name}" content="([^"]+)"`);
  const match = html.match(regex);
  return match ? match[1] : null;
}

/**
 * Fetch one page of listings from the Oikotie search API.
 */
async function fetchPage(
  cardType: number,
  offset: number,
  limit: number,
  authHeaders: OikotieAuthHeaders
): Promise<OikotieApiResponse> {
  const ua = getRandomUserAgent();

  const params = new URLSearchParams({
    cardType: String(cardType),
    limit: String(limit),
    offset: String(offset),
    sortBy: 'published_sort_desc',
  });

  const response = await axios.get<OikotieApiResponse>(
    `${BASE_URL}/api/search?${params.toString()}`,
    {
      headers: {
        ...authHeaders,
        'User-Agent': ua,
        Accept: 'application/json',
        'Accept-Language': 'fi-FI,fi;q=0.9',
        Referer: `${BASE_URL}/myytavat-asunnot`,
      },
      timeout: 30_000,
    }
  );

  if ((response.data as any).code === 401) {
    throw new Error('Oikotie API returned 401 – auth headers may have expired');
  }

  return response.data;
}

export interface ScrapedPage {
  cardType: number;
  cards: OikotieApiResponse['cards'];
  found: number;
  offset: number;
}

/**
 * Scrape all listings for a single cardType, yielding batches of cards via
 * the provided callback. Pagination is handled automatically.
 *
 * @param cardType  Oikotie card type (100, 101, 105, 106)
 * @param authHeaders  OTA auth headers
 * @param onBatch  Called for each page of results
 */
async function scrapeCardType(
  cardType: number,
  authHeaders: OikotieAuthHeaders,
  onBatch: (page: ScrapedPage) => Promise<void>
): Promise<number> {
  // First request to determine total count
  const firstPage = await fetchPage(cardType, 0, MAX_PAGE_SIZE, authHeaders);
  const total = firstPage.found;

  log.info({ cardType, total }, 'Starting pagination');

  if (!total || total === 0) {
    log.warn({ cardType }, 'No listings found for cardType');
    return 0;
  }

  await onBatch({ cardType, cards: firstPage.cards, found: total, offset: 0 });

  let offset = MAX_PAGE_SIZE;
  while (offset < total) {
    await delay(REQUEST_DELAY_MS);

    try {
      const page = await fetchPage(cardType, offset, MAX_PAGE_SIZE, authHeaders);

      if (!page.cards || page.cards.length === 0) {
        log.info({ cardType, offset }, 'Empty page received, stopping pagination');
        break;
      }

      await onBatch({ cardType, cards: page.cards, found: total, offset });
      offset += page.cards.length;
    } catch (err: any) {
      if (err.message?.includes('401')) {
        throw err; // Propagate auth errors immediately
      }
      log.error({ err, cardType, offset }, 'Error fetching page, skipping');
      offset += MAX_PAGE_SIZE; // Skip this page on non-auth errors
    }
  }

  return total;
}

export interface ScrapeResult {
  totalByCardType: Record<number, number>;
  totalListings: number;
}

/**
 * Full scrape: iterate all CARD_TYPES, paginate through all listings, and
 * call onBatch for each page.
 *
 * Authentication headers are fetched once at the start of each scrape run.
 * If a 401 is encountered mid-scrape the headers are refreshed once and the
 * current page retried.
 */
export async function scrapeAllListings(
  onBatch: (page: ScrapedPage) => Promise<void>
): Promise<ScrapeResult> {
  let authHeaders = await fetchAuthHeaders();

  const totalByCardType: Record<number, number> = {};
  let totalListings = 0;

  for (const cardType of CARD_TYPES) {
    log.info({ cardType }, 'Starting scrape for cardType');

    try {
      const count = await scrapeCardType(cardType, authHeaders, onBatch);
      totalByCardType[cardType] = count;
      totalListings += count;
      log.info({ cardType, count }, 'Finished scraping cardType');
    } catch (err: any) {
      // On 401, refresh auth and retry this cardType once
      if (err.message?.includes('401')) {
        log.warn({ cardType }, 'Auth expired, refreshing headers and retrying cardType');
        try {
          authHeaders = await fetchAuthHeaders();
          const count = await scrapeCardType(cardType, authHeaders, onBatch);
          totalByCardType[cardType] = count;
          totalListings += count;
        } catch (retryErr) {
          log.error({ err: retryErr, cardType }, 'Failed to scrape cardType after auth refresh');
          totalByCardType[cardType] = 0;
        }
      } else {
        log.error({ err, cardType }, 'Fatal error scraping cardType');
        totalByCardType[cardType] = 0;
      }
    }

    // Brief pause between card types to avoid hammering the API
    if (CARD_TYPES.indexOf(cardType) < CARD_TYPES.length - 1) {
      await delay(2000);
    }
  }

  return { totalByCardType, totalListings };
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
