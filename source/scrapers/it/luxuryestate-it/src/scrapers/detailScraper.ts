/**
 * LuxuryEstate.com Detail Scraper (Phase 3)
 *
 * Fetches an individual listing detail page and extracts the
 * schema.org JSON-LD structured data embedded in the HTML.
 */

import axios, { AxiosInstance } from 'axios';
import * as cheerio from 'cheerio';
import {
  LuxuryEstateListing,
  LuxuryEstateJsonLd,
  LuxuryEstateMinimalListing,
  TransactionType,
  PropertyCategory,
} from '../types/luxuryEstateTypes';
import { randomUserAgent } from '../utils/userAgents';

const BASE_URL = 'https://www.luxuryestate.com';
const REQUEST_TIMEOUT_MS = 30000;

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Detect property category from JSON-LD @type and content hints.
 */
function detectCategory(jsonLd: LuxuryEstateJsonLd, url: string): PropertyCategory {
  const types = Array.isArray(jsonLd['@type'])
    ? jsonLd['@type'].map(t => t.toLowerCase())
    : [String(jsonLd['@type'] || '').toLowerCase()];

  if (
    types.some(t =>
      t.includes('singlefamilyresidence') ||
      t.includes('house') ||
      t.includes('villa') ||
      t.includes('residence')
    )
  ) {
    return 'house';
  }

  if (types.some(t => t.includes('apartment'))) {
    return 'apartment';
  }

  // Fallback: inspect name/description/URL for keywords
  const text = [jsonLd.name, jsonLd.description, jsonLd.keywords, url].join(' ').toLowerCase();
  if (
    text.includes('villa') ||
    text.includes('casa') ||
    text.includes('chalet') ||
    text.includes('farmhouse') ||
    text.includes('casale') ||
    text.includes('rustico') ||
    text.includes('masseria')
  ) {
    return 'house';
  }

  // URL path hints
  const urlLower = url.toLowerCase();
  if (urlLower.includes('/villa') || urlLower.includes('/house')) return 'house';
  if (urlLower.includes('/apartment')) return 'apartment';

  // Default to apartment for luxury flats/penthouses
  return 'apartment';
}

/**
 * Detect transaction type from JSON-LD and URL.
 */
function detectTransactionType(jsonLd: LuxuryEstateJsonLd, url: string): TransactionType {
  const urlLower = url.toLowerCase();
  // LuxuryEstate slugs: /p{ID}-apartment-for-rent-rome  or  /rent/apartments-italy
  if (
    urlLower.includes('/for-rent') ||
    urlLower.includes('/affitto/') ||
    urlLower.includes('-for-rent-') ||
    urlLower.includes('/rent/')
  ) {
    return 'rent';
  }

  const offer = Array.isArray(jsonLd.offers)
    ? jsonLd.offers[0]
    : jsonLd.offers;

  if (offer?.priceValidUntil) return 'rent';

  // Default luxury listings to sale
  return 'sale';
}

/**
 * Extract all schema.org JSON-LD blocks from page HTML.
 * Returns the first one that looks like a real estate listing.
 *
 * LuxuryEstate detail pages use a single JSON-LD block with an @graph array:
 *   { "@graph": [
 *       { "@type": "RealEstateListing", ..., "mainEntity": { "@type": "Apartment", ... }, "offers": {...} },
 *       { "@type": "BreadcrumbList", ... }
 *   ] }
 *
 * We need to:
 *   1. Find the RealEstateListing item in @graph
 *   2. Merge its mainEntity (which holds floorSize, numberOfRooms, address, amenityFeature)
 *      with the top-level offers and metadata into a flat LuxuryEstateJsonLd.
 */
function extractJsonLd(html: string): LuxuryEstateJsonLd | null {
  const $ = cheerio.load(html);
  const scripts = $('script[type="application/ld+json"]');

  const candidates: LuxuryEstateJsonLd[] = [];

  scripts.each((_i, el) => {
    try {
      const text = $(el).html() || '';
      const parsed = JSON.parse(text);

      // Collect all items to inspect (handles @graph, arrays, and plain objects)
      let items: any[] = [];
      if (Array.isArray(parsed)) {
        items = parsed;
      } else if (parsed['@graph']) {
        items = parsed['@graph'];
      } else {
        items = [parsed];
      }

      for (const item of items) {
        if (!item || typeof item !== 'object') continue;
        const type = String(item['@type'] || '').toLowerCase();

        if (type === 'realestatelisting') {
          // LuxuryEstate pattern: property data lives in mainEntity
          // Flatten mainEntity fields up into the listing object so the
          // rest of the code (which expects a flat LuxuryEstateJsonLd) works.
          const mainEntity: any = item.mainEntity ?? {};
          const merged: LuxuryEstateJsonLd = {
            '@context': item['@context'] ?? 'https://schema.org',
            '@type': mainEntity['@type'] ?? item['@type'],
            name: mainEntity.name ?? item.name,
            description: mainEntity.description ?? item.description,
            url: item.url,
            offers: item.offers,
            address: mainEntity.address,
            image: mainEntity.image,
            numberOfRooms: mainEntity.numberOfRooms,
            floorSize: mainEntity.floorSize,
            lotSize: mainEntity.lotSize,
            amenityFeature: mainEntity.amenityFeature,
            yearBuilt: mainEntity.yearBuilt,
            numberOfFloors: mainEntity.numberOfFloors,
            floorLevel: mainEntity.floorLevel,
            // Extract bedrooms/bathrooms from amenityFeature if not top-level
            numberOfBedrooms: mainEntity.numberOfBedrooms ?? extractAmenity(mainEntity.amenityFeature, 'Bedrooms'),
            numberOfBathroomsTotal: mainEntity.numberOfBathroomsTotal ?? extractAmenity(mainEntity.amenityFeature, 'Bathrooms'),
            datePublished: item.datePosted,
            geo: mainEntity.geo,
            keywords: mainEntity.keywords,
            identifier: mainEntity.identifier,
          };
          candidates.push(merged);
          continue;
        }

        // Accept direct property type items (older/alternative page variants)
        if (
          type.includes('apartment') ||
          type.includes('singlefamilyresidence') ||
          type.includes('house') ||
          type.includes('villa') ||
          type.includes('product') ||
          (item.offers && (item.floorSize || item.numberOfRooms || item.address))
        ) {
          candidates.push(item as LuxuryEstateJsonLd);
        }
      }
    } catch {
      // Ignore parse errors for individual script blocks
    }
  });

  if (candidates.length === 0) return null;

  // Prefer the most specific/informative type
  const priority = ['apartment', 'singlefamilyresidence', 'house', 'villa', 'realestatelisting'];
  for (const p of priority) {
    const match = candidates.find(c => {
      const t = String(c['@type'] || '').toLowerCase();
      return t.includes(p);
    });
    if (match) return match;
  }

  return candidates[0];
}

/**
 * Extract a numeric value from schema.org amenityFeature array by name.
 * e.g. [{ "@type": "LocationFeatureSpecification", "name": "Bedrooms", "value": 2 }]
 */
function extractAmenity(
  amenities: Array<{ name?: string; value?: boolean | string | number }> | undefined,
  name: string
): number | undefined {
  if (!Array.isArray(amenities)) return undefined;
  const item = amenities.find(a => String(a.name ?? '').toLowerCase() === name.toLowerCase());
  if (!item) return undefined;
  const v = Number(item.value);
  return isNaN(v) ? undefined : v;
}

export class DetailScraper {
  private client: AxiosInstance;
  private delayMs: number;

  constructor(delayMs = 500) {
    this.delayMs = delayMs;
    this.client = axios.create({
      timeout: REQUEST_TIMEOUT_MS,
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,it;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Referer': BASE_URL,
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Upgrade-Insecure-Requests': '1',
      },
    });
  }

  /**
   * Fetch a single detail page and extract structured data.
   */
  async fetchDetail(minimal: LuxuryEstateMinimalListing): Promise<LuxuryEstateListing | null> {
    await delay(this.delayMs);

    try {
      const response = await this.client.get<string>(minimal.url, {
        headers: { 'User-Agent': randomUserAgent() },
        responseType: 'text',
      });

      const html = response.data as string;
      const jsonLd = extractJsonLd(html);

      if (!jsonLd) {
        console.warn(JSON.stringify({
          level: 'warn',
          service: 'luxuryestate-scraper',
          msg: 'No JSON-LD found on detail page',
          id: minimal.id,
          url: minimal.url,
        }));
        return null;
      }

      const transactionType = detectTransactionType(jsonLd, minimal.url);
      const propertyCategory = detectCategory(jsonLd, minimal.url);

      // Use category hint from Phase 1 if JSON-LD type is generic
      const schemaType = String(jsonLd['@type'] || '').toLowerCase();
      const finalCategory: PropertyCategory =
        (minimal.categoryHint && schemaType === 'product')
          ? (minimal.categoryHint as PropertyCategory)
          : propertyCategory;

      return {
        id: minimal.id,
        url: minimal.url,
        jsonLd,
        transactionType: minimal.transactionHint || transactionType,
        propertyCategory: finalCategory,
      };
    } catch (err: any) {
      console.error(JSON.stringify({
        level: 'error',
        service: 'luxuryestate-scraper',
        msg: 'Failed to fetch detail page',
        id: minimal.id,
        url: minimal.url,
        err: err.message,
        status: err.response?.status,
      }));
      return null;
    }
  }
}
