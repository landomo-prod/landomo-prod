import axios from 'axios';
import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';
import { EnalquilerListingRaw, EnalquilerSearchConfig, EnalquilerSearchResult } from '../types/enalquilerTypes';

const BASE_URL = 'https://www.enalquiler.com';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

// Spanish provinces list for URL slugs → display name mapping
export const SPANISH_PROVINCES: Array<{ slug: string; display: string }> = [
  { slug: 'alava', display: 'Álava' },
  { slug: 'albacete', display: 'Albacete' },
  { slug: 'alicante', display: 'Alicante' },
  { slug: 'almeria', display: 'Almería' },
  { slug: 'asturias', display: 'Asturias' },
  { slug: 'avila', display: 'Ávila' },
  { slug: 'badajoz', display: 'Badajoz' },
  { slug: 'barcelona', display: 'Barcelona' },
  { slug: 'burgos', display: 'Burgos' },
  { slug: 'caceres', display: 'Cáceres' },
  { slug: 'cadiz', display: 'Cádiz' },
  { slug: 'cantabria', display: 'Cantabria' },
  { slug: 'castellon', display: 'Castellón' },
  { slug: 'ceuta', display: 'Ceuta' },
  { slug: 'ciudad-real', display: 'Ciudad Real' },
  { slug: 'cordoba', display: 'Córdoba' },
  { slug: 'cuenca', display: 'Cuenca' },
  { slug: 'girona', display: 'Girona' },
  { slug: 'granada', display: 'Granada' },
  { slug: 'guadalajara', display: 'Guadalajara' },
  { slug: 'guipuzcoa', display: 'Guipúzcoa' },
  { slug: 'huelva', display: 'Huelva' },
  { slug: 'huesca', display: 'Huesca' },
  { slug: 'islas-baleares', display: 'Islas Baleares' },
  { slug: 'jaen', display: 'Jaén' },
  { slug: 'la-coruna', display: 'La Coruña' },
  { slug: 'la-rioja', display: 'La Rioja' },
  { slug: 'las-palmas', display: 'Las Palmas' },
  { slug: 'leon', display: 'León' },
  { slug: 'lleida', display: 'Lleida' },
  { slug: 'lugo', display: 'Lugo' },
  { slug: 'madrid', display: 'Madrid' },
  { slug: 'malaga', display: 'Málaga' },
  { slug: 'melilla', display: 'Melilla' },
  { slug: 'murcia', display: 'Murcia' },
  { slug: 'navarra', display: 'Navarra' },
  { slug: 'ourense', display: 'Ourense' },
  { slug: 'palencia', display: 'Palencia' },
  { slug: 'pontevedra', display: 'Pontevedra' },
  { slug: 'salamanca', display: 'Salamanca' },
  { slug: 'santa-cruz-de-tenerife', display: 'Santa Cruz de Tenerife' },
  { slug: 'segovia', display: 'Segovia' },
  { slug: 'sevilla', display: 'Sevilla' },
  { slug: 'soria', display: 'Soria' },
  { slug: 'tarragona', display: 'Tarragona' },
  { slug: 'teruel', display: 'Teruel' },
  { slug: 'toledo', display: 'Toledo' },
  { slug: 'valencia', display: 'Valencia' },
  { slug: 'valladolid', display: 'Valladolid' },
  { slug: 'vizcaya', display: 'Vizcaya' },
  { slug: 'zamora', display: 'Zamora' },
  { slug: 'zaragoza', display: 'Zaragoza' },
];

// Property type configs
// URL pattern: /alquiler-{typeSlug}-{province}-30-{typeId}-0.html
// Page 2+: /alquiler-{typeSlug}-{province}-30-{typeId}-0/{pageNum}
// Exception: pisos main page is /pisos-alquiler-{province}.html (all types)
// Type IDs: 2=Piso, 3=Atico, 4=Duplex, 5=Loft, 6=Estudio, 7=Casa/Chalet
export const PROPERTY_TYPES = [
  { typeSlug: 'pisos', typeId: 2, propertyType: 'pisos' },
  { typeSlug: 'aticos', typeId: 3, propertyType: 'aticos' },
  { typeSlug: 'casas', typeId: 7, propertyType: 'casas' },
];

export function buildSearchUrl(config: EnalquilerSearchConfig, page: number): string {
  const base = `${BASE_URL}/alquiler-${config.propertyType}-${config.province}-30-${config.estateTypeId}-0.html`;
  if (page <= 1) return base;
  return `${BASE_URL}/alquiler-${config.propertyType}-${config.province}-30-${config.estateTypeId}-0/${page}`;
}

export function buildDetailUrl(href: string): string {
  if (href.startsWith('http')) return href;
  return `${BASE_URL}${href}`;
}

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'es-ES,es;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Referer': 'https://www.enalquiler.com/',
};

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function fetchSearchPage(
  config: EnalquilerSearchConfig,
  page: number
): Promise<EnalquilerSearchResult> {
  const url = buildSearchUrl(config, page);

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await sleep(300 + Math.random() * 400);

      const response = await axios.get(url, {
        headers: HEADERS,
        timeout: 30000,
        validateStatus: (status) => status < 500,
      });

      if (response.status === 404) {
        return { totalListings: 0, totalPages: 0, listings: [] };
      }

      if (response.status !== 200) {
        throw new Error(`HTTP ${response.status} for ${url}`);
      }

      const $ = cheerio.load(response.data);
      return parseSearchPage($, config);

    } catch (error: any) {
      if (attempt === MAX_RETRIES) throw error;
      console.error(JSON.stringify({ level: 'warn', service: 'enalquiler-scraper', msg: 'Retry search page', url, attempt, err: error.message }));
      await sleep(RETRY_DELAY_MS * attempt);
    }
  }

  return { totalListings: 0, totalPages: 0, listings: [] };
}

function parseSearchPage($: cheerio.CheerioAPI, config: EnalquilerSearchConfig): EnalquilerSearchResult {
  const listings: EnalquilerListingRaw[] = [];

  // Extract total listing count from heading e.g. "4.816 Pisos en Madrid"
  let totalListings = 0;
  $('h1, .search-title, .results-title').each((_i, el) => {
    const text = $(el).text().trim();
    const match = text.match(/([\d.]+)\s+(?:Pisos|Casas|Áticos|Locales|Propiedades)/i);
    if (match && totalListings === 0) {
      totalListings = parseInt(match[1].replace(/\./g, ''), 10);
    }
  });

  // Determine total pages from pagination
  let totalPages = totalListings > 0 ? Math.ceil(totalListings / 15) : 0;
  const lastPageLink = $('ul.pagination li a').last().attr('href');
  if (lastPageLink) {
    const pageMatch = lastPageLink.match(/\/(\d+)$/);
    if (pageMatch) {
      const lastPage = parseInt(pageMatch[1], 10);
      if (!isNaN(lastPage) && lastPage > totalPages) totalPages = lastPage;
    }
  }

  // Parse property cards
  $('li[list-item]').each((_i, el) => {
    try {
      const $el = $(el);
      const listing = parseListingCard($, $el, config);
      if (listing) listings.push(listing);
    } catch (_err) {
      // Skip malformed cards
    }
  });

  return { totalListings, totalPages, listings };
}

function parseListingCard(
  $: cheerio.CheerioAPI,
  $el: cheerio.Cheerio<Element>,
  config: EnalquilerSearchConfig
): EnalquilerListingRaw | null {
  // Property ID from list-item attribute
  const id = $el.attr('list-item');
  if (!id) return null;

  // Detail URL from the title link
  const titleLink = $el.find('a[itemprop="url"]');
  const href = titleLink.attr('href') || '';
  const url = href ? buildDetailUrl(href) : `${BASE_URL}/property_${id}.html`;

  // Title
  const title = (titleLink.find('p[itemprop="name"]').text().trim() ||
                 titleLink.attr('title') || '').trim();

  // Price
  const priceText = $el.find('.propertyCard__price--value').first().text().trim();
  const price = priceText ? parseFloat(priceText.replace(/[^\d]/g, '')) : null;

  // Details: sqm, rooms, bathrooms
  let sqm: number | null = null;
  let rooms: number | null = null;
  let bathrooms: number | null = null;

  $el.find('.propertyCard__details li').each((_i, li) => {
    const text = $(li).text().trim();
    const sqmMatch = text.match(/([\d.,]+)\s*m/);
    const roomsMatch = text.match(/(\d+)\s*Hab/i);
    const bathMatch = text.match(/(\d+)\s*Baño/i);
    if (sqmMatch && sqm === null) sqm = parseFloat(sqmMatch[1].replace(',', '.'));
    if (roomsMatch && rooms === null) rooms = parseInt(roomsMatch[1], 10);
    if (bathMatch && bathrooms === null) bathrooms = parseInt(bathMatch[1], 10);
  });

  // Location
  const locationText = $el.find('.propertyCard__location p').first().text().trim();

  // Images from carousel
  const images: string[] = [];
  const imagesPath = $el.find('.propertyCard__carousel').first().attr('images-path');
  if (imagesPath) {
    // Base image with different sizes
    images.push(imagesPath.replace('{width}', 'or'));
  }
  // Additional images from source elements
  $el.find('picture source').each((_i, src) => {
    const srcset = $(src).attr('srcset');
    if (srcset && !images.includes(srcset) && srcset.includes('or.jpg')) {
      images.push(srcset);
    }
  });

  // Agency name
  const agencyName = $el.find('.propertyCard__actions--brand').attr('title') || null;

  // Description
  const description = $el.find('.propertyCard__description--txt').text().trim() || null;

  return {
    id,
    url,
    title: title || `Property ${id}`,
    price: price && !isNaN(price) ? price : null,
    currency: 'EUR',
    propertyType: config.propertyType,
    estateTypeId: config.estateTypeId,
    sqm,
    rooms,
    bathrooms,
    floor: null,
    description,
    location: {
      address: null,
      city: locationText || config.provinceDisplay,
      province: config.provinceDisplay,
      district: null,
      lat: null,
      lng: null,
    },
    images: [...new Set(images)],
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
    isFurnished: null,
  };
}

export interface DetailResult {
  data: EnalquilerListingRaw;
  isInactive: boolean;
  inactiveReason?: string;
}

export async function fetchDetailPage(listing: EnalquilerListingRaw): Promise<DetailResult> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await sleep(400 + Math.random() * 600);

      const response = await axios.get(listing.url, {
        headers: HEADERS,
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

      // Check if listing is marked as inactive/removed
      const isRemoved = $('[class*="property-removed"], [class*="property-inactive"]').length > 0;
      if (isRemoved) {
        return { data: listing, isInactive: true, inactiveReason: 'removed' };
      }

      const enriched = enrichFromDetail($, listing);
      return { data: enriched, isInactive: false };

    } catch (error: any) {
      if (attempt === MAX_RETRIES) throw error;
      await sleep(RETRY_DELAY_MS * attempt);
    }
  }

  throw new Error(`Failed to fetch detail for ${listing.url}`);
}

function enrichFromDetail($: cheerio.CheerioAPI, listing: EnalquilerListingRaw): EnalquilerListingRaw {
  const enriched = { ...listing };

  // Description
  const desc = $('[itemprop="description"], .property-description, .description').first().text().trim();
  if (desc && desc.length > (enriched.description?.length || 0)) {
    enriched.description = desc;
  }

  // Price from detail page (more accurate)
  const priceText = $('.priceBlock__price').first().text().trim();
  if (priceText) {
    const p = parseFloat(priceText.replace(/[^\d]/g, ''));
    if (!isNaN(p) && p > 0) enriched.price = p;
  }

  // Features from characteristics block
  const features: string[] = [];
  $('.property-characteristics-block-list li').each((_i, el) => {
    const $el = $(el);
    // Only include active features (not disabled/crossed-out ones)
    if (!$el.hasClass('disabled') && !$el.hasClass('line-throught')) {
      const text = $el.text().trim();
      if (text) features.push(text);
    }
  });
  enriched.features = features;

  // Parse features for amenities
  const allText = features.join(' ').toLowerCase();

  enriched.hasElevator = allText.includes('ascensor') || allText.includes('elevador');
  enriched.hasParking = allText.includes('parking') || allText.includes('aparcamiento') || allText.includes('garaje');
  enriched.hasGarden = allText.includes('jardín') || allText.includes('jardin');
  enriched.hasPool = allText.includes('piscina');
  enriched.hasTerrace = allText.includes('terraza');
  enriched.hasBalcony = allText.includes('balcón') || allText.includes('balcon');
  enriched.hasBasement = allText.includes('trastero') || allText.includes('sótano') || allText.includes('sotano');
  enriched.hasGarage = allText.includes('garaje') || allText.includes('cochera');
  enriched.hasAirConditioning = allText.includes('aire acondicionado') || allText.includes('climatización') || allText.includes('climatizacion');
  enriched.isFurnished = allText.includes('amueblado') || allText.includes('con muebles');

  // Check disabled features too for explicit negation
  $('.property-characteristics-block-list li.disabled').each((_i, el) => {
    const text = $(el).text().trim().toLowerCase();
    if (text.includes('ascensor') && enriched.hasElevator === null) enriched.hasElevator = false;
    if ((text.includes('garaje') || text.includes('parking')) && enriched.hasParking === null) enriched.hasParking = false;
    if (text.includes('jardín') && enriched.hasGarden === null) enriched.hasGarden = false;
    if (text.includes('piscina') && enriched.hasPool === null) enriched.hasPool = false;
    if (text.includes('terraza') && enriched.hasTerrace === null) enriched.hasTerrace = false;
    if (text.includes('balcón') && enriched.hasBalcony === null) enriched.hasBalcony = false;
    if (text.includes('trastero') && enriched.hasBasement === null) enriched.hasBasement = false;
  });

  // Condition
  if (allText.includes('obra nueva') || allText.includes('a estrenar')) {
    enriched.condition = 'new_build';
  } else if (allText.includes('reformado') || allText.includes('renovado')) {
    enriched.condition = 'renovated';
  } else if (allText.includes('a reformar') || allText.includes('para reformar')) {
    enriched.condition = 'needs_renovation';
  } else if (allText.includes('buen estado')) {
    enriched.condition = 'good';
  }

  // Floor
  $('[class*="characteristic"], .detail-info li, [class*="feature"]').each((_i, el) => {
    const text = $(el).text().trim();
    const floorMatch = text.match(/planta\s+(\d+)|(\d+)[ªº]?\s*planta/i);
    if (floorMatch && enriched.floor === null) {
      enriched.floor = floorMatch[1] || floorMatch[2];
    }
    if (/planta baja|bajo/i.test(text)) enriched.floor = '0';
  });

  // SQM enrichment from detail
  $('[class*="characteristic"], .detail-info li, [class*="feature"]').each((_i, el) => {
    const text = $(el).text().trim();
    const sqmMatch = text.match(/([\d.,]+)\s*m²/);
    if (sqmMatch && enriched.sqm === null) {
      enriched.sqm = parseFloat(sqmMatch[1].replace('.', '').replace(',', '.'));
    }
    const plotMatch = text.match(/parcela.*?([\d.,]+)\s*m²/i) || text.match(/([\d.,]+)\s*m².*?parcela/i);
    if (plotMatch && enriched.plotSize === null) {
      enriched.plotSize = parseFloat(plotMatch[1].replace('.', '').replace(',', '.'));
    }
  });

  // Rooms / bathrooms from detail features
  for (const feat of features) {
    const roomMatch = feat.match(/(\d+)\s*(?:habitaci|dormitorio)/i);
    if (roomMatch && enriched.rooms === null) enriched.rooms = parseInt(roomMatch[1], 10);
    const bathMatch = feat.match(/(\d+)\s*baño/i);
    if (bathMatch && enriched.bathrooms === null) enriched.bathrooms = parseInt(bathMatch[1], 10);
  }

  // Energy certificate
  const energyText = $('[class*="energy"], [class*="certificado"]').first().text().trim();
  if (energyText) {
    const certMatch = energyText.match(/[A-G]/);
    if (certMatch) enriched.energyCertificate = certMatch[0].toUpperCase();
  }

  // GPS coordinates from page scripts
  const bodyHtml = $.html();
  const latMatch = bodyHtml.match(/"lat(?:itude)?"\s*:\s*([-\d.]+)/);
  const lngMatch = bodyHtml.match(/"(?:lng|lon(?:gitude)?)"\s*:\s*([-\d.]+)/);
  if (latMatch && lngMatch) {
    enriched.location.lat = parseFloat(latMatch[1]);
    enriched.location.lng = parseFloat(lngMatch[1]);
  }

  // Agency phone
  const phone = $('[href^="tel:"]').first().attr('href');
  if (phone) enriched.agencyPhone = phone.replace('tel:', '');

  // Agency name from detail
  const agencyName = $('[class*="microsite-name"], [class*="agency-name"], .brand-name').first().text().trim();
  if (agencyName && !enriched.agencyName) enriched.agencyName = agencyName;

  // Location enrichment from breadcrumbs
  const breadcrumbs = $('[class*="breadcrumb"] li, [itemtype*="BreadcrumbList"] [itemprop="name"]')
    .map((_i, el) => $(el).text().trim())
    .get()
    .filter(t => t.length > 0);

  if (breadcrumbs.length >= 2 && !enriched.location.city) {
    enriched.location.city = breadcrumbs[breadcrumbs.length - 1];
    if (breadcrumbs.length >= 3) {
      enriched.location.province = breadcrumbs[breadcrumbs.length - 2];
    }
  }

  // Year built
  for (const feat of features) {
    const yearMatch = feat.match(/(?:año|construido|construcción).*?(\d{4})/i);
    if (yearMatch) {
      const year = parseInt(yearMatch[1], 10);
      if (year >= 1800 && year <= 2030) enriched.yearBuilt = year;
    }
  }

  // Additional images from detail gallery
  const detailImages: string[] = [...enriched.images];
  $('[class*="gallery"] img, [class*="slider"] img, [class*="carousel"] img').each((_i, img) => {
    const src = $(img).attr('src') || $(img).attr('data-src');
    if (src && !src.includes('placeholder') && !src.includes('logo') && !detailImages.includes(src)) {
      detailImages.push(src);
    }
  });
  if (detailImages.length > enriched.images.length) enriched.images = detailImages;

  return enriched;
}
