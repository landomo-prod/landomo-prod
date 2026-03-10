import axios from 'axios';
import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';
import { getRandomDelay } from './headers';
import { habitacliaRateLimiter } from './rateLimiter';
import { getCFCookies, invalidateCFCookies, PLAYWRIGHT_USER_AGENT } from './cookieManager';
import { HabitacliaListingRaw, HabitacliaSearchConfig, HabitacliaSearchResult } from '../types/habitacliaTypes';

const BASE_URL = 'https://www.habitaclia.com';

// Spanish provinces with habitaclia coverage
export const SPANISH_PROVINCES = [
  'barcelona', 'madrid', 'valencia', 'alicante', 'malaga', 'sevilla',
  'tarragona', 'girona', 'lleida', 'baleares', 'zaragoza', 'murcia',
  'cadiz', 'granada', 'cordoba', 'almeria', 'huelva', 'jaen',
  'castellon', 'toledo', 'guadalajara', 'ciudad-real', 'cuenca', 'albacete',
  'valladolid', 'salamanca', 'leon', 'burgos', 'cantabria', 'asturias',
  'navarra', 'la-rioja', 'huesca', 'teruel', 'soria', 'segovia',
  'avila', 'zamora', 'palencia', 'pontevedra', 'ourense', 'lugo',
  'a-coruna', 'caceres', 'badajoz', 'las-palmas', 'santa-cruz-de-tenerife',
];

function buildSearchUrl(config: HabitacliaSearchConfig, page: number): string {
  // Pattern: /pisos-barcelona.htm (page 1), /pisos-barcelona-1.htm (page 2)
  const suffix = page > 1 ? `-${page - 1}` : '';
  return `${BASE_URL}/${config.propertyType}-${config.province}${suffix}.htm`;
}

function buildDetailUrl(listingPath: string): string {
  if (listingPath.startsWith('http')) return listingPath;
  return `${BASE_URL}${listingPath}`;
}

export async function fetchSearchPage(
  config: HabitacliaSearchConfig,
  page: number
): Promise<HabitacliaSearchResult> {
  await habitacliaRateLimiter.throttle();
  await new Promise(resolve => setTimeout(resolve, getRandomDelay(200, 600)));

  const url = buildSearchUrl(config, page);
  const cookieHeader = await getCFCookies();
  const headers = {
    'User-Agent': PLAYWRIGHT_USER_AGENT,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'es-ES,es;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Referer': 'https://www.habitaclia.com/',
    'Cookie': cookieHeader,
  };

  let response = await axios.get(url, {
    headers,
    timeout: 30000,
    validateStatus: (status) => status < 500,
  });

  // CF cookie expired — refresh and retry once
  if (response.status === 403) {
    invalidateCFCookies();
    const freshCookies = await getCFCookies();
    response = await axios.get(url, {
      headers: { ...headers, 'Cookie': freshCookies },
      timeout: 30000,
      validateStatus: (status) => status < 500,
    });
  }

  if (response.status === 404) {
    return { totalListings: 0, totalPages: 0, listings: [] };
  }

  if (response.status !== 200) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }

  const $ = cheerio.load(response.data);
  return parseSearchPage($, config);
}

function parseSearchPage($: cheerio.CheerioAPI, config: HabitacliaSearchConfig): HabitacliaSearchResult {
  const listings: HabitacliaListingRaw[] = [];

  // Extract total count from heading like "11.470 anuncios de pisos en venta"
  let totalListings = 0;
  const headingText = $('h1').first().text();
  const countMatch = headingText.match(/([\d.]+)\s+anuncio/);
  if (countMatch) {
    totalListings = parseInt(countMatch[1].replace(/\./g, ''), 10);
  }

  const totalPages = totalListings > 0 ? Math.ceil(totalListings / 15) : 0;

  // Parse each listing card
  $('article.js-list-item, .list-item').each((_i, el) => {
    try {
      const $el = $(el);
      const listing = parseListingCard($, $el, config);
      if (listing) listings.push(listing);
    } catch (err) {
      // Skip malformed listings
    }
  });

  return { totalListings, totalPages, listings };
}

function parseListingCard(
  $: cheerio.CheerioAPI,
  $el: cheerio.Cheerio<Element>,
  config: HabitacliaSearchConfig
): HabitacliaListingRaw | null {
  // Extract URL and ID
  const linkEl = $el.find('a[href*="-i"]').first();
  const href = linkEl.attr('href') || '';
  const fullUrl = buildDetailUrl(href);

  // Extract ID from URL pattern: -i38188000001837.htm
  const idMatch = href.match(/-i(\d+)\.htm/);
  if (!idMatch) return null;
  const id = idMatch[1];

  // Title
  const title = $el.find('.list-item-title, h3').first().text().trim();

  // Price
  const priceText = $el.find('.list-item-price, .font-2').first().text().trim();
  const priceClean = priceText.replace(/[^\d.,]/g, '').replace(/\./g, '').replace(',', '.');
  const price = priceClean ? parseFloat(priceClean) : null;

  // Features (rooms, sqm, bathrooms)
  const featText = $el.find('.list-item-feature, .feature').text();
  const sqmMatch = featText.match(/([\d.,]+)\s*m²/);
  const roomsMatch = featText.match(/(\d+)\s*hab/);
  const bathMatch = featText.match(/(\d+)\s*baño/);

  // Location
  const locationText = $el.find('.list-item-location, .location').first().text().trim();

  // Images
  const images: string[] = [];
  $el.find('img[src*="habimg"], img[data-src*="habimg"]').each((_i, img) => {
    const src = $(img).attr('data-src') || $(img).attr('src');
    if (src) images.push(src);
  });

  // Agency
  const agencyName = $el.find('.list-item-agency, .agency-name').first().text().trim() || null;

  const transactionType = config.transactionType === 'comprar' ? 'venta' : 'alquiler';

  return {
    id,
    url: fullUrl,
    title: title || `Property ${id}`,
    price: price && !isNaN(price) ? price : null,
    currency: 'EUR',
    transactionType: transactionType as 'venta' | 'alquiler',
    propertyType: config.propertyType,
    sqm: sqmMatch ? parseFloat(sqmMatch[1].replace('.', '').replace(',', '.')) : null,
    rooms: roomsMatch ? parseInt(roomsMatch[1], 10) : null,
    bathrooms: bathMatch ? parseInt(bathMatch[1], 10) : null,
    floor: null,
    description: null,
    location: {
      address: locationText || null,
      city: null,
      province: null,
      district: null,
      lat: null,
      lng: null,
    },
    images,
    features: [],
    agencyName,
    agencyPhone: null,
    energyCertificate: null,
    yearBuilt: null,
    condition: null,
    hasElevator: null,
    hasParking: null,
    hasGarden: null,
    hasPool: null,
    hasTerrace: null,
    hasBalcony: null,
    hasBasement: null,
    hasGarage: null,
    hasAirConditioning: null,
    plotSize: null,
    communityFees: null,
  };
}

export interface DetailResult {
  data: HabitacliaListingRaw;
  isInactive: boolean;
  inactiveReason?: string;
}

export async function fetchDetailPage(listing: HabitacliaListingRaw): Promise<DetailResult> {
  await habitacliaRateLimiter.throttle();
  await new Promise(resolve => setTimeout(resolve, getRandomDelay(300, 800)));

  const cookieHeader = await getCFCookies();
  const headers = {
    'User-Agent': PLAYWRIGHT_USER_AGENT,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'es-ES,es;q=0.9',
    'Referer': 'https://www.habitaclia.com/',
    'Cookie': cookieHeader,
  };
  const response = await axios.get(listing.url, {
    headers,
    timeout: 30000,
    validateStatus: (status) => status < 500,
  });

  if (response.status === 404 || response.status === 410) {
    return { data: listing, isInactive: true, inactiveReason: `http_${response.status}` };
  }

  if (response.status !== 200) {
    throw new Error(`HTTP ${response.status} for ${listing.url}`);
  }

  const $ = cheerio.load(response.data);
  const enriched = enrichFromDetail($, listing);

  return { data: enriched, isInactive: false };
}

function enrichFromDetail($: cheerio.CheerioAPI, listing: HabitacliaListingRaw): HabitacliaListingRaw {
  const enriched = { ...listing };

  // Description
  const desc = $('.detail-description, .description-text, #js-detail-description').first().text().trim();
  if (desc) enriched.description = desc;

  // Price (may be more accurate on detail)
  const priceText = $('.detail-price, .price').first().text().trim();
  if (priceText) {
    const priceClean = priceText.replace(/[^\d.,]/g, '').replace(/\./g, '').replace(',', '.');
    const price = parseFloat(priceClean);
    if (!isNaN(price) && price > 0) enriched.price = price;
  }

  // Features list
  const features: string[] = [];
  $('.detail-feature, .feature-item, .detail-info li, .info-features li').each((_i, el) => {
    const text = $(el).text().trim();
    if (text) features.push(text);
  });
  enriched.features = features;

  // Parse structured features
  const allText = features.join(' ').toLowerCase();

  if (enriched.hasElevator === null) {
    enriched.hasElevator = allText.includes('ascensor');
  }
  if (enriched.hasParking === null) {
    enriched.hasParking = allText.includes('parking') || allText.includes('aparcamiento') || allText.includes('garaje');
  }
  if (enriched.hasGarden === null) {
    enriched.hasGarden = allText.includes('jardín') || allText.includes('jardin');
  }
  if (enriched.hasPool === null) {
    enriched.hasPool = allText.includes('piscina');
  }
  if (enriched.hasTerrace === null) {
    enriched.hasTerrace = allText.includes('terraza');
  }
  if (enriched.hasBalcony === null) {
    enriched.hasBalcony = allText.includes('balcón') || allText.includes('balcon');
  }
  if (enriched.hasBasement === null) {
    enriched.hasBasement = allText.includes('trastero') || allText.includes('sótano') || allText.includes('sotano');
  }
  if (enriched.hasGarage === null) {
    enriched.hasGarage = allText.includes('garaje') || allText.includes('cochera');
  }
  if (enriched.hasAirConditioning === null) {
    enriched.hasAirConditioning = allText.includes('aire acondicionado') || allText.includes('climatización');
  }

  // Floor
  for (const feat of features) {
    const floorMatch = feat.match(/planta\s+(\d+)|(\d+)[ªº]?\s*planta/i);
    if (floorMatch && enriched.floor === null) {
      enriched.floor = floorMatch[1] || floorMatch[2];
    }
    if (feat.toLowerCase().includes('planta baja') || feat.toLowerCase().includes('bajo')) {
      enriched.floor = '0';
    }
  }

  // SQM from detail
  for (const feat of features) {
    const sqmMatch = feat.match(/([\d.,]+)\s*m²/);
    if (sqmMatch && enriched.sqm === null) {
      enriched.sqm = parseFloat(sqmMatch[1].replace('.', '').replace(',', '.'));
    }
  }

  // Rooms/bathrooms from detail
  for (const feat of features) {
    const roomMatch = feat.match(/(\d+)\s*(?:habitaci|dormitorio)/i);
    if (roomMatch && enriched.rooms === null) {
      enriched.rooms = parseInt(roomMatch[1], 10);
    }
    const bathMatch = feat.match(/(\d+)\s*baño/i);
    if (bathMatch && enriched.bathrooms === null) {
      enriched.bathrooms = parseInt(bathMatch[1], 10);
    }
  }

  // Energy certificate
  const energyEl = $('.detail-energy, .energy-certificate').first().text().trim();
  if (energyEl) {
    const certMatch = energyEl.match(/[A-G]/i);
    if (certMatch) enriched.energyCertificate = certMatch[0].toUpperCase();
  }

  // Year built
  for (const feat of features) {
    const yearMatch = feat.match(/(?:año|construido|construcción).*?(\d{4})/i);
    if (yearMatch) {
      const year = parseInt(yearMatch[1], 10);
      if (year >= 1800 && year <= 2030) enriched.yearBuilt = year;
    }
  }

  // Condition
  const condLower = allText;
  if (condLower.includes('obra nueva') || condLower.includes('a estrenar')) {
    enriched.condition = 'new_build';
  } else if (condLower.includes('reformado')) {
    enriched.condition = 'renovated';
  } else if (condLower.includes('a reformar') || condLower.includes('para reformar')) {
    enriched.condition = 'needs_renovation';
  } else if (condLower.includes('buen estado')) {
    enriched.condition = 'good';
  }

  // Images from detail page
  const detailImages: string[] = [];
  $('.detail-gallery img, .gallery img, .slider img').each((_i, img) => {
    const src = $(img).attr('data-src') || $(img).attr('src');
    if (src && !src.includes('placeholder')) detailImages.push(src);
  });
  if (detailImages.length > enriched.images.length) {
    enriched.images = detailImages;
  }

  // GPS coordinates from embedded map/script
  const bodyHtml = $.html();
  const latMatch = bodyHtml.match(/["']lat["']\s*:\s*([\d.-]+)/);
  const lngMatch = bodyHtml.match(/["'](?:lng|lon)["']\s*:\s*([\d.-]+)/);
  if (latMatch && lngMatch) {
    enriched.location.lat = parseFloat(latMatch[1]);
    enriched.location.lng = parseFloat(lngMatch[1]);
  }

  // Agency phone
  const phone = $('[href^="tel:"]').first().attr('href');
  if (phone) enriched.agencyPhone = phone.replace('tel:', '');

  // Community fees
  for (const feat of features) {
    const feeMatch = feat.match(/comunidad.*?([\d.,]+)\s*€/i);
    if (feeMatch) {
      enriched.communityFees = parseFloat(feeMatch[1].replace('.', '').replace(',', '.'));
    }
  }

  // Plot size (for houses/land)
  for (const feat of features) {
    const plotMatch = feat.match(/parcela.*?([\d.,]+)\s*m²/i);
    if (plotMatch) {
      enriched.plotSize = parseFloat(plotMatch[1].replace('.', '').replace(',', '.'));
    }
  }

  // Location enrichment
  const breadcrumbs = $('.breadcrumb li, .breadcrumbs li').map((_i, el) => $(el).text().trim()).get();
  if (breadcrumbs.length >= 2) {
    enriched.location.province = breadcrumbs[breadcrumbs.length - 2] || null;
    enriched.location.city = breadcrumbs[breadcrumbs.length - 1] || null;
  }

  return enriched;
}
