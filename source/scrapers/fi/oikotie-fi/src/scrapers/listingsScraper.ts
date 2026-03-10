import axios from 'axios';
import {
  OikotieSearchResponse,
  OikotieCard,
  OikotieAuthTokens,
  OikotieScrapeTarget,
} from '../types/oikotieTypes';
import { getRandomUserAgent } from '../utils/userAgents';

const OIKOTIE_BASE_URL = 'https://asunnot.oikotie.fi';
const OIKOTIE_API_BASE = `${OIKOTIE_BASE_URL}/api`;

/**
 * All card types to scrape.
 *
 * cardType 100 = myytavat-asunnot (for sale residential - both apartments and houses)
 * cardType 101 = vuokra-asunnot (rental residential)
 * cardType 102 = tontit (land plots)
 * cardType 103 = liiketilat (commercial spaces)
 *
 * Note: cardType 104 (vacation properties) is intentionally excluded - these are niche
 * summer cabins/cottages. Add back if needed.
 */
const SCRAPE_TARGETS: OikotieScrapeTarget[] = [
  { cardType: 100, name: 'myytavat-asunnot', category: 'apartment' },
  { cardType: 101, name: 'vuokra-asunnot', category: 'apartment' },
  { cardType: 102, name: 'tontit', category: 'land' },
  { cardType: 103, name: 'liiketilat', category: 'commercial' },
];

const ITEMS_PER_PAGE = 24;
const CONCURRENT_PAGES = 10;
const DELAY_BETWEEN_TARGETS_MS = 1000;
const DELAY_BETWEEN_BATCHES_MS = 300;
const REQUEST_TIMEOUT_MS = 30000;

/**
 * Fetch auth tokens from the Oikotie HTML page.
 *
 * Oikotie's Angular app embeds three authentication tokens in HTML meta tags:
 *   <meta name="api-token" content="...sha256 hash...">
 *   <meta name="loaded" content="...unix timestamp...">
 *   <meta name="cuid" content="...user id hash...">
 *
 * These must be sent as request headers: OTA-token, OTA-loaded, OTA-cuid
 * They are rotated periodically (token changes per session), so we fetch fresh
 * tokens at the start of each scrape run.
 */
async function fetchAuthTokens(): Promise<OikotieAuthTokens> {
  const response = await axios.get(`${OIKOTIE_BASE_URL}/myytavat-asunnot`, {
    headers: {
      'User-Agent': getRandomUserAgent(),
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'fi-FI,fi;q=0.9,en;q=0.8',
    },
    timeout: REQUEST_TIMEOUT_MS,
    maxRedirects: 5,
  });

  const html: string = response.data;

  const extractMeta = (name: string): string => {
    const match = html.match(new RegExp(`<meta[^>]+name="${name}"[^>]+content="([^"]+)"`, 'i'))
      || html.match(new RegExp(`<meta[^>]+content="([^"]+)"[^>]+name="${name}"`, 'i'));
    if (!match) {
      throw new Error(`Could not extract meta tag: ${name}`);
    }
    return match[1];
  };

  const token = extractMeta('api-token');
  const loaded = extractMeta('loaded');
  const cuid = extractMeta('cuid');

  return {
    'OTA-token': token,
    'OTA-loaded': loaded,
    'OTA-cuid': cuid,
  };
}

/**
 * Build request headers for Oikotie API calls
 */
function buildHeaders(tokens: OikotieAuthTokens): Record<string, string> {
  return {
    'OTA-token': tokens['OTA-token'],
    'OTA-loaded': tokens['OTA-loaded'],
    'OTA-cuid': tokens['OTA-cuid'],
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'fi-FI,fi;q=0.9',
    'Referer': `${OIKOTIE_BASE_URL}/myytavat-asunnot`,
    'User-Agent': getRandomUserAgent(),
  };
}

/**
 * Fetch a single page of search results
 */
async function fetchPage(
  cardType: number,
  offset: number,
  tokens: OikotieAuthTokens
): Promise<OikotieSearchResponse> {
  const url = `${OIKOTIE_API_BASE}/search?cardType=${cardType}&limit=${ITEMS_PER_PAGE}&offset=${offset}&sortBy=published_sort_desc`;

  const response = await axios.get<OikotieSearchResponse>(url, {
    headers: buildHeaders(tokens),
    timeout: REQUEST_TIMEOUT_MS,
  });

  return response.data;
}

/**
 * Scrape all listings for a single card type target.
 * Uses parallel page fetching for efficiency.
 *
 * @param target - The scrape target (cardType, name, category)
 * @param tokens - Auth tokens to use for all requests
 * @param onBatch - Optional streaming callback, called after each parallel page batch
 */
async function scrapeTarget(
  target: OikotieScrapeTarget,
  tokens: OikotieAuthTokens,
  onBatch?: (batch: OikotieCard[]) => Promise<void>
): Promise<OikotieCard[]> {
  const allCards: OikotieCard[] = [];

  // First, get the total count
  const firstPage = await fetchPage(target.cardType, 0, tokens);
  const totalFound = firstPage.found;

  console.log(JSON.stringify({
    level: 'info',
    service: 'oikotie-fi-scraper',
    msg: 'Scraping target',
    target: target.name,
    cardType: target.cardType,
    totalFound,
  }));

  if (firstPage.cards.length === 0) {
    return allCards;
  }

  // Process first page
  allCards.push(...firstPage.cards);
  if (onBatch && firstPage.cards.length > 0) {
    await onBatch(firstPage.cards);
  }

  if (totalFound <= ITEMS_PER_PAGE) {
    return allCards;
  }

  // Calculate remaining offsets
  const remainingOffsets: number[] = [];
  for (let offset = ITEMS_PER_PAGE; offset < totalFound; offset += ITEMS_PER_PAGE) {
    remainingOffsets.push(offset);
  }

  // Process remaining pages in concurrent batches
  for (let i = 0; i < remainingOffsets.length; i += CONCURRENT_PAGES) {
    const batchOffsets = remainingOffsets.slice(i, i + CONCURRENT_PAGES);

    const pageResults = await Promise.allSettled(
      batchOffsets.map(offset => fetchPage(target.cardType, offset, tokens))
    );

    const batchCards: OikotieCard[] = [];
    for (const result of pageResults) {
      if (result.status === 'fulfilled') {
        batchCards.push(...result.value.cards);
      } else {
        console.error(JSON.stringify({
          level: 'error',
          service: 'oikotie-fi-scraper',
          msg: 'Failed to fetch page',
          target: target.name,
          err: result.reason?.message || String(result.reason),
        }));
      }
    }

    if (batchCards.length > 0) {
      allCards.push(...batchCards);
      if (onBatch) {
        try {
          await onBatch(batchCards);
        } catch (err: any) {
          console.error(JSON.stringify({
            level: 'error',
            service: 'oikotie-fi-scraper',
            msg: 'Batch callback failed',
            target: target.name,
            err: err.message,
          }));
        }
      }
    }

    if (allCards.length >= totalFound) break;

    if (i + CONCURRENT_PAGES < remainingOffsets.length) {
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES_MS));
    }
  }

  console.log(JSON.stringify({
    level: 'info',
    service: 'oikotie-fi-scraper',
    msg: 'Target scrape complete',
    target: target.name,
    cardType: target.cardType,
    scraped: allCards.length,
    expected: totalFound,
  }));

  return allCards;
}

/**
 * Main scraper class for Oikotie.fi
 *
 * Strategy:
 * 1. Fetch fresh auth tokens from HTML meta tags (required for API auth)
 * 2. Scrape each card type (for sale, rental, land, commercial) with parallel pagination
 * 3. Stream batches via onBatch callback as they arrive
 *
 * API Stats (as of Feb 2026):
 * - cardType 100 (for sale): ~54,000 listings
 * - cardType 101 (rental): ~29,000 listings
 * - cardType 102 (land): ~3,400 listings
 * - cardType 103 (commercial): ~1,500 listings
 * - Total: ~88,000 listings
 */
export class ListingsScraper {
  /**
   * Scrape all Oikotie listings.
   * @param onBatch - Optional streaming callback
   */
  async scrapeAll(onBatch?: (batch: OikotieCard[]) => Promise<void>): Promise<OikotieCard[]> {
    console.log(JSON.stringify({
      level: 'info',
      service: 'oikotie-fi-scraper',
      msg: 'Starting Oikotie.fi scrape',
      targets: SCRAPE_TARGETS.map(t => t.name),
    }));

    // Fetch fresh auth tokens once per scrape run
    let tokens: OikotieAuthTokens;
    try {
      tokens = await fetchAuthTokens();
      console.log(JSON.stringify({
        level: 'info',
        service: 'oikotie-fi-scraper',
        msg: 'Auth tokens fetched successfully',
        loaded: tokens['OTA-loaded'],
      }));
    } catch (err: any) {
      throw new Error(`Failed to fetch Oikotie auth tokens: ${err.message}`);
    }

    const allCards: OikotieCard[] = [];

    for (let i = 0; i < SCRAPE_TARGETS.length; i++) {
      const target = SCRAPE_TARGETS[i];

      try {
        const cards = await scrapeTarget(target, tokens, onBatch);
        allCards.push(...cards);
      } catch (err: any) {
        console.error(JSON.stringify({
          level: 'error',
          service: 'oikotie-fi-scraper',
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
      service: 'oikotie-fi-scraper',
      msg: 'All targets scraped',
      totalCards: allCards.length,
    }));

    return allCards;
  }
}
