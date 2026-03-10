import axios from 'axios';
import * as cheerio from 'cheerio';
import { getRealisticHeaders, getRandomDelay } from '../utils/headers';
import { nieruchomosciRateLimiter } from '../utils/rateLimiter';

const BASE_URL = 'https://www.nieruchomosci-online.pl';

/**
 * Category configuration for nieruchomosci-online.pl
 *
 * URL pattern: /szukaj.html?3,{category},{transaction}
 * - mieszkanie = apartment
 * - dom = house
 * - dzialka = land
 * - lokal = commercial
 * - sprzedaz = sale, wynajem = rent
 */
export interface SearchCategory {
  name: string;
  urlSlug: string;
  propertyCategory: 'apartment' | 'house' | 'land' | 'commercial';
  transactionTypes: Array<{ slug: string; type: 'sale' | 'rent' }>;
}

export const SEARCH_CATEGORIES: SearchCategory[] = [
  {
    name: 'Mieszkanie (Apartment)',
    urlSlug: 'mieszkanie',
    propertyCategory: 'apartment',
    transactionTypes: [
      { slug: 'sprzedaz', type: 'sale' },
      { slug: 'wynajem', type: 'rent' },
    ],
  },
  {
    name: 'Dom (House)',
    urlSlug: 'dom',
    propertyCategory: 'house',
    transactionTypes: [
      { slug: 'sprzedaz', type: 'sale' },
      { slug: 'wynajem', type: 'rent' },
    ],
  },
  {
    name: 'Dzialka (Land)',
    urlSlug: 'dzialka',
    propertyCategory: 'land',
    transactionTypes: [
      { slug: 'sprzedaz', type: 'sale' },
    ],
  },
  {
    name: 'Lokal (Commercial)',
    urlSlug: 'lokal-uzytkowy',
    propertyCategory: 'commercial',
    transactionTypes: [
      { slug: 'sprzedaz', type: 'sale' },
      { slug: 'wynajem', type: 'rent' },
    ],
  },
];

export interface RawListing {
  id: string;
  title: string;
  price: number | null;
  currency: string;
  area: number | null;
  rooms: number | null;
  location: string;
  detailUrl: string;
  imageUrl: string | null;
  propertyCategory: 'apartment' | 'house' | 'land' | 'commercial';
  transactionType: 'sale' | 'rent';
}

/**
 * Fetch all listing pages for a given category and transaction type.
 *
 * Pagination works via the &p=N query parameter. Each page returns ~47 listings.
 * Pages are fetched until an empty page is returned or maxPages is reached.
 */
export async function fetchListingPages(
  category: SearchCategory,
  transactionSlug: string,
  transactionType: 'sale' | 'rent',
  maxPages: number = 3000,
): Promise<RawListing[]> {
  const allListings: RawListing[] = [];
  const seenIds = new Set<string>();
  let page = 1;

  while (page <= maxPages) {
    await nieruchomosciRateLimiter.throttle();
    await new Promise(resolve => setTimeout(resolve, getRandomDelay(300, 700)));

    const url = page === 1
      ? `${BASE_URL}/szukaj.html?3,${category.urlSlug},${transactionSlug}`
      : `${BASE_URL}/szukaj.html?3,${category.urlSlug},${transactionSlug}&p=${page}`;

    try {
      const response = await axios.get(url, {
        headers: getRealisticHeaders(),
        timeout: 30000,
        maxRedirects: 5,
      });

      const $ = cheerio.load(response.data);
      const listings = parseListingPage($, category.propertyCategory, transactionType);

      // Deduplicate and track new listings on this page
      const newListings = listings.filter(l => !seenIds.has(l.id));
      newListings.forEach(l => seenIds.add(l.id));
      allListings.push(...newListings);

      console.log(JSON.stringify({ level: 'info', service: 'nieruchomosci-online-scraper', msg: 'Page fetched', category: category.urlSlug, transaction: transactionSlug, page, found: listings.length, new: newListings.length, total: allListings.length }));

      // Stop if no new listings (end of results or cycling)
      if (newListings.length === 0) break;

      page++;
    } catch (error: any) {
      console.error(JSON.stringify({ level: 'error', service: 'nieruchomosci-online-scraper', msg: 'Failed to fetch page', category: category.urlSlug, transaction: transactionSlug, page, err: error.message, code: error.code }));
      break;
    }
  }

  return allListings;
}

/**
 * Parse a search results page HTML and extract listing data.
 *
 * nieruchomosci-online.pl renders listings via JavaScript. The tile data is
 * embedded in a script variable `NOTrafficEventBuilder.cachedProps.tile_props`.
 * We extract that JSON first; if unavailable we fall back to parsing <a> tags
 * that link to detail pages on city subdomains.
 */
function parseListingPage(
  $: cheerio.CheerioAPI,
  propertyCategory: 'apartment' | 'house' | 'land' | 'commercial',
  transactionType: 'sale' | 'rent',
): RawListing[] {
  const listings: RawListing[] = [];
  const seenIds = new Set<string>();

  // Strategy 1: Extract embedded JSON tile data from <script> tags
  const scripts = $('script').toArray();
  for (const script of scripts) {
    const content = $(script).html() || '';
    if (!content.includes('tile_props')) continue;

    // Find tile_props and extract the balanced JSON object
    const tilePropsIdx = content.indexOf('tile_props');
    if (tilePropsIdx === -1) continue;

    // Find the opening brace after tile_props
    const braceStart = content.indexOf('{', tilePropsIdx);
    if (braceStart === -1) continue;

    // Match balanced braces
    let depth = 0;
    let braceEnd = -1;
    for (let i = braceStart; i < content.length; i++) {
      if (content[i] === '{') depth++;
      else if (content[i] === '}') depth--;
      if (depth === 0) { braceEnd = i; break; }
    }
    if (braceEnd === -1) continue;

    const jsonStr = content.substring(braceStart, braceEnd + 1);

    try {
      const tileProps = JSON.parse(jsonStr);
      for (const [adId, props] of Object.entries(tileProps)) {
        const tileData = props as Record<string, any>;
        // adId format: "a26088950" or "i41579_25465008"
        const numericId = adId.replace(/^[ai]/, '').replace(/_.*/, '');
        if (seenIds.has(numericId)) continue;
        seenIds.add(numericId);

        const city = (tileData.rloccta as string) || '';
        const detailUrl = city
          ? `https://${city}.nieruchomosci-online.pl/${numericId}.html`
          : `${BASE_URL}/${numericId}.html`;

        listings.push({
          id: numericId,
          title: '',
          price: typeof tileData.prc === 'number' ? tileData.prc : null,
          currency: 'PLN',
          area: typeof tileData.rsur === 'number' ? tileData.rsur : null,
          rooms: typeof tileData.rooms === 'number' ? tileData.rooms : null,
          location: city.replace(/-/g, ' '),
          detailUrl,
          imageUrl: null,
          propertyCategory,
          transactionType,
        });
      }
    } catch {
      // JSON parse failed, continue to next strategy
    }
  }

  if (listings.length > 0) return listings;

  // Strategy 2: Extract detail links from <a> tags pointing to city subdomains
  $('a[href*=".nieruchomosci-online.pl/"]').each((_, el) => {
    const $el = $(el);
    const href = $el.attr('href');
    if (!href || !href.includes('.html')) return;
    // Skip non-listing links (szukaj, kontakt, etc.)
    if (href.includes('/szukaj') || href.includes('/kontakt') || href.includes('/pomoc')) return;

    const id = extractIdFromUrl(href);
    if (!id || seenIds.has(id)) return;
    seenIds.add(id);

    listings.push({
      id,
      title: $el.text().trim() || $el.attr('title') || '',
      price: null,
      currency: 'PLN',
      area: null,
      rooms: null,
      location: '',
      detailUrl: href,
      imageUrl: null,
      propertyCategory,
      transactionType,
    });
  });

  return listings;
}

function extractIdFromUrl(url: string): string | null {
  // Try to extract numeric ID from URL path
  const match = url.match(/(\d{4,})/);
  return match ? match[1] : null;
}


/**
 * Fetch all listings for all categories
 */
export async function fetchAllCategories(categories?: string[]): Promise<RawListing[]> {
  const allListings: RawListing[] = [];

  for (const category of SEARCH_CATEGORIES) {
    if (categories && !categories.includes(category.urlSlug)) continue;

    for (const tx of category.transactionTypes) {
      console.log(JSON.stringify({ level: 'info', service: 'nieruchomosci-online-scraper', msg: 'Starting category', category: category.name, transaction: tx.slug }));

      const listings = await fetchListingPages(category, tx.slug, tx.type);
      allListings.push(...listings);

      console.log(JSON.stringify({ level: 'info', service: 'nieruchomosci-online-scraper', msg: 'Category complete', category: category.name, transaction: tx.slug, count: listings.length }));
    }
  }

  return allListings;
}
