/**
 * LuxuryEstate.com Listings Scraper (Phase 1)
 *
 * Fetches search result pages and extracts minimal listing data
 * (ID, URL, price, title) sufficient for checksum comparison.
 * Does NOT fetch full detail pages - that is Phase 3.
 */

import axios, { AxiosInstance } from 'axios';
import * as cheerio from 'cheerio';
import { LuxuryEstateMinimalListing, SearchConfig, TransactionType, PropertyCategory } from '../types/luxuryEstateTypes';
import { randomUserAgent } from '../utils/userAgents';

const BASE_URL = 'https://www.luxuryestate.com';
const REQUEST_DELAY_MS = 600;
const REQUEST_TIMEOUT_MS = 30000;
const MAX_PAGES = 50;

/** All search configurations to iterate over */
export const SEARCH_CONFIGS: SearchConfig[] = [
  // For-sale: apartments  (URL: /apartments-italy)
  {
    url: `${BASE_URL}/apartments-italy`,
    category: 'apartments-sale',
    transactionType: 'sale',
    categoryHint: 'apartment',
  },
  // For-rent: apartments  (URL: /rent/apartments-italy)
  {
    url: `${BASE_URL}/rent/apartments-italy`,
    category: 'apartments-rent',
    transactionType: 'rent',
    categoryHint: 'apartment',
  },
  // For-sale: villas/houses  (URL: /villas-italy)
  {
    url: `${BASE_URL}/villas-italy`,
    category: 'villas-sale',
    transactionType: 'sale',
    categoryHint: 'house',
  },
  // For-rent: villas/houses  (URL: /rent/villas-italy)
  {
    url: `${BASE_URL}/rent/villas-italy`,
    category: 'villas-rent',
    transactionType: 'rent',
    categoryHint: 'house',
  },
  // For-sale: houses  (URL: /houses-italy)
  {
    url: `${BASE_URL}/houses-italy`,
    category: 'houses-sale',
    transactionType: 'sale',
    categoryHint: 'house',
  },
];

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Extracts the numeric listing ID from a LuxuryEstate URL.
 * URL pattern: /p{ID}-some-slug  or  /en/p{ID}-some-slug
 * Returns null if no match.
 */
export function extractIdFromUrl(url: string): string | null {
  const match = url.match(/\/p(\d+)[-/]/);
  return match ? match[1] : null;
}

/**
 * Parses a price string like "€ 2,500,000" or "2.500.000 EUR" into a number.
 */
function parsePrice(raw?: string): number | undefined {
  if (!raw) return undefined;
  const cleaned = raw.replace(/[^\d]/g, '');
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? undefined : num;
}

/**
 * Determines transaction type from URL or config.
 */
function detectTransactionType(url: string, fallback: TransactionType): TransactionType {
  if (url.includes('/for-rent/') || url.includes('/affitto/')) return 'rent';
  if (url.includes('/for-sale/') || url.includes('/vendita/')) return 'sale';
  return fallback;
}

/**
 * Determines category hint from URL path segments.
 */
function detectCategoryHint(url: string, fallback: PropertyCategory): PropertyCategory {
  const lower = url.toLowerCase();
  if (lower.includes('/apartment') || lower.includes('/appartament')) return 'apartment';
  if (lower.includes('/villa') || lower.includes('/house') || lower.includes('/chalet') || lower.includes('/farmhouse')) return 'house';
  return fallback;
}

export class ListingsScraper {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: BASE_URL,
      timeout: REQUEST_TIMEOUT_MS,
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,it;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Referer': BASE_URL,
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Upgrade-Insecure-Requests': '1',
      },
    });
  }

  private buildPageUrl(baseUrl: string, page: number): string {
    if (page === 1) return baseUrl;
    // LuxuryEstate uses ?pag=N for pagination
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}pag=${page}`;
  }

  private async fetchPage(url: string): Promise<string> {
    const response = await this.client.get<string>(url, {
      headers: { 'User-Agent': randomUserAgent() },
      responseType: 'text',
    });
    return response.data;
  }

  /**
   * Parse listings from a search result page HTML.
   *
   * LuxuryEstate server-side renders a <script type="application/json"
   * id="tracking-hydration"> tag that contains the full properties array
   * as JSON.  This is far more reliable than CSS selectors against hashed
   * Next.js class names that change with every deploy.
   *
   * JSON structure:
   *   { "properties": [ { id, url, title, price, bedrooms, bathrooms,
   *                        surface, transaction, type, geoInfo, ... }, ... ] }
   */
  private parseListings(
    html: string,
    config: SearchConfig
  ): LuxuryEstateMinimalListing[] {
    // --- Primary: extract from embedded JSON data ---
    const jsonListings = this.parseListingsFromJson(html, config);
    if (jsonListings.length > 0) return jsonListings;

    // --- Fallback: parse anchor tags pointing to /p{ID}-slug ---
    return this.parseListingsFromAnchors(html, config);
  }

  /**
   * Extract listings from the <script type="application/json" id="tracking-hydration">
   * block embedded in the page HTML.
   */
  private parseListingsFromJson(
    html: string,
    config: SearchConfig
  ): LuxuryEstateMinimalListing[] {
    // Match the specific script tag by id attribute
    const scriptMatch = html.match(
      /<script[^>]+id="tracking-hydration"[^>]*>([\s\S]*?)<\/script>/i
    );
    if (!scriptMatch) return [];

    let data: any;
    try {
      data = JSON.parse(scriptMatch[1]);
    } catch {
      return [];
    }

    const properties: any[] = data?.properties ?? [];
    if (!Array.isArray(properties) || properties.length === 0) return [];

    const listings: LuxuryEstateMinimalListing[] = [];
    const seen = new Set<string>();

    for (const prop of properties) {
      const urlPath: string = prop?.url ?? '';
      if (!urlPath) continue;

      const fullUrl = urlPath.startsWith('http') ? urlPath : `${BASE_URL}${urlPath}`;
      const id = String(prop?.id ?? extractIdFromUrl(fullUrl) ?? '');
      if (!id || seen.has(id)) continue;
      seen.add(id);

      // price.raw is already an integer (EUR); fallback to string parsing
      const priceRaw = prop?.price?.raw;
      const price: number | undefined =
        typeof priceRaw === 'number'
          ? priceRaw
          : parsePrice(prop?.price?.amount);

      // city from geoInfo object
      const geoInfo = prop?.geoInfo ?? {};
      const city: string | undefined =
        geoInfo?.city ?? geoInfo?.region ?? undefined;

      // Transaction type: use data from JSON, fall back to config
      const txLabel: string = (prop?.transaction ?? '').toLowerCase();
      const transactionHint: TransactionType =
        txLabel === 'rent' ? 'rent' : txLabel === 'sale' ? 'sale' : config.transactionType;

      // Category: derive from type label in JSON, fall back to config
      const typeLabel: string = (prop?.type ?? prop?.label ?? '').toLowerCase();
      let categoryHint: PropertyCategory = config.categoryHint;
      if (
        typeLabel.includes('villa') ||
        typeLabel.includes('house') ||
        typeLabel.includes('chalet') ||
        typeLabel.includes('farmhouse') ||
        typeLabel.includes('castle')
      ) {
        categoryHint = 'house';
      } else if (
        typeLabel.includes('apartment') ||
        typeLabel.includes('penthouse') ||
        typeLabel.includes('loft') ||
        typeLabel.includes('flat')
      ) {
        categoryHint = 'apartment';
      }

      listings.push({
        id,
        url: fullUrl,
        price,
        currency: 'EUR',
        title: prop?.title ?? undefined,
        thumbnail: prop?.picture
          ? (prop.picture.startsWith('//') ? `https:${prop.picture}` : prop.picture)
          : undefined,
        city,
        region: geoInfo?.region ?? undefined,
        categoryHint,
        transactionHint,
      });
    }

    return listings;
  }

  /**
   * Fallback anchor-based extraction for when the JSON hydration block is absent.
   * LuxuryEstate renders absolute URLs like href="https://www.luxuryestate.com/p{ID}-slug"
   */
  private parseListingsFromAnchors(
    html: string,
    config: SearchConfig
  ): LuxuryEstateMinimalListing[] {
    const $ = cheerio.load(html);
    const listings: LuxuryEstateMinimalListing[] = [];
    const seen = new Set<string>();

    // Match any anchor whose href contains /p{digits}
    $('a[href]').each((_i, el) => {
      const href = $(el).attr('href') || '';
      if (!/\/p\d+/.test(href)) return;

      const fullUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`;
      const id = extractIdFromUrl(fullUrl);
      if (!id || seen.has(id)) return;
      seen.add(id);

      listings.push({
        id,
        url: fullUrl,
        currency: 'EUR',
        categoryHint: detectCategoryHint(fullUrl, config.categoryHint),
        transactionHint: detectTransactionType(fullUrl, config.transactionType),
      });
    });

    return listings;
  }

  /**
   * Detect if there is a next page link on the current page.
   * LuxuryEstate uses ?pag=N for pagination.
   */
  private hasNextPage(html: string, currentPage: number): boolean {
    const $ = cheerio.load(html);
    // LuxuryEstate pagination links use ?pag=N
    const nextLink = $(
      `a[href*="pag=${currentPage + 1}"], a.next, a[rel="next"]`
    );
    return nextLink.length > 0;
  }

  /**
   * Scrape all pages for a single search configuration.
   * Calls onBatch after each page to allow streaming checksum comparison.
   */
  async scrapeConfig(
    config: SearchConfig,
    onBatch: (listings: LuxuryEstateMinimalListing[], config: SearchConfig) => Promise<void>
  ): Promise<LuxuryEstateMinimalListing[]> {
    const allListings: LuxuryEstateMinimalListing[] = [];
    let page = 1;

    console.log(JSON.stringify({
      level: 'info',
      service: 'luxuryestate-scraper',
      msg: 'Starting config',
      category: config.category,
      url: config.url,
    }));

    while (page <= MAX_PAGES) {
      const pageUrl = this.buildPageUrl(config.url, page);

      try {
        await delay(REQUEST_DELAY_MS);
        const html = await this.fetchPage(pageUrl);
        const listings = this.parseListings(html, config);

        if (listings.length === 0) {
          console.log(JSON.stringify({
            level: 'info',
            service: 'luxuryestate-scraper',
            msg: 'No listings found on page - stopping pagination',
            category: config.category,
            page,
          }));
          break;
        }

        allListings.push(...listings);

        console.log(JSON.stringify({
          level: 'info',
          service: 'luxuryestate-scraper',
          msg: 'Page scraped',
          category: config.category,
          page,
          count: listings.length,
          total: allListings.length,
        }));

        await onBatch(listings, config);

        if (!this.hasNextPage(html, page)) {
          console.log(JSON.stringify({
            level: 'info',
            service: 'luxuryestate-scraper',
            msg: 'No next page detected - stopping pagination',
            category: config.category,
            page,
          }));
          break;
        }

        page++;
      } catch (err: any) {
        console.error(JSON.stringify({
          level: 'error',
          service: 'luxuryestate-scraper',
          msg: 'Failed to fetch page',
          category: config.category,
          page,
          url: pageUrl,
          err: err.message,
          status: err.response?.status,
        }));
        break;
      }
    }

    return allListings;
  }

  /**
   * Scrape all search configurations.
   */
  async scrapeAll(
    onBatch: (listings: LuxuryEstateMinimalListing[], config: SearchConfig) => Promise<void>
  ): Promise<LuxuryEstateMinimalListing[]> {
    const allResults: LuxuryEstateMinimalListing[] = [];

    for (const config of SEARCH_CONFIGS) {
      try {
        const results = await this.scrapeConfig(config, onBatch);
        allResults.push(...results);
      } catch (err: any) {
        console.error(JSON.stringify({
          level: 'error',
          service: 'luxuryestate-scraper',
          msg: 'Config failed',
          category: config.category,
          err: err.message,
        }));
      }
    }

    return allResults;
  }
}
