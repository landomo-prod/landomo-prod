import axios from 'axios';
import * as cheerio from 'cheerio';
import pLimit from 'p-limit';
import { getRandomUserAgent } from '../utils/userAgents';

const SEARCH_URL = 'https://fasteignaleitin.is/soluskra/calculate_show_list.php';
const DETAIL_BASE_URL = 'https://fasteignaleitin.is/eign/';
const DELAY_BETWEEN_REQUESTS_MS = 300;
const CONCURRENCY = 5;

const SERVICE = 'fasteignaleitin-scraper';

export interface RawListing {
  slug: string;
  sourceUrl: string;
  address?: string;
  city?: string;
  zipCode?: string;
  price?: number;
  sqm?: number;
  rooms?: number;
  bedrooms?: number;
  bathrooms?: number;
  yearBuilt?: number;
  propertyTypeRaw?: string;
  latitude?: number;
  longitude?: number;
  description?: string;
  hasElevator?: boolean;
  hasBalcony?: boolean;
  hasGarage?: boolean;
  hasGarden?: boolean;
  hasParking?: boolean;
  hasBasement?: boolean;
  sqmPlot?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * POST to the AJAX search endpoint and return all listing slugs from the HTML snippet.
 */
async function fetchSearchPage(page: number): Promise<string[]> {
  const body = new URLSearchParams({
    page: String(page),
    search_string: '',
    order_by: '1',
  });

  const response = await axios.post(SEARCH_URL, body.toString(), {
    headers: {
      'User-Agent': getRandomUserAgent(),
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'is,en;q=0.9',
      Referer: 'https://fasteignaleitin.is/soluskra/',
      'X-Requested-With': 'XMLHttpRequest',
    },
    timeout: 30000,
    responseType: 'text',
  });

  const html: string = response.data;

  // If the response is empty or has no content, stop pagination
  if (!html || html.trim().length === 0) {
    return [];
  }

  const $ = cheerio.load(html);
  const slugs: string[] = [];

  // Extract slugs from href="/eign/..." links
  $('a[href*="/eign/"]').each((_i, el) => {
    const href = $(el).attr('href') || '';
    const match = href.match(/\/eign\/([^/?#]+)/);
    if (match && match[1]) {
      const slug = match[1].trim();
      if (slug && !slugs.includes(slug)) {
        slugs.push(slug);
      }
    }
  });

  return slugs;
}

/**
 * Collect all unique listing slugs by paginating the search endpoint.
 */
async function collectAllSlugs(): Promise<string[]> {
  const allSlugs = new Set<string>();
  let page = 1;

  console.log(JSON.stringify({ level: 'info', service: SERVICE, msg: 'Starting slug collection' }));

  while (true) {
    let slugs: string[];

    try {
      slugs = await fetchSearchPage(page);
    } catch (err: any) {
      console.error(JSON.stringify({
        level: 'error',
        service: SERVICE,
        msg: 'Failed to fetch search page',
        page,
        err: err.message,
      }));
      break;
    }

    if (slugs.length === 0) {
      console.log(JSON.stringify({
        level: 'info',
        service: SERVICE,
        msg: 'No more slugs found, stopping pagination',
        page,
        totalCollected: allSlugs.size,
      }));
      break;
    }

    const beforeSize = allSlugs.size;
    for (const slug of slugs) {
      allSlugs.add(slug);
    }

    console.log(JSON.stringify({
      level: 'info',
      service: SERVICE,
      msg: 'Search page fetched',
      page,
      newOnPage: slugs.length,
      newUnique: allSlugs.size - beforeSize,
      totalUnique: allSlugs.size,
    }));

    page++;
    await sleep(DELAY_BETWEEN_REQUESTS_MS);
  }

  return Array.from(allSlugs);
}

/**
 * Parse a number from Icelandic formatted strings like "1.234.567 kr." or "123 m²"
 */
function parseIcelandicNumber(text: string): number | undefined {
  if (!text) return undefined;
  // Remove thousands separators (dots in Icelandic) and non-numeric except decimal comma
  const cleaned = text.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? undefined : num;
}

/**
 * Extract coordinates from map embed or inline script tags.
 */
function extractCoordinates(html: string): { lat?: number; lon?: number } {
  // Look for lat/lon in Google Maps embed URL
  const gmapsMatch = html.match(/maps\.google\.com[^"']*[?&]q=([\d.]+),([\d.]+)/);
  if (gmapsMatch) {
    return { lat: parseFloat(gmapsMatch[1]), lon: parseFloat(gmapsMatch[2]) };
  }

  // Look for latitude/longitude in script or data attributes
  const latMatch = html.match(/['"_]?lat(?:itude)?['"_]?\s*[=:]\s*["']?([\d.-]+)["']?/i);
  const lonMatch = html.match(/['"_]?lon(?:g(?:itude)?)?['"_]?\s*[=:]\s*["']?([\d.-]+)["']?/i);
  if (latMatch && lonMatch) {
    const lat = parseFloat(latMatch[1]);
    const lon = parseFloat(lonMatch[1]);
    // Iceland is roughly lat 63-67, lon -25 to -12
    if (lat > 60 && lat < 70 && lon > -30 && lon < -10) {
      return { lat, lon };
    }
  }

  // Look for map initialization with coordinates in common JS patterns
  const mapInitMatch = html.match(/new\s+(?:google\.maps\.LatLng|L\.latLng)\s*\(\s*([\d.-]+)\s*,\s*([\d.-]+)\s*\)/);
  if (mapInitMatch) {
    return { lat: parseFloat(mapInitMatch[1]), lon: parseFloat(mapInitMatch[2]) };
  }

  return {};
}

/**
 * Fetch and parse a detail page for a single listing.
 */
async function fetchDetailPage(slug: string): Promise<RawListing> {
  const sourceUrl = `${DETAIL_BASE_URL}${slug}`;
  const response = await axios.get(sourceUrl, {
    headers: {
      'User-Agent': getRandomUserAgent(),
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'is,en;q=0.9',
      Referer: 'https://fasteignaleitin.is/soluskra/',
    },
    timeout: 30000,
    responseType: 'text',
  });

  const html: string = response.data;
  const $ = cheerio.load(html);

  const listing: RawListing = { slug, sourceUrl };

  // --- Address ---
  const h1Text = $('h1').first().text().trim();
  if (h1Text) {
    listing.address = h1Text;
  }

  // --- ZIP + City: look for "NNN CityName" pattern ---
  const allText = $('body').text();
  const zipCityMatch = allText.match(/\b(\d{3})\s+([A-Za-záéíóúýðþæöÁÉÍÓÚÝÐÞÆÖ][A-Za-záéíóúýðþæöÁÉÍÓÚÝÐÞÆÖ\s-]+?)(?:\s*[,.\n]|$)/m);
  if (zipCityMatch) {
    listing.zipCode = zipCityMatch[1];
    listing.city = zipCityMatch[2].trim();
  }

  // --- Price: "X.XXX.XXX kr." ---
  const priceMatch = allText.match(/([\d.,]+)\s*kr\.?/i);
  if (priceMatch) {
    listing.price = parseIcelandicNumber(priceMatch[1]);
  }

  // --- Size: "XXX m²" or "XXXm²" ---
  const sqmMatch = allText.match(/([\d.,]+)\s*m[²2]/i);
  if (sqmMatch) {
    listing.sqm = parseIcelandicNumber(sqmMatch[1]);
  }

  // --- Plot size: look for "lóðarflatarmál" or "lóð" size ---
  const plotMatch = allText.match(/l[oó]ð(?:arflatarm[aá]l)?\s*[:\-]?\s*([\d.,]+)\s*m[²2]/i);
  if (plotMatch) {
    listing.sqmPlot = parseIcelandicNumber(plotMatch[1]);
  }

  // --- Rooms: "X herbergi" ---
  const roomsMatch = allText.match(/(\d+)\s*herb(?:ergi)?\.?/i);
  if (roomsMatch) {
    listing.rooms = parseInt(roomsMatch[1], 10);
  }

  // --- Bedrooms: "X svefnherbergi" ---
  const bedroomsMatch = allText.match(/(\d+)\s*svefnh(?:erbergi)?\.?/i);
  if (bedroomsMatch) {
    listing.bedrooms = parseInt(bedroomsMatch[1], 10);
  }

  // --- Bathrooms: "X baðherbergi" ---
  const bathroomsMatch = allText.match(/(\d+)\s*ba[ðd]h(?:erbergi)?\.?/i);
  if (bathroomsMatch) {
    listing.bathrooms = parseInt(bathroomsMatch[1], 10);
  }

  // --- Year built: "Byggt XXXX" ---
  const yearMatch = allText.match(/byggt\s*(\d{4})/i);
  if (yearMatch) {
    listing.yearBuilt = parseInt(yearMatch[1], 10);
  }

  // --- Property type ---
  const typeKeywords = [
    'Fjölbýlishús', 'Fjölbýli', 'Íbúð', 'ibud',
    'Einbýlishús', 'Einbýli', 'Raðhús', 'Parhús', 'Sumarbústaður',
    'Lóð', 'Lóðarland', 'Jarðir',
    'Atvinnuhúsnæði', 'Verslun', 'Skrifstofur',
  ];
  for (const kw of typeKeywords) {
    if (new RegExp(kw, 'i').test(allText)) {
      listing.propertyTypeRaw = kw;
      break;
    }
  }

  // Also check page title or meta for property type
  if (!listing.propertyTypeRaw) {
    const title = $('title').text();
    for (const kw of typeKeywords) {
      if (new RegExp(kw, 'i').test(title)) {
        listing.propertyTypeRaw = kw;
        break;
      }
    }
  }

  // --- Features ---
  const lowerText = allText.toLowerCase();
  listing.hasElevator = /lyfta/.test(lowerText);
  listing.hasBalcony = /svalir|svalirnar/.test(lowerText);
  listing.hasGarage = /b[ií]lsk[uú]r/.test(lowerText);
  listing.hasGarden = /gar[ðd]ur|garðurinn/.test(lowerText);
  listing.hasParking = /b[ií]last[æa]ð/.test(lowerText);
  listing.hasBasement = /kjallari/.test(lowerText);

  // --- Coordinates ---
  const coords = extractCoordinates(html);
  if (coords.lat) listing.latitude = coords.lat;
  if (coords.lon) listing.longitude = coords.lon;

  // --- Description ---
  // Try common description selectors
  const descSelectors = [
    '.property-description',
    '.listing-description',
    '.description',
    '[class*="description"]',
    '[class*="lysing"]',
    'article p',
    '.content p',
  ];
  for (const sel of descSelectors) {
    const el = $(sel).first();
    if (el.length && el.text().trim().length > 20) {
      listing.description = el.text().trim().substring(0, 2000);
      break;
    }
  }

  return listing;
}

/**
 * Main scrape function: collect all slugs, fetch all detail pages, stream results via callback.
 */
export async function scrapeAll(
  onBatch: (batch: RawListing[]) => Promise<void>
): Promise<void> {
  console.log(JSON.stringify({ level: 'info', service: SERVICE, msg: 'Starting fasteignaleitin.is scrape' }));

  const slugs = await collectAllSlugs();

  if (slugs.length === 0) {
    console.log(JSON.stringify({ level: 'warn', service: SERVICE, msg: 'No slugs found, aborting' }));
    return;
  }

  console.log(JSON.stringify({
    level: 'info',
    service: SERVICE,
    msg: 'Collected slugs, starting detail fetch',
    totalSlugs: slugs.length,
  }));

  const limit = pLimit(CONCURRENCY);
  const BATCH_SIZE = 100;
  let pendingBatch: RawListing[] = [];
  let fetched = 0;
  let errors = 0;

  // Process in chunks to maintain ordering and allow batch streaming
  const tasks = slugs.map(slug =>
    limit(async () => {
      await sleep(DELAY_BETWEEN_REQUESTS_MS);
      try {
        const listing = await fetchDetailPage(slug);
        fetched++;

        pendingBatch.push(listing);

        if (pendingBatch.length >= BATCH_SIZE) {
          const batch = pendingBatch.splice(0, BATCH_SIZE);
          await onBatch(batch);
        }

        if (fetched % 50 === 0) {
          console.log(JSON.stringify({
            level: 'info',
            service: SERVICE,
            msg: 'Detail fetch progress',
            fetched,
            errors,
            total: slugs.length,
          }));
        }
      } catch (err: any) {
        errors++;
        console.error(JSON.stringify({
          level: 'error',
          service: SERVICE,
          msg: 'Failed to fetch detail page',
          slug,
          err: err.message,
        }));
      }
    })
  );

  await Promise.all(tasks);

  // Flush remaining
  if (pendingBatch.length > 0) {
    await onBatch(pendingBatch);
    pendingBatch = [];
  }

  console.log(JSON.stringify({
    level: 'info',
    service: SERVICE,
    msg: 'Detail fetch complete',
    fetched,
    errors,
    total: slugs.length,
  }));
}
