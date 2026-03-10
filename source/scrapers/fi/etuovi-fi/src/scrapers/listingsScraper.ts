import axios from 'axios';
import { OikotieCard, OikotieSearchResponse, OikotieSessionAuth, CARD_TYPES } from '../types/etuoviTypes';
import { getRandomUserAgent } from '../utils/userAgents';

const BASE_URL = 'https://asunnot.oikotie.fi';
const SEARCH_PAGE_URLS: Record<number, string> = {
  [CARD_TYPES.SALE]: `${BASE_URL}/myytavat-asunnot`,
  [CARD_TYPES.RENT]: `${BASE_URL}/vuokra-asunnot`,
  [CARD_TYPES.LAND_SALE]: `${BASE_URL}/myytavat-tontit`,
  [CARD_TYPES.COMMERCIAL]: `${BASE_URL}/myytavat-toimitilat`,
};

const LIMIT = 24;
const MAX_CONCURRENT = 10;
const DELAY_BETWEEN_BATCHES_MS = 500;

/**
 * Fetch a fresh session token by loading the search page HTML.
 * The Oikotie API requires three auth headers extracted from meta tags:
 *   OTA-token  → <meta name="api-token" content="...">
 *   OTA-loaded → <meta name="loaded" content="...">
 *   OTA-cuid   → <meta name="cuid" content="...">
 * Plus session cookies (PHPSESSID, user_id, AWSALB, AWSALBCORS).
 */
async function fetchSessionAuth(cardType: number): Promise<OikotieSessionAuth> {
  const pageUrl = SEARCH_PAGE_URLS[cardType] || SEARCH_PAGE_URLS[CARD_TYPES.SALE];
  const userAgent = getRandomUserAgent();

  const response = await axios.get<string>(pageUrl, {
    headers: {
      'User-Agent': userAgent,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'fi-FI,fi;q=0.9,en;q=0.8',
    },
    timeout: 30000,
    withCredentials: false,
    responseType: 'text',
  });

  const html = response.data;

  // Extract meta tag values
  const tokenMatch = html.match(/<meta name="api-token" content="([^"]+)"/);
  const loadedMatch = html.match(/<meta name="loaded" content="([^"]+)"/);
  const cuidMatch = html.match(/<meta name="cuid" content="([^"]+)"/);

  if (!tokenMatch || !loadedMatch || !cuidMatch) {
    throw new Error(`Failed to extract session auth from ${pageUrl}. Token found: ${!!tokenMatch}, Loaded: ${!!loadedMatch}, CUID: ${!!cuidMatch}`);
  }

  // Extract cookies from response headers
  const setCookieHeaders = (response.headers['set-cookie'] as string[] | undefined) || [];
  const cookies = setCookieHeaders
    .map(c => c.split(';')[0])
    .filter(Boolean)
    .join('; ');

  return {
    token: tokenMatch[1],
    loaded: loadedMatch[1],
    cuid: cuidMatch[1],
    cookies,
  };
}

/**
 * Build request headers with Oikotie session authentication.
 */
function buildHeaders(auth: OikotieSessionAuth, refererCardType: number): Record<string, string> {
  const headers: Record<string, string> = {
    'User-Agent': getRandomUserAgent(),
    'Accept': 'application/json',
    'Accept-Language': 'fi-FI,fi;q=0.9,en;q=0.8',
    'Referer': SEARCH_PAGE_URLS[refererCardType] || SEARCH_PAGE_URLS[CARD_TYPES.SALE],
    'OTA-token': auth.token,
    'OTA-loaded': auth.loaded,
    'OTA-cuid': auth.cuid,
  };
  if (auth.cookies) {
    headers['Cookie'] = auth.cookies;
  }
  return headers;
}

/**
 * Fetch a single page of listings from the Oikotie API.
 */
async function fetchPage(
  cardType: number,
  offset: number,
  auth: OikotieSessionAuth
): Promise<{ cards: OikotieCard[]; found: number }> {
  const params = new URLSearchParams({
    cardType: String(cardType),
    limit: String(LIMIT),
    offset: String(offset),
    sortBy: 'published_sort_desc',
  });

  const response = await axios.get<OikotieSearchResponse>(
    `${BASE_URL}/api/search?${params.toString()}`,
    {
      headers: buildHeaders(auth, cardType),
      timeout: 30000,
    }
  );

  const data = response.data;
  if (data.code !== undefined) {
    // Error response
    throw new Error(`API error for cardType=${cardType} offset=${offset}: ${JSON.stringify(data)}`);
  }

  return {
    cards: data.cards || [],
    found: data.found || 0,
  };
}

/**
 * Scrape all listings for a given card type using parallel page fetching.
 */
async function scrapeCardType(
  cardType: number,
  onBatch?: (batch: OikotieCard[]) => Promise<void>
): Promise<OikotieCard[]> {
  console.log(JSON.stringify({ level: 'info', service: 'etuovi-scraper', msg: 'Starting card type scrape', cardType }));

  // Fetch session auth for this card type's page
  const auth = await fetchSessionAuth(cardType);

  // First fetch to get total count
  const firstPage = await fetchPage(cardType, 0, auth);
  const totalFound = firstPage.found;

  console.log(JSON.stringify({ level: 'info', service: 'etuovi-scraper', msg: 'Total listings found', cardType, total: totalFound }));

  if (totalFound === 0) {
    return [];
  }

  const allCards: OikotieCard[] = [...firstPage.cards];

  if (onBatch && firstPage.cards.length > 0) {
    await onBatch(firstPage.cards);
  }

  if (firstPage.cards.length >= totalFound) {
    return allCards;
  }

  // Calculate remaining pages
  const totalPages = Math.ceil(totalFound / LIMIT);
  const remainingOffsets: number[] = [];
  for (let page = 1; page < totalPages; page++) {
    remainingOffsets.push(page * LIMIT);
  }

  // Fetch remaining pages in batches of MAX_CONCURRENT
  for (let i = 0; i < remainingOffsets.length; i += MAX_CONCURRENT) {
    const batchOffsets = remainingOffsets.slice(i, i + MAX_CONCURRENT);

    const results = await Promise.allSettled(
      batchOffsets.map(offset => fetchPage(cardType, offset, auth))
    );

    const batchCards: OikotieCard[] = [];
    for (const result of results) {
      if (result.status === 'fulfilled') {
        batchCards.push(...result.value.cards);
      } else {
        console.error(JSON.stringify({
          level: 'error',
          service: 'etuovi-scraper',
          msg: 'Page fetch failed',
          cardType,
          err: result.reason?.message || String(result.reason),
        }));
      }
    }

    allCards.push(...batchCards);

    if (onBatch && batchCards.length > 0) {
      await onBatch(batchCards);
    }

    console.log(JSON.stringify({
      level: 'info',
      service: 'etuovi-scraper',
      msg: 'Batch fetched',
      cardType,
      batchStart: i,
      batchSize: batchCards.length,
      totalSoFar: allCards.length,
      totalExpected: totalFound,
    }));

    // Respect rate limits between batches
    if (i + MAX_CONCURRENT < remainingOffsets.length) {
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES_MS));
    }

    // Re-auth periodically (token may expire) - every 500 pages
    if ((i / MAX_CONCURRENT) % 50 === 49) {
      try {
        const freshAuth = await fetchSessionAuth(cardType);
        Object.assign(auth, freshAuth);
        console.log(JSON.stringify({ level: 'info', service: 'etuovi-scraper', msg: 'Session refreshed', cardType }));
      } catch (err: any) {
        console.warn(JSON.stringify({ level: 'warn', service: 'etuovi-scraper', msg: 'Failed to refresh session', err: err.message }));
      }
    }
  }

  console.log(JSON.stringify({
    level: 'info',
    service: 'etuovi-scraper',
    msg: 'Card type scrape complete',
    cardType,
    total: allCards.length,
  }));

  return allCards;
}

/**
 * Main scraper class for Etuovi.com listings.
 *
 * Scrapes all major property types:
 *   - For-sale properties (apartments, houses) - cardType 100
 *   - Rental properties (apartments, houses) - cardType 101
 *   - Land/plots for sale - cardType 104
 *   - Commercial properties - cardType 105
 *
 * Note: Holiday/cottage properties (cardType 102) are also included.
 */
export class ListingsScraper {
  private cardTypes: number[];

  constructor() {
    // Card types to scrape - configurable via env
    const enabledTypes = process.env.ETUOVI_CARD_TYPES;
    if (enabledTypes) {
      this.cardTypes = enabledTypes.split(',').map(t => parseInt(t.trim(), 10));
    } else {
      this.cardTypes = [
        CARD_TYPES.SALE,       // 100 - for-sale (apartments + houses)
        CARD_TYPES.RENT,       // 101 - rentals
        CARD_TYPES.LAND_SALE,  // 104 - land/plots
        CARD_TYPES.COMMERCIAL, // 105 - commercial
      ];
    }
  }

  /**
   * Scrape all listings across all enabled card types.
   * Calls onBatch for each page batch (for streaming ingestion).
   */
  async scrapeAll(onBatch?: (batch: OikotieCard[]) => Promise<void>): Promise<OikotieCard[]> {
    console.log(JSON.stringify({
      level: 'info',
      service: 'etuovi-scraper',
      msg: 'Starting Etuovi scrape',
      cardTypes: this.cardTypes,
      streamingMode: !!onBatch,
    }));

    const allCards: OikotieCard[] = [];

    for (const cardType of this.cardTypes) {
      try {
        const cards = await scrapeCardType(cardType, onBatch);
        allCards.push(...cards);

        console.log(JSON.stringify({
          level: 'info',
          service: 'etuovi-scraper',
          msg: 'Card type complete',
          cardType,
          count: cards.length,
          totalSoFar: allCards.length,
        }));
      } catch (err: any) {
        console.error(JSON.stringify({
          level: 'error',
          service: 'etuovi-scraper',
          msg: 'Card type scrape failed',
          cardType,
          err: err.message,
        }));
        // Continue with other card types
      }

      // Delay between different card types
      if (this.cardTypes.indexOf(cardType) < this.cardTypes.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(JSON.stringify({
      level: 'info',
      service: 'etuovi-scraper',
      msg: 'Scrape complete',
      totalListings: allCards.length,
    }));

    return allCards;
  }
}
