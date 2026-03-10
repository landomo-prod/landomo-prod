import axios from 'axios';
import * as cheerio from 'cheerio';
import { PisosListingRaw, PisosDetailRaw, SearchConfig } from '../types/pisosTypes';
import { getRealisticHeaders, getRandomDelay } from './headers';
import { pisosRateLimiter } from './rateLimiter';
import { parseSpanishNumber, parseSpanishPrice, parseFloor } from '../../../shared/spanish-value-mappings';
import { extractPortalId, buildUrl } from './pisosHelpers';

const BASE_URL = 'https://www.pisos.com';

/**
 * Fetch a single search results page and parse listings
 */
export async function fetchSearchPage(
  config: SearchConfig,
  provinceSlug: string,
  page: number
): Promise<{ listings: PisosListingRaw[]; hasNextPage: boolean; totalResults: number }> {
  await pisosRateLimiter.throttle();
  await new Promise(resolve => setTimeout(resolve, getRandomDelay(200, 600)));

  const pageSuffix = page > 1 ? `${page}/` : '';
  const url = `${BASE_URL}/${config.transactionSlug}/${config.typeSlug}-${provinceSlug}/${pageSuffix}`;

  const headers = getRealisticHeaders();
  const response = await axios.get(url, {
    headers,
    timeout: 30000,
    validateStatus: (status) => status < 500,
  });

  if (response.status === 404 || response.status === 301) {
    return { listings: [], hasNextPage: false, totalResults: 0 };
  }

  const $ = cheerio.load(response.data);
  const listings: PisosListingRaw[] = [];

  // Parse total results from pagination counter
  let totalResults = 0;
  const counterText = $('.pagination__counter').last().text();
  const totalMatch = counterText.match(/de\s+([\d.]+)\s+resultado/);
  if (totalMatch) {
    totalResults = parseInt(totalMatch[1].replace(/\./g, ''), 10);
  }

  // Parse each listing card
  $('.ad-preview').each((_, el) => {
    const $el = $(el);

    const titleEl = $el.find('.ad-preview__title');
    const title = titleEl.text().trim();
    const detailUrl = titleEl.attr('href') || '';
    const dataId = $el.attr('data-id') || '';

    if (!title || !detailUrl) return;

    const subtitle = $el.find('.ad-preview__subtitle').text().trim();
    const priceText = $el.find('.ad-preview__price').text().trim();
    const descText = $el.find('.ad-preview__description').text().trim();

    // Parse characteristics (e.g., "3 habs.", "2 baños", "106 m²", "2ª planta")
    let bedrooms: number | null = null;
    let bathrooms: number | null = null;
    let sqm: number | null = null;
    let floor: string | null = null;

    $el.find('.ad-preview__char').each((_, charEl) => {
      const text = $(charEl).text().trim();
      if (text.includes('hab')) {
        const match = text.match(/(\d+)/);
        if (match) bedrooms = parseInt(match[1], 10);
      } else if (text.includes('bañ') || text.includes('ban')) {
        const match = text.match(/(\d+)/);
        if (match) bathrooms = parseInt(match[1], 10);
      } else if (text.includes('m²') || text.includes('m2')) {
        sqm = parseSpanishNumber(text.replace(/m[²2]/, '').trim());
      } else if (text.includes('planta') || text.includes('bajo') || text.includes('sótano')) {
        floor = text;
      }
    });

    // Parse image
    const imgEl = $el.find('img').first();
    const imageUrl = imgEl.attr('src') || imgEl.attr('data-src') || null;

    // Extract property type slug from detail URL
    const slugMatch = detailUrl.match(/\/(?:comprar|alquilar)\/([a-z_]+)-/);
    const propertyTypeSlug = slugMatch ? slugMatch[1] : config.typeSlug;

    listings.push({
      portalId: extractPortalId(detailUrl, dataId),
      detailUrl,
      title,
      subtitle,
      price: parseSpanishPrice(priceText),
      bedrooms,
      bathrooms,
      sqm,
      floor,
      description: descText || null,
      imageUrl,
      propertyTypeSlug,
    });
  });

  // Check for next page
  const hasNextPage = $('.pagination__next').length > 0 && listings.length > 0;

  return { listings, hasNextPage, totalResults };
}

/**
 * Fetch all pages for a search config + province
 */
export async function fetchAllSearchPages(
  config: SearchConfig,
  provinceSlug: string,
  maxPages: number = 50
): Promise<PisosListingRaw[]> {
  const allListings: PisosListingRaw[] = [];

  for (let page = 1; page <= maxPages; page++) {
    const { listings, hasNextPage } = await fetchSearchPage(config, provinceSlug, page);
    allListings.push(...listings);

    if (!hasNextPage || listings.length === 0) break;
  }

  return allListings;
}

/**
 * Fetch detail page and parse full property data
 */
export async function fetchDetailPage(detailUrl: string): Promise<PisosDetailRaw | null> {
  await pisosRateLimiter.throttle();
  await new Promise(resolve => setTimeout(resolve, getRandomDelay(100, 400)));

  const url = buildUrl(detailUrl);
  const headers = getRealisticHeaders();

  const response = await axios.get(url, {
    headers,
    timeout: 30000,
    validateStatus: (status) => status < 500,
  });

  if (response.status === 404 || response.status === 410) {
    return null;
  }

  const $ = cheerio.load(response.data);

  // Price
  const priceText = $('.jsPriceValue').first().text().trim();
  const price = parseSpanishPrice(priceText);

  // Title
  const title = $('h1').first().text().trim();

  // Price per sqm from features summary
  let pricePerSqm: number | null = null;
  const features: string[] = [];
  const featuresSummary: string[] = [];

  $('.features-summary__item').each((_, el) => {
    const text = $(el).text().trim();
    featuresSummary.push(text);
    if (text.includes('€/m²')) {
      pricePerSqm = parseSpanishNumber(text.replace('€/m²', '').trim());
    }
  });

  // Features from detail sections
  $('.details__block li, .details__block .charblock-right, .charblock__right').each((_, el) => {
    const text = $(el).text().trim();
    if (text) features.push(text);
  });

  // Location
  const locationData = $('.location').first().attr('data-params') || '';
  let latitude: number | null = null;
  let longitude: number | null = null;
  const latMatch = locationData.match(/latitude=([\d.-]+)/);
  const lngMatch = locationData.match(/longitude=([\d.-]+)/);
  if (latMatch) latitude = parseFloat(latMatch[1]);
  if (lngMatch) longitude = parseFloat(lngMatch[1]);

  const subtitleEl = $('h1').next('p');
  const locationText = subtitleEl.text().trim();
  const neighborhood = locationText.split('(')[0]?.trim() || null;
  const cityMatch = locationText.match(/\(([^)]+)\)/);
  const city = cityMatch ? cityMatch[1].split('.').pop()?.trim() || null : null;

  // Description
  const description = $('.details__block p, .description__text').filter((_, el) => {
    const text = $(el).text().trim();
    return text.length > 50;
  }).first().text().trim() || null;

  // Energy certificate
  const energyText = $('.energy-certificate p').first().text().trim();
  const energyMatch = energyText.match(/Clasificación:\s*(.+)/);
  const energyCertificate = energyMatch ? energyMatch[1].trim() : null;

  // Last updated
  const lastUpdateText = $('.last-update__date').text().trim();
  const dateMatch = lastUpdateText.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  const lastUpdated = dateMatch ? `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}` : null;

  // Images
  const images: string[] = [];
  $('img[src*="fotos.imghs.net"], img[data-src*="fotos.imghs.net"]').each((_, el) => {
    const src = $(el).attr('src') || $(el).attr('data-src');
    if (src && !images.includes(src)) images.push(src);
  });

  // Agent info
  const contactEl = $('.js-contactInfo').first();
  const agentPhone = contactEl.find('.callBtn').attr('data-number') || null;
  const agentName = contactEl.find('.professional__name, .contact__name').text().trim() || null;

  // New development flag
  const isNewDevelopment = contactEl.attr('data-is-newdevelopment') === 'True';

  // Portal ID from ad data
  const portalId = contactEl.attr('data-ad-id') || extractPortalId(detailUrl);

  return {
    portalId,
    title,
    price,
    pricePerSqm,
    location: {
      address: title,
      neighborhood,
      city,
      latitude,
      longitude,
    },
    features,
    featuresSummary,
    description,
    energyCertificate,
    lastUpdated,
    images,
    agentName,
    agentPhone,
    isNewDevelopment,
    sourceUrl: url,
  };
}
