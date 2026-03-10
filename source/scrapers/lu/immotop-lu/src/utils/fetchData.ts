import axios from 'axios';
import * as cheerio from 'cheerio';
import { getRealisticHeaders, getRandomDelay } from './headers';
import { ImmotopListingRaw, ImmotopDetailRaw } from '../types/rawTypes';

const BASE_URL = 'https://www.immotop.lu';

// Immotop search URL patterns
export const SEARCH_CONFIGS = [
  { category: 'apartment', transaction: 'buy', path: '/en/search/buy/apartment' },
  { category: 'apartment', transaction: 'rent', path: '/en/search/rent/apartment' },
  { category: 'house', transaction: 'buy', path: '/en/search/buy/house' },
  { category: 'house', transaction: 'rent', path: '/en/search/rent/house' },
  { category: 'land', transaction: 'buy', path: '/en/search/buy/land' },
  { category: 'commercial', transaction: 'buy', path: '/en/search/buy/office' },
  { category: 'commercial', transaction: 'rent', path: '/en/search/rent/office' },
];

export interface DiscoveredListing {
  id: string;
  category: string;
  transactionType: string;
  url: string;
  raw: ImmotopListingRaw;
}

/**
 * Parse search results page HTML to extract listing cards
 */
function parseSearchPage($: cheerio.CheerioAPI, category: string, transaction: string): ImmotopListingRaw[] {
  const listings: ImmotopListingRaw[] = [];

  // Immotop uses Next.js - try to extract __NEXT_DATA__ first
  const nextDataScript = $('script#__NEXT_DATA__').html();
  if (nextDataScript) {
    try {
      const nextData = JSON.parse(nextDataScript);
      const props = nextData?.props?.pageProps;
      if (props?.listings || props?.results || props?.items) {
        const items = props.listings || props.results || props.items || [];
        for (const item of items) {
          listings.push(parseNextDataListing(item, category, transaction));
        }
        return listings;
      }
    } catch (e) {
      // Fall through to HTML parsing
    }
  }

  // Fallback: parse HTML listing cards
  $('[data-testid="property-card"], .property-card, .listing-card, article.property').each((_, el) => {
    const $el = $(el);
    const listing = parseHtmlListingCard($, $el, category, transaction);
    if (listing) listings.push(listing);
  });

  return listings;
}

function parseNextDataListing(item: any, category: string, transaction: string): ImmotopListingRaw {
  return {
    id: String(item.id || item.reference || item.slug || ''),
    title: item.title || item.name || '',
    price: item.price || item.priceValue || 0,
    currency: 'EUR',
    propertyType: category,
    transactionType: transaction,
    url: item.url || item.slug ? `${BASE_URL}${item.url || `/en/property/${item.slug}`}` : '',
    address: {
      city: item.city || item.locality || item.address?.city || '',
      zip: item.zipCode || item.postalCode || item.address?.zipCode || '',
      country: 'Luxembourg',
      region: item.region || item.district || '',
    },
    latitude: item.latitude || item.lat || item.coordinates?.lat,
    longitude: item.longitude || item.lng || item.coordinates?.lng,
    surface: item.surface || item.area || item.livingArea || 0,
    bedrooms: item.bedrooms || item.numberOfBedrooms || 0,
    bathrooms: item.bathrooms || item.numberOfBathrooms,
    rooms: item.rooms || item.numberOfRooms,
    floor: item.floor,
    plotSize: item.plotSize || item.landArea,
    yearBuilt: item.yearBuilt || item.constructionYear,
    energyClass: item.energyClass || item.energyRating,
    description: item.description,
    images: item.images || item.photos?.map((p: any) => p.url || p),
    agencyName: item.agency?.name || item.agencyName,
  };
}

function parseHtmlListingCard($: cheerio.CheerioAPI, $el: cheerio.Cheerio<any>, category: string, transaction: string): ImmotopListingRaw | null {
  const linkEl = $el.find('a[href*="/property/"], a[href*="/annonce/"]').first();
  const href = linkEl.attr('href');
  if (!href) return null;

  const url = href.startsWith('http') ? href : `${BASE_URL}${href}`;
  const idMatch = href.match(/\/(\d+)/);
  const id = idMatch ? idMatch[1] : href.replace(/[^a-zA-Z0-9]/g, '-');

  const title = $el.find('h2, h3, .property-title, [data-testid="property-title"]').first().text().trim();
  const priceText = $el.find('.price, [data-testid="price"], .property-price').first().text().trim();
  const price = parseInt(priceText.replace(/[^0-9]/g, ''), 10) || 0;

  const city = $el.find('.location, .city, [data-testid="location"]').first().text().trim();
  const surfaceText = $el.find('.surface, .area, [data-testid="surface"]').first().text().trim();
  const surface = parseInt(surfaceText.replace(/[^0-9]/g, ''), 10) || 0;

  const bedroomsText = $el.find('.bedrooms, [data-testid="bedrooms"]').first().text().trim();
  const bedrooms = parseInt(bedroomsText.replace(/[^0-9]/g, ''), 10) || 0;

  const imageEl = $el.find('img').first();
  const imageSrc = imageEl.attr('src') || imageEl.attr('data-src');
  const images = imageSrc ? [imageSrc] : [];

  return {
    id,
    title,
    price,
    currency: 'EUR',
    propertyType: category,
    transactionType: transaction,
    url,
    address: { city, country: 'Luxembourg' },
    surface,
    bedrooms,
    images,
  };
}

/**
 * Fetch all listing pages for a given search config
 */
export async function fetchAllListingPages(
  searchPath: string,
  category: string,
  transaction: string
): Promise<DiscoveredListing[]> {
  const allListings: DiscoveredListing[] = [];
  let page = 1;
  const seenIds = new Set<string>();

  while (true) {
    try {
      const url = `${BASE_URL}${searchPath}?page=${page}`;
      const headers = getRealisticHeaders();

      const response = await axios.get(url, { headers, timeout: 30000 });
      const $ = cheerio.load(response.data);
      const listings = parseSearchPage($, category, transaction);

      if (listings.length === 0) break;

      let newCount = 0;
      for (const listing of listings) {
        if (!listing.id || seenIds.has(listing.id)) continue;
        seenIds.add(listing.id);
        newCount++;
        allListings.push({
          id: listing.id,
          category,
          transactionType: transaction,
          url: listing.url || '',
          raw: listing,
        });
      }

      // If all listings on this page were already seen, stop
      if (newCount === 0) break;

      page++;
      await new Promise(resolve => setTimeout(resolve, getRandomDelay(500, 1000)));
    } catch (error: any) {
      if (error.response?.status === 404) break;
      console.error(JSON.stringify({
        level: 'error', service: 'immotop-scraper',
        msg: 'Failed to fetch page', searchPath, page,
        err: error.message,
      }));
      break;
    }
  }

  return allListings;
}

/**
 * Fetch and parse detail page
 */
export async function fetchListingDetail(url: string): Promise<ImmotopDetailRaw | null> {
  try {
    const headers = getRealisticHeaders();
    const response = await axios.get(url, { headers, timeout: 15000 });
    const $ = cheerio.load(response.data);

    // Try __NEXT_DATA__ first
    const nextDataScript = $('script#__NEXT_DATA__').html();
    if (nextDataScript) {
      try {
        const nextData = JSON.parse(nextDataScript);
        const props = nextData?.props?.pageProps;
        if (props?.property || props?.listing) {
          const item = props.property || props.listing;
          return {
            ...parseNextDataListing(item, '', ''),
            detailedDescription: item.description || item.detailedDescription || '',
            detailedFeatures: item.features || item.amenities || [],
          };
        }
      } catch (e) {
        // Fall through
      }
    }

    // Fallback: parse HTML detail page
    const title = $('h1').first().text().trim();
    const priceText = $('.price, [data-testid="price"]').first().text().trim();
    const price = parseInt(priceText.replace(/[^0-9]/g, ''), 10) || 0;
    const description = $('.description, [data-testid="description"]').first().text().trim();

    const images: string[] = [];
    $('img[src*="immotop"], img[src*="s1.immotop"]').each((_, el) => {
      const src = $(el).attr('src');
      if (src) images.push(src);
    });

    const features: string[] = [];
    $('.feature, .amenity, [data-testid="feature"]').each((_, el) => {
      features.push($(el).text().trim());
    });

    // Extract structured data from property details section
    const surface = extractNumber($, 'surface', 'area', 'living');
    const bedrooms = extractNumber($, 'bedroom');
    const bathrooms = extractNumber($, 'bathroom');
    const rooms = extractNumber($, 'room');
    const floor = extractNumber($, 'floor', 'étage');
    const plotSize = extractNumber($, 'plot', 'terrain', 'land');

    return {
      id: url.match(/\/(\d+)/)?.[1] || url,
      title,
      price,
      currency: 'EUR',
      url,
      surface,
      bedrooms,
      bathrooms,
      rooms,
      floor,
      plotSize,
      description,
      detailedDescription: description,
      images,
      detailedFeatures: features,
      hasElevator: features.some(f => /elevator|lift|ascenseur/i.test(f)),
      hasBalcony: features.some(f => /balcon/i.test(f)),
      hasParking: features.some(f => /parking|garage/i.test(f)),
      hasBasement: features.some(f => /basement|cave|cellar/i.test(f)),
      hasGarden: features.some(f => /garden|jardin/i.test(f)),
      hasGarage: features.some(f => /garage/i.test(f)),
      hasTerrace: features.some(f => /terrace|terrasse/i.test(f)),
    };
  } catch (error: any) {
    if (error.response?.status === 404 || error.response?.status === 410) return null;
    throw error;
  }
}

function extractNumber($: cheerio.CheerioAPI, ...keywords: string[]): number {
  for (const keyword of keywords) {
    const regex = new RegExp(keyword, 'i');
    let value = 0;
    $('dt, th, .label, .key').each((_, el) => {
      const text = $(el).text().trim();
      if (regex.test(text)) {
        const next = $(el).next('dd, td, .value').text().trim();
        const num = parseInt(next.replace(/[^0-9]/g, ''), 10);
        if (num > 0) value = num;
      }
    });
    if (value > 0) return value;
  }
  return 0;
}
