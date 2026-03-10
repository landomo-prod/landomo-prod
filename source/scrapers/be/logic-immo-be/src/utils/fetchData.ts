import axios, { AxiosError } from 'axios';
import * as cheerio from 'cheerio';
import pLimit from 'p-limit';
import { getRealisticHeaders, getRandomDelay } from './headers';
import { RawLogicImmoListing } from '../types/rawTypes';

const BASE_URL = 'https://www.logic-immo.be';

// Category mappings for Logic Immo Belgium
const SEARCH_PATHS: { category: string; transaction: string; path: string }[] = [
  { category: 'apartment', transaction: 'sale', path: '/fr/vente/appartement/' },
  { category: 'apartment', transaction: 'rent', path: '/fr/location/appartement/' },
  { category: 'house', transaction: 'sale', path: '/fr/vente/maison/' },
  { category: 'house', transaction: 'rent', path: '/fr/location/maison/' },
  { category: 'land', transaction: 'sale', path: '/fr/vente/terrain/' },
  { category: 'commercial', transaction: 'sale', path: '/fr/vente/bureau/' },
  { category: 'commercial', transaction: 'rent', path: '/fr/location/bureau/' },
];

/**
 * Fetch all listing pages for a given category/transaction combo.
 * Looks for __NEXT_DATA__ or embedded JSON in HTML, or falls back to API.
 */
export async function fetchAllListingPages(
  categoryFilter?: string[]
): Promise<RawLogicImmoListing[]> {
  const allListings: RawLogicImmoListing[] = [];
  const seenIds = new Set<string>();
  const paths = categoryFilter
    ? SEARCH_PATHS.filter(p => categoryFilter.includes(p.category))
    : SEARCH_PATHS;

  const limit = pLimit(3);

  const results = await Promise.allSettled(
    paths.map(searchPath => limit(async () => {
      const pathListings: RawLogicImmoListing[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        try {
          await new Promise(resolve => setTimeout(resolve, getRandomDelay(200, 500)));

          const url = `${BASE_URL}${searchPath.path}?page=${page}`;
          const headers = getRealisticHeaders(BASE_URL);

          const response = await axios.get(url, {
            headers,
            timeout: 30000,
            maxRedirects: 5,
          });

          const listings = parseListingsFromHTML(response.data, searchPath.category, searchPath.transaction);

          if (listings.length === 0) {
            hasMore = false;
            break;
          }

          const newListings = listings.filter(l => {
            const id = l.id?.toString();
            if (!id || seenIds.has(id)) return false;
            seenIds.add(id);
            return true;
          });

          if (newListings.length === 0) {
            hasMore = false;
            break;
          }

          pathListings.push(...newListings);
          console.log(JSON.stringify({
            level: 'info',
            service: 'logic-immo-be-scraper',
            msg: 'Page fetched',
            category: searchPath.category,
            transaction: searchPath.transaction,
            page,
            count: newListings.length,
          }));

          page++;

          if (page > 200) {
            console.log(JSON.stringify({
              level: 'warn',
              service: 'logic-immo-be-scraper',
              msg: 'Hit page limit',
              category: searchPath.category,
            }));
            hasMore = false;
          }
        } catch (error: any) {
          const axiosError = error as AxiosError;
          if (axiosError.response?.status === 429) {
            const retryAfter = parseInt(axiosError.response.headers['retry-after'] as string || '60');
            console.log(JSON.stringify({ level: 'warn', service: 'logic-immo-be-scraper', msg: 'Rate limited (429)', retryAfter }));
            await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
            continue;
          }
          console.error(JSON.stringify({
            level: 'error',
            service: 'logic-immo-be-scraper',
            msg: 'Failed to fetch page',
            category: searchPath.category,
            page,
            err: error.message,
          }));
          hasMore = false;
        }
      }

      return pathListings;
    }))
  );

  for (const result of results) {
    if (result.status === 'fulfilled') {
      allListings.push(...result.value);
    } else {
      console.error(JSON.stringify({ level: 'error', service: 'logic-immo-be-scraper', msg: 'Path failed', err: result.reason?.message }));
    }
  }

  return allListings;
}

function parseListingsFromHTML(
  html: string,
  category: string,
  transaction: string
): RawLogicImmoListing[] {
  const $ = cheerio.load(html);
  const listings: RawLogicImmoListing[] = [];

  // Try __NEXT_DATA__ first (Next.js pattern)
  const nextDataScript = $('script#__NEXT_DATA__').html();
  if (nextDataScript) {
    try {
      const nextData = JSON.parse(nextDataScript);
      const props = nextData?.props?.pageProps;
      const items = props?.listings || props?.results || props?.properties || [];
      for (const item of items) {
        const listing = mapNextDataListing(item, category, transaction);
        if (listing) listings.push(listing);
      }
      return listings;
    } catch (e) {
      // Fall through to HTML parsing
    }
  }

  // Try embedded JSON in script tags
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).html() || '');
      if (data['@type'] === 'ItemList' && data.itemListElement) {
        for (const item of data.itemListElement) {
          const listing = mapLdJsonListing(item, category, transaction);
          if (listing) listings.push(listing);
        }
      }
    } catch (e) {
      // Skip malformed JSON
    }
  });

  if (listings.length > 0) return listings;

  // Fallback: parse listing cards from HTML
  $('[data-listing-id], .property-card, .listing-item, .result-item').each((_, el) => {
    const $el = $(el);
    const id = $el.attr('data-listing-id') || $el.attr('data-id') || $el.find('a').first().attr('href')?.match(/\/(\d+)/)?.[1];
    if (!id) return;

    const priceText = $el.find('.price, [class*="price"]').first().text().replace(/[^\d]/g, '');
    const surfaceText = $el.find('[class*="surface"], [class*="area"]').first().text().replace(/[^\d.,]/g, '');
    const roomsText = $el.find('[class*="room"]').first().text().replace(/[^\d]/g, '');
    const bedroomsText = $el.find('[class*="bedroom"]').first().text().replace(/[^\d]/g, '');

    const listing: RawLogicImmoListing = {
      id: id.toString(),
      title: $el.find('.title, h2, h3, [class*="title"]').first().text().trim() || undefined,
      price: priceText ? parseInt(priceText) : undefined,
      currency: 'EUR',
      url: $el.find('a').first().attr('href') || undefined,
      type: category,
      transaction_type: transaction,
      surface: surfaceText ? parseFloat(surfaceText) : undefined,
      rooms: roomsText ? parseInt(roomsText) : undefined,
      bedrooms: bedroomsText ? parseInt(bedroomsText) : undefined,
      address: {
        city: $el.find('[class*="location"], [class*="city"]').first().text().trim() || undefined,
      },
      images: $el.find('img').map((_, img) => $(img).attr('src')).get().filter(Boolean),
    };

    listings.push(listing);
  });

  return listings;
}

function mapNextDataListing(item: any, category: string, transaction: string): RawLogicImmoListing | null {
  const id = item.id?.toString() || item.propertyId?.toString();
  if (!id) return null;

  return {
    id,
    title: item.title || item.name,
    price: item.price?.value || item.price?.amount || item.price,
    currency: item.price?.currency || 'EUR',
    url: item.url || item.slug,
    type: category,
    transaction_type: transaction,
    surface: item.surface || item.area || item.livingArea,
    rooms: item.rooms || item.numberOfRooms,
    bedrooms: item.bedrooms || item.numberOfBedrooms,
    bathrooms: item.bathrooms || item.numberOfBathrooms,
    description: item.description,
    address: {
      street: item.address?.street,
      city: item.address?.city || item.location?.city,
      postal_code: item.address?.postalCode || item.location?.postalCode,
      province: item.address?.province || item.location?.region,
      lat: item.address?.lat || item.location?.latitude,
      lng: item.address?.lng || item.location?.longitude,
    },
    features: item.features || item.tags,
    images: item.images?.map((img: any) => img.url || img) || [],
    floor: item.floor,
    total_floors: item.totalFloors || item.numberOfFloors,
    year_built: item.yearBuilt || item.constructionYear,
    energy_class: item.energyClass || item.epc,
    has_elevator: item.hasElevator || item.elevator,
    has_balcony: item.hasBalcony || item.balcony,
    has_terrace: item.hasTerrace || item.terrace,
    has_garden: item.hasGarden || item.garden,
    has_garage: item.hasGarage || item.garage,
    has_parking: item.hasParking || item.parking,
    has_basement: item.hasBasement || item.basement,
    garden_surface: item.gardenSurface || item.gardenArea,
    plot_surface: item.plotSurface || item.plotArea || item.landArea,
    living_surface: item.livingSurface || item.livingArea,
    condition: item.condition,
    heating_type: item.heatingType || item.heating,
    construction_type: item.constructionType,
    furnished: item.furnished,
    agent: item.agent ? {
      name: item.agent.name,
      phone: item.agent.phone,
      email: item.agent.email,
      agency: item.agent.agency || item.agent.company,
    } : undefined,
    published_at: item.publishedAt || item.createdAt,
  };
}

function mapLdJsonListing(item: any, category: string, transaction: string): RawLogicImmoListing | null {
  const obj = item.item || item;
  const id = obj.identifier || obj['@id'];
  if (!id) return null;

  return {
    id: id.toString(),
    title: obj.name,
    price: typeof obj.offers?.price === 'number' ? obj.offers.price : parseFloat(obj.offers?.price),
    currency: obj.offers?.priceCurrency || 'EUR',
    url: obj.url,
    type: category,
    transaction_type: transaction,
    surface: obj.floorSize?.value ? parseFloat(obj.floorSize.value) : undefined,
    rooms: obj.numberOfRooms,
    bedrooms: obj.numberOfBedrooms,
    bathrooms: obj.numberOfBathroomsTotal,
    description: obj.description,
    address: {
      street: obj.address?.streetAddress,
      city: obj.address?.addressLocality,
      postal_code: obj.address?.postalCode,
      province: obj.address?.addressRegion,
      lat: obj.geo?.latitude,
      lng: obj.geo?.longitude,
    },
    images: obj.image ? (Array.isArray(obj.image) ? obj.image : [obj.image]) : [],
  };
}

/**
 * Fetch detail page for a single listing
 */
export async function fetchListingDetail(
  listingId: string,
  url?: string
): Promise<RawLogicImmoListing | null> {
  try {
    const detailUrl = url?.startsWith('http') ? url : `${BASE_URL}${url || `/fr/detail/${listingId}`}`;
    const headers = getRealisticHeaders(BASE_URL);
    headers['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8';

    const response = await axios.get(detailUrl, {
      headers,
      timeout: 30000,
    });

    return parseDetailFromHTML(response.data, listingId);
  } catch (error: any) {
    console.error(JSON.stringify({
      level: 'error',
      service: 'logic-immo-be-scraper',
      msg: 'Failed to fetch detail',
      listingId,
      err: error.message,
    }));
    return null;
  }
}

function parseDetailFromHTML(html: string, listingId: string): RawLogicImmoListing | null {
  const $ = cheerio.load(html);

  // Try __NEXT_DATA__
  const nextDataScript = $('script#__NEXT_DATA__').html();
  if (nextDataScript) {
    try {
      const nextData = JSON.parse(nextDataScript);
      const property = nextData?.props?.pageProps?.property || nextData?.props?.pageProps?.listing;
      if (property) {
        return mapNextDataListing(property, property.type || 'apartment', property.transactionType || 'sale');
      }
    } catch (e) { /* fall through */ }
  }

  // Try LD+JSON
  let detail: RawLogicImmoListing | null = null;
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).html() || '');
      if (data['@type'] === 'Residence' || data['@type'] === 'Apartment' || data['@type'] === 'House') {
        detail = mapLdJsonListing(data, 'apartment', 'sale');
      }
    } catch (e) { /* skip */ }
  });

  if (detail) return detail;

  // Basic HTML fallback
  const title = $('h1').first().text().trim();
  const priceText = $('[class*="price"]').first().text().replace(/[^\d]/g, '');
  const surfaceText = $('[class*="surface"], [class*="area"]').first().text().replace(/[^\d.,]/g, '');

  return {
    id: listingId,
    title: title || undefined,
    price: priceText ? parseInt(priceText) : undefined,
    currency: 'EUR',
    surface: surfaceText ? parseFloat(surfaceText) : undefined,
    url: undefined,
    type: 'apartment',
    transaction_type: 'sale',
  };
}
