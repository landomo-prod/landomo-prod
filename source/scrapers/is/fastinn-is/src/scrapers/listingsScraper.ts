import axios from 'axios';
import * as cheerio from 'cheerio';

const BASE_URL = 'https://www.fastinn.is';
const LISTINGS_URL = `${BASE_URL}/eignir/leita`;
const PAGE_DELAY_MS = 500;
const DETAIL_DELAY_MS = 300;
const DETAIL_CONCURRENCY = 5;

export interface FastinnRawListing {
  id: string;
  url: string;
  listingType: 'sale' | 'rent';
  address?: string;
  city?: string;
  zip?: string;
  price?: number;
  sqm?: number;
  rooms?: number;
  bedrooms?: number;
  bathrooms?: number;
  yearBuilt?: number;
  propertyType?: string;
  hasElevator?: boolean;
  hasBalcony?: boolean;
  hasGarage?: boolean;
  hasGarden?: boolean;
  hasParking?: boolean;
  lat?: number;
  lon?: number;
  rawHtml?: string;
}

/**
 * Extract property IDs/slugs from a listings page
 */
async function fetchListingIds(url: string): Promise<{ id: string; listingType: 'sale' | 'rent' }[]> {
  const response = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'is-IS,is;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
    },
    timeout: 30000,
  });

  const $ = cheerio.load(response.data as string);
  const ids: { id: string; listingType: 'sale' | 'rent' }[] = [];
  const seen = new Set<string>();

  // Determine listing type from URL
  const listingType: 'sale' | 'rent' = url.includes('type=leiga') ? 'rent' : 'sale';

  // Find all links matching /eign/{id}
  $('a[href*="/eign/"]').each((_i, el) => {
    const href = $(el).attr('href') || '';
    const match = href.match(/\/eign\/([^/?#]+)/);
    if (match && match[1] && !seen.has(match[1])) {
      seen.add(match[1]);
      ids.push({ id: match[1], listingType });
    }
  });

  return ids;
}

/**
 * Fetch all listing IDs across all pages for a given listing type
 */
async function fetchAllIds(listingType: 'sale' | 'rent'): Promise<{ id: string; listingType: 'sale' | 'rent' }[]> {
  const allIds: { id: string; listingType: 'sale' | 'rent' }[] = [];
  const seenIds = new Set<string>();
  let page = 1;
  let consecutiveEmpty = 0;

  const typeParam = listingType === 'rent' ? '&type=leiga' : '';

  while (true) {
    const url = `${LISTINGS_URL}?page=${page}${typeParam}`;

    console.log(JSON.stringify({
      level: 'info',
      service: 'fastinn-scraper',
      msg: 'Fetching listings page',
      listingType,
      page,
      url,
    }));

    let pageIds: { id: string; listingType: 'sale' | 'rent' }[];

    try {
      pageIds = await fetchListingIds(url);
    } catch (err: any) {
      console.error(JSON.stringify({
        level: 'error',
        service: 'fastinn-scraper',
        msg: 'Failed to fetch listings page',
        listingType,
        page,
        err: err.message,
      }));
      break;
    }

    if (pageIds.length === 0) {
      consecutiveEmpty++;
      if (consecutiveEmpty >= 2) break;
      page++;
      continue;
    }

    consecutiveEmpty = 0;

    // Check for new IDs to detect cycling
    const newIds = pageIds.filter(item => !seenIds.has(item.id));
    if (newIds.length === 0) {
      console.log(JSON.stringify({
        level: 'info',
        service: 'fastinn-scraper',
        msg: 'No new IDs found on page, stopping pagination',
        listingType,
        page,
      }));
      break;
    }

    for (const item of newIds) {
      seenIds.add(item.id);
      allIds.push(item);
    }

    console.log(JSON.stringify({
      level: 'info',
      service: 'fastinn-scraper',
      msg: 'Page fetched',
      listingType,
      page,
      newIdsOnPage: newIds.length,
      totalIds: allIds.length,
    }));

    page++;
    await new Promise(resolve => setTimeout(resolve, PAGE_DELAY_MS));
  }

  return allIds;
}

/**
 * Parse a detail page and extract property data
 */
function parseDetailPage(id: string, html: string, listingType: 'sale' | 'rent'): FastinnRawListing {
  const $ = cheerio.load(html);
  const listing: FastinnRawListing = {
    id,
    url: `${BASE_URL}/eign/${id}`,
    listingType,
    rawHtml: html.substring(0, 5000), // keep first 5k chars for debugging
  };

  // Address from h1
  const h1Text = $('h1').first().text().trim();
  if (h1Text) {
    listing.address = h1Text;
  }

  // Get all text content for pattern matching
  const bodyText = $('body').text();

  // ZIP + city: look for "NNN CityName" or "NNN CityName" pattern
  const zipCityMatch = bodyText.match(/\b(\d{3})\s+([A-ZÁÉÍÓÚÝÞÆÖ][a-záéíóúýþæö\s-]+?)(?=\s*[\n\r,]|\s{2,}|$)/);
  if (zipCityMatch) {
    listing.zip = zipCityMatch[1];
    listing.city = zipCityMatch[2].trim();
  }

  // Price: "X.XXX.XXX kr." or "X.XXX kr./mán."
  const priceMatch = bodyText.match(/([\d.,]+)\s*kr\./i);
  if (priceMatch) {
    const priceStr = priceMatch[1].replace(/\./g, '').replace(/,/g, '');
    const price = parseInt(priceStr, 10);
    if (!isNaN(price) && price > 0) {
      listing.price = price;
    }
  }

  // Size: "XXm²" or "XX m²" or "XX fm²"
  const sqmMatch = bodyText.match(/(\d+(?:[.,]\d+)?)\s*(?:f?m²|fm2|m2)/i);
  if (sqmMatch) {
    const sqm = parseFloat(sqmMatch[1].replace(',', '.'));
    if (!isNaN(sqm) && sqm > 0) {
      listing.sqm = sqm;
    }
  }

  // Rooms: "X herbergi"
  const roomsMatch = bodyText.match(/(\d+)\s+herbergi/i);
  if (roomsMatch) {
    listing.rooms = parseInt(roomsMatch[1], 10);
  }

  // Bedrooms: "X svefnherbergi"
  const bedroomsMatch = bodyText.match(/(\d+)\s+svefnherbergi/i);
  if (bedroomsMatch) {
    listing.bedrooms = parseInt(bedroomsMatch[1], 10);
  }

  // Bathrooms: "X baðherbergi" or "X baðr\."
  const bathroomsMatch = bodyText.match(/(\d+)\s+(?:baðherbergi|baðr\.)/i);
  if (bathroomsMatch) {
    listing.bathrooms = parseInt(bathroomsMatch[1], 10);
  }

  // Year built: "Byggt XXXX"
  const yearMatch = bodyText.match(/[Bb]yggt\s+(\d{4})/);
  if (yearMatch) {
    const year = parseInt(yearMatch[1], 10);
    if (year >= 1800 && year <= new Date().getFullYear()) {
      listing.yearBuilt = year;
    }
  }

  // Property type: look for Icelandic type keywords
  const typeKeywords = [
    'Fjölbýlishús', 'Fjölbýli', 'Íbúð',
    'Einbýlishús', 'Einbýli', 'Raðhús', 'Parhús', 'Sumarbústaður',
    'Lóð', 'Lóðarland', 'Jarðir', 'Jörð',
    'Atvinnuhúsnæði', 'Verslun', 'Skrifstofurými',
  ];

  for (const keyword of typeKeywords) {
    if (bodyText.includes(keyword)) {
      listing.propertyType = keyword;
      break;
    }
  }

  // Features
  listing.hasElevator = /lyfta/i.test(bodyText);
  listing.hasBalcony = /svalir/i.test(bodyText);
  listing.hasGarage = /bílskúr/i.test(bodyText);
  listing.hasGarden = /garður/i.test(bodyText);
  listing.hasParking = /bílastæð/i.test(bodyText) || listing.hasGarage;

  // Coordinates from Google Maps / map link
  const coordMatch = html.match(/(?:lat(?:itude)?[=:,\s"']+)([-\d.]+)[\s\S]{0,50}(?:lon(?:g(?:itude)?)?[=:,\s"']+)([-\d.]+)/i)
    || html.match(/@([-\d.]+),([-\d.]+)/)
    || html.match(/maps\.google\.[^"']*[?&]q=([-\d.]+),([-\d.]+)/)
    || html.match(/ll=([-\d.]+),([-\d.]+)/)
    || html.match(/"lat(?:itude)?"\s*:\s*([-\d.]+)[\s\S]{0,30}"lon(?:g(?:itude)?)?\s*:\s*([-\d.]+)/i);

  if (coordMatch) {
    const lat = parseFloat(coordMatch[1]);
    const lon = parseFloat(coordMatch[2]);
    // Validate Iceland coordinates roughly
    if (lat >= 63 && lat <= 67 && lon >= -25 && lon <= -12) {
      listing.lat = lat;
      listing.lon = lon;
    }
  }

  return listing;
}

/**
 * Fetch and parse a single detail page
 */
async function fetchDetail(id: string, listingType: 'sale' | 'rent'): Promise<FastinnRawListing | null> {
  const url = `${BASE_URL}/eign/${id}`;

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'is-IS,is;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': LISTINGS_URL,
      },
      timeout: 30000,
    });

    return parseDetailPage(id, response.data as string, listingType);
  } catch (err: any) {
    if (err.response?.status === 404) {
      return null;
    }
    console.error(JSON.stringify({
      level: 'error',
      service: 'fastinn-scraper',
      msg: 'Failed to fetch detail page',
      id,
      err: err.message,
    }));
    return null;
  }
}

/**
 * Main scrape function: paginate listing pages, then fetch each detail page
 */
export async function scrapeAll(
  onBatch?: (batch: FastinnRawListing[]) => Promise<void>
): Promise<FastinnRawListing[]> {
  const allListings: FastinnRawListing[] = [];

  const listingTypes: Array<'sale' | 'rent'> = ['sale', 'rent'];

  for (const listingType of listingTypes) {
    console.log(JSON.stringify({
      level: 'info',
      service: 'fastinn-scraper',
      msg: 'Collecting listing IDs',
      listingType,
    }));

    const ids = await fetchAllIds(listingType);

    console.log(JSON.stringify({
      level: 'info',
      service: 'fastinn-scraper',
      msg: 'Starting detail fetch',
      listingType,
      totalIds: ids.length,
      concurrency: DETAIL_CONCURRENCY,
    }));

    // Fetch details with limited concurrency
    const batchSize = DETAIL_CONCURRENCY;
    const pendingBatch: FastinnRawListing[] = [];

    for (let i = 0; i < ids.length; i += batchSize) {
      const chunk = ids.slice(i, i + batchSize);

      const results = await Promise.all(
        chunk.map(({ id, listingType: lt }) => fetchDetail(id, lt))
      );

      const valid = results.filter((r): r is FastinnRawListing => r !== null);
      allListings.push(...valid);
      pendingBatch.push(...valid);

      console.log(JSON.stringify({
        level: 'info',
        service: 'fastinn-scraper',
        msg: 'Detail batch fetched',
        listingType,
        progress: `${Math.min(i + batchSize, ids.length)}/${ids.length}`,
        batchFetched: valid.length,
        total: allListings.length,
      }));

      if (onBatch && pendingBatch.length >= 50) {
        const toFlush = pendingBatch.splice(0, pendingBatch.length);
        try {
          await onBatch(toFlush);
        } catch (err: any) {
          console.error(JSON.stringify({
            level: 'error',
            service: 'fastinn-scraper',
            msg: 'Failed to process batch callback',
            err: err.message,
          }));
        }
      }

      // Polite delay between detail batches
      if (i + batchSize < ids.length) {
        await new Promise(resolve => setTimeout(resolve, DETAIL_DELAY_MS));
      }
    }

    // Flush any remaining
    if (onBatch && pendingBatch.length > 0) {
      try {
        await onBatch(pendingBatch.splice(0, pendingBatch.length));
      } catch (err: any) {
        console.error(JSON.stringify({
          level: 'error',
          service: 'fastinn-scraper',
          msg: 'Failed to flush remaining batch',
          err: err.message,
        }));
      }
    }
  }

  return allListings;
}
