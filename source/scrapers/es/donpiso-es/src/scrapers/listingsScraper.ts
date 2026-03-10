import axios from 'axios';
import * as cheerio from 'cheerio';
import { DonpisoListingRaw } from '../types/donpisoTypes';
import { getRealisticHeaders, getRandomDelay } from '../utils/headers';
import { donpisoRateLimiter } from '../utils/rateLimiter';
import {
  extractPortalId,
  buildSaleUrl,
  buildRentUrl,
  DONPISO_PROVINCES,
} from '../utils/donpisoHelpers';
import {
  detectCategoryFromTitle,
  detectTransactionType,
  extractPropertyTypeSlug,
} from '../utils/categoryDetection';
import { parseSpanishPrice } from '../../../shared/spanish-value-mappings';

const BASE_URL = 'https://www.donpiso.com';
const MAX_PAGES = 50;

export interface SearchSegment {
  provinceSlug: string;
  transactionType: 'sale' | 'rent';
  label: string;
}

export function getAllSearchSegments(): SearchSegment[] {
  const segments: SearchSegment[] = [];
  for (const province of DONPISO_PROVINCES) {
    segments.push({
      provinceSlug: province.slug,
      transactionType: 'sale',
      label: `${province.name} sale`,
    });
    segments.push({
      provinceSlug: province.slug,
      transactionType: 'rent',
      label: `${province.name} rent`,
    });
  }
  return segments;
}

/**
 * Parse JSON-LD structured data from a cheerio-loaded page.
 * Donpiso embeds RealEstateListing schema objects in listing pages.
 */
function parseJsonLdListings(
  $: cheerio.CheerioAPI,
  provinceSlug: string,
  transactionType: 'sale' | 'rent'
): DonpisoListingRaw[] {
  const listings: DonpisoListingRaw[] = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const rawText = $(el).html() || '';
      const data = JSON.parse(rawText);

      // Handle both single object and array
      const items: any[] = Array.isArray(data) ? data : [data];

      for (const item of items) {
        // Top-level RealEstateListing
        if (item['@type'] === 'RealEstateListing') {
          const listing = parseJsonLdItem(item, provinceSlug, transactionType);
          if (listing) listings.push(listing);
        }

        // Nested in ItemList
        if (item['@type'] === 'ItemList' && Array.isArray(item.itemListElement)) {
          for (const listItem of item.itemListElement) {
            const inner = listItem.item || listItem;
            if (inner['@type'] === 'RealEstateListing') {
              const listing = parseJsonLdItem(inner, provinceSlug, transactionType);
              if (listing) listings.push(listing);
            }
          }
        }

        // Graph
        if (item['@graph']) {
          for (const node of item['@graph']) {
            if (node['@type'] === 'RealEstateListing') {
              const listing = parseJsonLdItem(node, provinceSlug, transactionType);
              if (listing) listings.push(listing);
            }
          }
        }
      }
    } catch {
      // Ignore parse errors
    }
  });

  return listings;
}

function parseJsonLdItem(
  item: any,
  provinceSlug: string,
  transactionType: 'sale' | 'rent'
): DonpisoListingRaw | null {
  const url: string = item.url || '';
  if (!url) return null;

  const portalId = extractPortalId(url);
  if (!portalId) return null;

  const title: string = item.name || '';
  const description: string | null = item.description || null;
  const imageUrl: string | null = item.image || null;

  // Parse price from offers
  let price: number | null = null;
  const offers = item.offers || item.offer;
  if (offers) {
    const priceStr = offers.price || offers.lowPrice;
    if (priceStr) {
      price = parseSpanishPrice(String(priceStr));
    }
  }

  const propertyTypeSlug = extractPropertyTypeSlug(title);

  return {
    portalId,
    detailUrl: url,
    title,
    price,
    description,
    imageUrl,
    propertyTypeSlug,
    transactionType,
    provinceSlug,
  };
}

/**
 * Fallback: parse listings from HTML cards if JSON-LD is insufficient
 */
function parseHtmlListings(
  $: cheerio.CheerioAPI,
  provinceSlug: string,
  transactionType: 'sale' | 'rent'
): DonpisoListingRaw[] {
  const listings: DonpisoListingRaw[] = [];

  // Try common donpiso listing card selectors
  const cardSelectors = [
    '.property-card',
    '.inmueble',
    '.listing-item',
    '.property-item',
    'article.property',
    '.card-inmueble',
    '[class*="property"]',
    '[class*="inmueble"]',
  ];

  let $cards = $();
  for (const sel of cardSelectors) {
    $cards = $(sel);
    if ($cards.length > 0) break;
  }

  $cards.each((_, el) => {
    const $el = $(el);

    // Try to find URL
    const link = $el.find('a[href*="/pisos-y-casas/"]').first();
    const detailUrl = link.attr('href') || '';
    if (!detailUrl) return;

    const fullUrl = detailUrl.startsWith('http') ? detailUrl : `${BASE_URL}${detailUrl}`;
    const portalId = extractPortalId(fullUrl);
    if (!portalId) return;

    const title = $el.find('h2, h3, .title, [class*="title"]').first().text().trim() ||
                  link.attr('title') || '';

    const priceText = $el.find('[class*="price"], [class*="precio"]').first().text().trim();
    const price = parseSpanishPrice(priceText);

    const description = $el.find('p, [class*="desc"]').first().text().trim() || null;
    const imageUrl = $el.find('img').first().attr('src') ||
                     $el.find('img').first().attr('data-src') || null;

    const propertyTypeSlug = extractPropertyTypeSlug(title);

    listings.push({
      portalId,
      detailUrl: fullUrl,
      title,
      price,
      description,
      imageUrl,
      propertyTypeSlug,
      transactionType,
      provinceSlug,
    });
  });

  return listings;
}

/**
 * Fetch a single search results page and parse listings
 */
export async function fetchSearchPage(
  segment: SearchSegment,
  page: number
): Promise<{ listings: DonpisoListingRaw[]; hasNextPage: boolean; totalResults: number }> {
  await donpisoRateLimiter.throttle();
  await new Promise(resolve => setTimeout(resolve, getRandomDelay(300, 800)));

  const url = segment.transactionType === 'sale'
    ? buildSaleUrl(segment.provinceSlug, page)
    : buildRentUrl(segment.provinceSlug, page);

  const headers = getRealisticHeaders(
    page > 1 ? (segment.transactionType === 'sale'
      ? buildSaleUrl(segment.provinceSlug, page - 1)
      : buildRentUrl(segment.provinceSlug, page - 1)) : undefined
  );

  let response;
  try {
    response = await axios.get(url, {
      headers,
      timeout: 30000,
      validateStatus: (status) => status < 500,
    });
  } catch (error: any) {
    console.error(JSON.stringify({
      level: 'error', service: 'donpiso-scraper',
      msg: 'Request failed', url, err: error.message,
    }));
    return { listings: [], hasNextPage: false, totalResults: 0 };
  }

  if (response.status === 404 || response.status === 301 || response.status === 302) {
    return { listings: [], hasNextPage: false, totalResults: 0 };
  }

  const $ = cheerio.load(response.data);

  // Parse total results from page text
  let totalResults = 0;
  const bodyText = $('body').text();
  const totalMatch = bodyText.match(/(\d+)\s+(?:inmuebles?|propiedades?|resultado)/i);
  if (totalMatch) {
    totalResults = parseInt(totalMatch[1], 10);
  }

  // Parse total pages
  let totalPages = 1;
  const pagesMatch = bodyText.match(/(?:pág?\.?\s+\d+\s+de\s+|page\s+\d+\s+of\s+)(\d+)/i);
  if (pagesMatch) {
    totalPages = parseInt(pagesMatch[1], 10);
  } else if (totalResults > 0) {
    // Estimate: ~10 listings per page
    totalPages = Math.ceil(totalResults / 10);
  }

  // Primary: extract from JSON-LD
  let listings = parseJsonLdListings($, segment.provinceSlug, segment.transactionType);

  // Fallback: HTML parsing if JSON-LD yields nothing
  if (listings.length === 0) {
    listings = parseHtmlListings($, segment.provinceSlug, segment.transactionType);
  }

  const hasNextPage = listings.length > 0 && page < Math.min(totalPages, MAX_PAGES);

  return { listings, hasNextPage, totalResults };
}

/**
 * Fetch all pages for a search segment
 */
export async function fetchAllSearchPages(
  segment: SearchSegment
): Promise<DonpisoListingRaw[]> {
  const allListings: DonpisoListingRaw[] = [];
  const seenIds = new Set<string>();

  for (let page = 1; page <= MAX_PAGES; page++) {
    const { listings, hasNextPage } = await fetchSearchPage(segment, page);

    // Dedup by portalId
    const newListings = listings.filter(l => !seenIds.has(l.portalId));
    for (const l of newListings) {
      seenIds.add(l.portalId);
      allListings.push(l);
    }

    // Stop if no new listings (handles infinite pagination cycles)
    if (newListings.length === 0 || !hasNextPage) break;
  }

  return allListings;
}
