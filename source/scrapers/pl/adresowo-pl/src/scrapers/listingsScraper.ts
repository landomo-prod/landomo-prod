import axios from 'axios';
import * as cheerio from 'cheerio';
import { getRealisticHeaders, getRandomDelay } from '../utils/headers';
import { adresowoRateLimiter } from '../utils/rateLimiter';

/**
 * Adresowo.pl listing data extracted from search result pages.
 * The site uses server-side rendered HTML, no JSON API.
 *
 * URL patterns:
 *   /mieszkania/warszawa/       - apartments in Warsaw, page 1
 *   /mieszkania/warszawa/_l2    - apartments in Warsaw, page 2
 *   /domy/krakow/_l3            - houses in Krakow, page 3
 *   /dzialki/                   - land (all Poland)
 *   /lokale/                    - commercial (all Poland)
 *
 * Listing detail URLs:
 *   /o/mieszkanie-warszawa-zoliborz-ul-xyz-3-pokojowe-l1a2u2
 */

export interface AdresowoListingSummary {
  portalId: string;       // extracted from URL slug (e.g., "l1a2u2")
  url: string;            // relative URL like /o/mieszkanie-...
  title: string;
  price: number | null;
  currency: string;
  area: number | null;    // sqm
  rooms: number | null;
  floor: number | null;
  location: string;       // address text from the card
  imageUrl: string | null;
  categorySlug: string;   // 'mieszkania' | 'domy' | 'dzialki' | 'nieruchomosci-komercyjne'
}

// Category slug → property_category mapping
const CATEGORY_MAP: Record<string, string> = {
  'mieszkania': 'apartment',
  'domy': 'house',
  'dzialki': 'land',
  'nieruchomosci-komercyjne': 'commercial',
};

// Transaction type mapping (from URL paths)
const TRANSACTION_SLUGS: Record<string, { slug: string; type: 'sale' | 'rent' }[]> = {
  'mieszkania': [
    { slug: 'mieszkania', type: 'sale' },
    { slug: 'mieszkania-wynajem', type: 'rent' },      // was: mieszkania-do-wynajecia (404)
  ],
  'domy': [
    { slug: 'domy', type: 'sale' },
    { slug: 'domy-wynajem', type: 'rent' },             // was: domy-do-wynajecia (404)
  ],
  'dzialki': [
    { slug: 'dzialki', type: 'sale' },
  ],
  'nieruchomosci-komercyjne': [
    { slug: 'nieruchomosci-komercyjne', type: 'sale' },           // was: lokale (404)
    { slug: 'nieruchomosci-komercyjne-wynajem', type: 'rent' },   // was: lokale-do-wynajecia (404)
  ],
};

export interface CategoryScrapeConfig {
  categorySlug: string;   // e.g., 'mieszkania'
  transactionSlug: string; // e.g., 'mieszkania' or 'mieszkania-do-wynajecia'
  transactionType: 'sale' | 'rent';
  propertyCategory: string; // 'apartment' | 'house' | 'land' | 'commercial'
}

export function getAllCategoryConfigs(): CategoryScrapeConfig[] {
  const configs: CategoryScrapeConfig[] = [];
  for (const [categorySlug, transactions] of Object.entries(TRANSACTION_SLUGS)) {
    for (const txn of transactions) {
      configs.push({
        categorySlug,
        transactionSlug: txn.slug,
        transactionType: txn.type,
        propertyCategory: CATEGORY_MAP[categorySlug],
      });
    }
  }
  return configs;
}

const BASE_URL = 'https://www.adresowo.pl';

/**
 * Fetch a single search results page and parse listing cards.
 */
async function fetchSearchPage(slug: string, page: number): Promise<{ listings: AdresowoListingSummary[]; hasNext: boolean }> {
  const url = page === 1 ? `${BASE_URL}/${slug}/` : `${BASE_URL}/${slug}/_l${page}`;

  await adresowoRateLimiter.throttle();
  await new Promise(resolve => setTimeout(resolve, getRandomDelay(200, 800)));

  const headers = getRealisticHeaders();
  const response = await axios.get(url, {
    headers,
    timeout: 30000,
    validateStatus: (status) => status < 500,
  });

  if (response.status === 404) {
    return { listings: [], hasNext: false };
  }

  if (response.status !== 200) {
    console.error(JSON.stringify({ level: 'error', service: 'adresowo-scraper', msg: 'Non-200 response', url, status: response.status }));
    return { listings: [], hasNext: false };
  }

  const $ = cheerio.load(response.data);
  const listings: AdresowoListingSummary[] = [];

  // Parse listing cards - adresowo uses anchor links to /o/ detail pages
  $('a[href^="/o/"]').each((_, el) => {
    try {
      const $el = $(el);
      const href = $el.attr('href') || '';

      // Extract portal ID from the URL slug (last segment after last dash)
      const slugMatch = href.match(/-([a-z0-9]+)$/i);
      if (!slugMatch) return;
      const portalId = slugMatch[1];

      // Get text content for parsing
      const text = $el.text().trim();
      if (!text) return;

      // Extract price (pattern: "123 456 zl" or "123 456 PLN")
      const priceMatch = text.match(/([\d\s]+)\s*(?:zł|PLN)/i);
      const price = priceMatch ? parseInt(priceMatch[1].replace(/\s/g, ''), 10) : null;

      // Extract area (pattern: "57 m²" or "57m2")
      const areaMatch = text.match(/([\d,\.]+)\s*m[²2]/i);
      const area = areaMatch ? parseFloat(areaMatch[1].replace(',', '.')) : null;

      // Extract rooms (pattern: "3 pok." or "3-pokojowe")
      const roomsMatch = text.match(/(\d+)\s*pok/i);
      const rooms = roomsMatch ? parseInt(roomsMatch[1], 10) : null;

      // Extract floor (pattern: "piętro 3" or "3/5 piętro")
      const floorMatch = text.match(/(?:piętro|piętr[oa])\s*(\d+)|(\d+)\s*\/\s*\d+\s*(?:piętro|piętr)/i);
      const floor = floorMatch ? parseInt(floorMatch[1] || floorMatch[2], 10) : null;

      // Get title from alt text of image or the link text
      const img = $el.find('img');
      const title = img.attr('alt') || text.split('\n')[0].trim().substring(0, 200);

      const imageUrl = img.attr('src') || img.attr('data-src') || null;

      // Determine category from the URL slug
      const categorySlug = slug.split('/')[0] || 'mieszkania';

      listings.push({
        portalId: `adresowo-${portalId}`,
        url: href,
        title,
        price,
        currency: 'PLN',
        area,
        rooms,
        floor,
        location: '', // will be enriched from detail page
        imageUrl,
        categorySlug,
      });
    } catch (err) {
      // Skip malformed cards
    }
  });

  // Check for next page link
  const hasNext = $('a[href*="/_l"]').filter((_, el) => {
    const href = $(el).attr('href') || '';
    const nextPage = `_l${page + 1}`;
    return href.includes(nextPage);
  }).length > 0;

  return { listings, hasNext };
}

/**
 * Fetch all listing pages for a category/transaction combination.
 * Returns deduplicated listing summaries.
 */
export async function fetchAllListingPages(
  config: CategoryScrapeConfig,
  maxPages: number = 3000
): Promise<AdresowoListingSummary[]> {
  const allListings: AdresowoListingSummary[] = [];
  const seenIds = new Set<string>();

  let page = 1;
  let hasNext = true;

  while (hasNext && page <= maxPages) {
    try {
      const result = await fetchSearchPage(config.transactionSlug, page);

      for (const listing of result.listings) {
        if (!seenIds.has(listing.portalId)) {
          seenIds.add(listing.portalId);
          allListings.push(listing);
        }
      }

      hasNext = result.hasNext;

      if (result.listings.length === 0) {
        // No listings on this page, stop pagination
        break;
      }

      console.log(JSON.stringify({
        level: 'info',
        service: 'adresowo-scraper',
        msg: 'Page fetched',
        slug: config.transactionSlug,
        page,
        listingsOnPage: result.listings.length,
        totalSoFar: allListings.length,
      }));

      page++;
    } catch (error: any) {
      console.error(JSON.stringify({
        level: 'error',
        service: 'adresowo-scraper',
        msg: 'Failed to fetch page',
        slug: config.transactionSlug,
        page,
        err: error.message,
      }));
      // Stop on error to avoid hammering
      break;
    }
  }

  return allListings;
}
