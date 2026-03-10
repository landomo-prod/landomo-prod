import axios from 'axios';
import * as cheerio from 'cheerio';
import pLimit from 'p-limit';
import { getRandomUserAgent } from '../utils/userAgents';

const BASE_URL = 'https://fasteignir.visir.is';
const SEARCH_DELAY_MS = parseInt(process.env.SEARCH_DELAY_MS || '500', 10);
const DETAIL_DELAY_MS = parseInt(process.env.DETAIL_DELAY_MS || '200', 10);
const DETAIL_CONCURRENCY = parseInt(process.env.DETAIL_CONCURRENCY || '5', 10);

export type PropertyCategory = 'apartment' | 'house' | 'land' | 'commercial';
export type ListingType = 'sale' | 'rental';

export interface RawProperty {
  id: string;
  listingType: ListingType;
  propertyTypeRaw: string;
  category: PropertyCategory;
  address: string;
  city: string;
  zipCode: string;
  price: number | null;
  sqm: number | null;
  sqmPlot: number | null;
  rooms: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  yearBuilt: number | null;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
  fasteignanumer: string | null;
  hasElevator: boolean;
  hasBalcony: boolean;
  hasParking: boolean;
  hasGarage: boolean;
  hasGarden: boolean;
}

function mapCategory(typeText: string): PropertyCategory {
  const t = typeText.toLowerCase().trim();
  if (
    t.includes('fjölbýl') ||
    t.includes('íbúð') ||
    t === 'fjölbýlishús'
  ) return 'apartment';
  if (
    t.includes('einbýl') ||
    t.includes('raðhús') ||
    t.includes('parhús') ||
    t.includes('sumarbústaður')
  ) return 'house';
  if (t.includes('lóð') || t.includes('land')) return 'land';
  if (t.includes('atvinnuhúsnæði') || t.includes('verslun')) return 'commercial';
  // Default unknown types to apartment (most common)
  return 'apartment';
}

function parsePrice(text: string): number | null {
  // "25.900.000 kr." → 25900000
  const cleaned = text.replace(/[^\d]/g, '');
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? null : num;
}

function parseSqm(text: string): number | null {
  // "58 m²" → 58
  const match = text.match(/(\d+[\.,]?\d*)\s*m/i);
  if (!match) return null;
  return parseFloat(match[1].replace(',', '.'));
}

function parseNumber(text: string): number | null {
  const match = text.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function makeHeaders() {
  return {
    'User-Agent': getRandomUserAgent(),
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'is-IS,is;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    Referer: 'https://fasteignir.visir.is/',
  };
}

/**
 * Extract property IDs from a search results page
 */
function extractIdsFromPage(html: string): string[] {
  const $ = cheerio.load(html);
  const ids = new Set<string>();

  // Look for links like /property/123456
  $('a[href]').each((_i, el) => {
    const href = $(el).attr('href') || '';
    const match = href.match(/\/property\/(\d+)/);
    if (match) ids.add(match[1]);
  });

  return Array.from(ids);
}

/**
 * Fetch all property IDs from search results (all pages)
 */
async function fetchAllIds(listingType: ListingType): Promise<string[]> {
  const stype = listingType === 'sale' ? 'sale' : 'rental';
  const allIds = new Set<string>();
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const url = `${BASE_URL}/search/results/?stype=${stype}&page=${page}`;

    try {
      const response = await axios.get<string>(url, {
        headers: makeHeaders(),
        timeout: 30000,
      });

      const html = response.data;
      const ids = extractIdsFromPage(html);

      if (ids.length === 0) {
        console.log(JSON.stringify({
          level: 'info',
          service: 'fasteignir-scraper',
          msg: 'No more IDs found, stopping pagination',
          listingType,
          page,
        }));
        hasMore = false;
        break;
      }

      const prevSize = allIds.size;
      ids.forEach(id => allIds.add(id));

      // If we didn't add any new IDs, we've cycled back
      if (allIds.size === prevSize && page > 1) {
        console.log(JSON.stringify({
          level: 'info',
          service: 'fasteignir-scraper',
          msg: 'No new IDs on page, stopping',
          listingType,
          page,
        }));
        hasMore = false;
        break;
      }

      console.log(JSON.stringify({
        level: 'info',
        service: 'fasteignir-scraper',
        msg: 'Fetched search page',
        listingType,
        page,
        newIds: ids.length,
        totalIds: allIds.size,
      }));

      // Check if there's a next page indicator
      const $ = cheerio.load(html);
      const hasNextPage =
        $('a[href*="page=' + (page + 1) + '"]').length > 0 ||
        $('.pagination .next').length > 0 ||
        $('[rel="next"]').length > 0;

      if (!hasNextPage && page > 1) {
        hasMore = false;
      }

      page++;
      await sleep(SEARCH_DELAY_MS);
    } catch (err: any) {
      console.error(JSON.stringify({
        level: 'error',
        service: 'fasteignir-scraper',
        msg: 'Failed to fetch search page',
        listingType,
        page,
        err: err.message,
      }));
      hasMore = false;
    }
  }

  return Array.from(allIds);
}

/**
 * Parse a property detail page into a RawProperty
 */
function parseDetailPage(html: string, id: string, listingType: ListingType): RawProperty | null {
  try {
    const $ = cheerio.load(html);
    const fullText = $('body').text();

    // --- Address ---
    // Look for address in h1 or h2 or strong heading
    let address = '';
    let city = '';
    let zipCode = '';

    // Try common patterns: "Valshlíð 1" then "102 Reykjavík"
    $('h1, h2, h3').each((_i, el) => {
      const text = $(el).text().trim();
      if (!address && text && text.length < 80 && !text.includes('kr.') && !text.match(/^\d+\s*m/)) {
        address = text;
      }
    });

    // ZIP + city pattern: "102 Reykjavík"
    const zipCityMatch = fullText.match(/(\d{3})\s+([A-Za-zÀ-öø-ÿ][A-Za-zÀ-öø-ÿ\s-]+)/);
    if (zipCityMatch) {
      zipCode = zipCityMatch[1];
      city = zipCityMatch[2].trim().split('\n')[0].trim();
    }

    // --- Price ---
    let price: number | null = null;
    const priceMatch = fullText.match(/([\d,.]+)\s*kr\./);
    if (priceMatch) {
      price = parsePrice(priceMatch[1]);
    }

    // --- Property type ---
    let propertyTypeRaw = '';
    // Look for known Icelandic property type terms
    const typeTerms = [
      'Fjölbýlishús', 'Fjölbýli', 'Íbúð',
      'Einbýlishús', 'Einbýli', 'Raðhús', 'Parhús', 'Raðhús/Parhús', 'Sumarbústaður',
      'Lóð', 'Lóðarland',
      'Atvinnuhúsnæði', 'Verslun',
    ];
    for (const term of typeTerms) {
      if (fullText.includes(term)) {
        propertyTypeRaw = term;
        break;
      }
    }

    // --- Size ---
    let sqm: number | null = null;
    const sqmMatch = fullText.match(/(\d+[\.,]?\d*)\s*m²/);
    if (sqmMatch) sqm = parseSqm(sqmMatch[0]);

    // --- Fasteignanúmer ---
    let fasteignanumer: string | null = null;
    const fasteigMatch = fullText.match(/F\d{7}/);
    if (fasteigMatch) fasteignanumer = fasteigMatch[0];

    // --- Rooms ---
    // "2 herb." = rooms, "1 baðherb." = bathrooms, "1 svefnh." = bedrooms
    let rooms: number | null = null;
    let bathrooms: number | null = null;
    let bedrooms: number | null = null;

    const roomsMatch = fullText.match(/(\d+)\s*herb\./);
    if (roomsMatch) rooms = parseInt(roomsMatch[1], 10);

    const bathMatch = fullText.match(/(\d+)\s*baðherb\./);
    if (bathMatch) bathrooms = parseInt(bathMatch[1], 10);

    const bedroomsMatch = fullText.match(/(\d+)\s*svefnh\./);
    if (bedroomsMatch) bedrooms = parseInt(bedroomsMatch[1], 10);

    // If no explicit bedrooms but we have rooms, estimate
    if (bedrooms === null && rooms !== null && rooms > 1) {
      bedrooms = rooms - 1;
    }

    // --- Year built ---
    let yearBuilt: number | null = null;
    const yearMatch = fullText.match(/Byggt\s+(\d{4})/);
    if (yearMatch) yearBuilt = parseInt(yearMatch[1], 10);

    // --- Features ---
    const lowerText = fullText.toLowerCase();
    const hasElevator = lowerText.includes('lyfta');
    const hasBalcony = lowerText.includes('svalir') || lowerText.includes('svalir/verönd');
    const hasGarage = lowerText.includes('bilskur') || lowerText.includes('bílskúr');
    const hasGarden = lowerText.includes('garður') || lowerText.includes('gardur');
    const hasParking = lowerText.includes('bílastæð') || lowerText.includes('bilastæð') || hasGarage;

    // --- Coordinates ---
    let latitude: number | null = null;
    let longitude: number | null = null;

    // Map link: https://ja.is/kort/?lat=64.xxx&lon=-21.xxx
    const mapMatch = html.match(/lat=([-\d.]+)&(?:amp;)?lon=([-\d.]+)/);
    if (mapMatch) {
      latitude = parseFloat(mapMatch[1]);
      longitude = parseFloat(mapMatch[2]);
    }

    // --- Description ---
    let description: string | null = null;
    const descParagraphs: string[] = [];
    $('p').each((_i, el) => {
      const text = $(el).text().trim();
      if (text.length > 50) {
        descParagraphs.push(text);
      }
    });
    if (descParagraphs.length > 0) {
      description = descParagraphs.join('\n\n').substring(0, 5000);
    }

    const category = mapCategory(propertyTypeRaw);

    // Plot size for land/houses
    let sqmPlot: number | null = null;
    const plotMatch = fullText.match(/lóð[^0-9]*(\d+[\.,]?\d*)\s*m²/i);
    if (plotMatch) sqmPlot = parseFloat(plotMatch[1].replace(',', '.'));

    return {
      id,
      listingType,
      propertyTypeRaw,
      category,
      address,
      city,
      zipCode,
      price,
      sqm,
      sqmPlot,
      rooms,
      bedrooms,
      bathrooms,
      yearBuilt,
      description,
      latitude,
      longitude,
      fasteignanumer,
      hasElevator,
      hasBalcony,
      hasParking,
      hasGarage,
      hasGarden,
    };
  } catch (err: any) {
    console.error(JSON.stringify({
      level: 'error',
      service: 'fasteignir-scraper',
      msg: 'Failed to parse detail page',
      id,
      err: err.message,
    }));
    return null;
  }
}

/**
 * Fetch a single property detail page
 */
async function fetchPropertyDetail(id: string, listingType: ListingType): Promise<RawProperty | null> {
  const url = `${BASE_URL}/property/${id}`;
  try {
    const response = await axios.get<string>(url, {
      headers: makeHeaders(),
      timeout: 30000,
    });
    return parseDetailPage(response.data, id, listingType);
  } catch (err: any) {
    if (err.response?.status === 404) {
      console.log(JSON.stringify({
        level: 'debug',
        service: 'fasteignir-scraper',
        msg: 'Property not found (404)',
        id,
      }));
      return null;
    }
    console.error(JSON.stringify({
      level: 'error',
      service: 'fasteignir-scraper',
      msg: 'Failed to fetch property detail',
      id,
      err: err.message,
      status: err.response?.status,
    }));
    return null;
  }
}

/**
 * Main scrape function - two-phase approach
 * Phase 1: Collect all property IDs from search pages
 * Phase 2: Fetch detail pages in parallel (with concurrency limit)
 */
export async function scrapeAll(
  onBatch: (properties: RawProperty[]) => Promise<void>
): Promise<void> {
  const limit = pLimit(DETAIL_CONCURRENCY);
  const listingTypes: ListingType[] = ['sale', 'rental'];

  for (const listingType of listingTypes) {
    console.log(JSON.stringify({
      level: 'info',
      service: 'fasteignir-scraper',
      msg: 'Phase 1: Collecting property IDs',
      listingType,
    }));

    const ids = await fetchAllIds(listingType);

    console.log(JSON.stringify({
      level: 'info',
      service: 'fasteignir-scraper',
      msg: 'Phase 2: Fetching property details',
      listingType,
      totalIds: ids.length,
    }));

    const BATCH_SIZE = 50;
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const chunk = ids.slice(i, i + BATCH_SIZE);

      const results = await Promise.all(
        chunk.map(id =>
          limit(async () => {
            const prop = await fetchPropertyDetail(id, listingType);
            await sleep(DETAIL_DELAY_MS);
            return prop;
          })
        )
      );

      const valid = results.filter((r): r is RawProperty => r !== null);

      if (valid.length > 0) {
        await onBatch(valid);
      }

      console.log(JSON.stringify({
        level: 'info',
        service: 'fasteignir-scraper',
        msg: 'Processed batch',
        listingType,
        batchStart: i,
        batchEnd: Math.min(i + BATCH_SIZE, ids.length),
        totalIds: ids.length,
        validInBatch: valid.length,
      }));
    }
  }
}
