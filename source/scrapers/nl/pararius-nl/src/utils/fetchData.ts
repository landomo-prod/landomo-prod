import axios, { AxiosError } from 'axios';
import * as cheerio from 'cheerio';
import { getRealisticHeaders } from './headers';
import { ParariusSearchResult, ParariusDetailData } from '../types/rawTypes';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const fetchDataWithRetry = async (
  url: string,
  headers: Record<string, string>,
  retries: number = 3
): Promise<string> => {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await axios.get(url, {
        headers,
        timeout: 30000,
        responseType: 'text',
      });
      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;
      if (axiosError.response?.status && axiosError.response.status >= 400 && axiosError.response.status < 500) {
        throw error;
      }
      if (attempt === retries - 1) throw error;
      const delayMs = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 1000, 10000);
      console.log(JSON.stringify({ level: 'info', service: 'pararius-scraper', msg: 'Retrying', attempt: attempt + 1, url }));
      await delay(delayMs);
    }
  }
  return '';
};

/**
 * Fetch search results from Pararius (HTML parsing)
 * Pararius is rental-focused: huurwoningen (rental apartments/houses)
 */
export async function fetchSearchPage(
  page: number,
  propertyType: 'appartement' | 'huis' = 'appartement'
): Promise<{ results: ParariusSearchResult[], hasNextPage: boolean }> {
  // Pararius URL pattern: /huurappartementen/ or /huurwoningen/ for rentals
  // Research confirmed: /huurwoningen/nederland/page-{N} works
  const typeSlug = propertyType === 'huis' ? 'huurwoningen' : 'huurappartementen';
  const url = page === 1
    ? `https://www.pararius.nl/${typeSlug}/nederland`
    : `https://www.pararius.nl/${typeSlug}/nederland/page-${page}`;

  const headers = getRealisticHeaders();
  const results: ParariusSearchResult[] = [];
  let hasNextPage = false;

  try {
    const html = await fetchDataWithRetry(url, headers, 3);
    const $ = cheerio.load(html);

    // Parse listing cards
    $('li.search-list__item--listing, section.listing-search-item').each((_, el) => {
      const $el = $(el);
      const link = $el.find('a.listing-search-item__link--title, a[href*="/huurappartementen/"], a[href*="/huurwoningen/"]').first();
      const href = link.attr('href') || '';
      const address = link.text().trim() || $el.find('.listing-search-item__title').text().trim();
      const city = $el.find('.listing-search-item__sub-title').text().trim();
      const priceText = $el.find('.listing-search-item__price').text().trim();
      const price = parseInt(priceText.replace(/[^0-9]/g, '')) || 0;
      const areaText = $el.find('.illustrated-features__description--surface-area, [class*="surface"]').text().trim();
      const area = parseInt(areaText.replace(/[^0-9]/g, '')) || undefined;
      const roomsText = $el.find('.illustrated-features__description--number-of-rooms, [class*="rooms"]').text().trim();
      const rooms = parseInt(roomsText.replace(/[^0-9]/g, '')) || undefined;
      const imgEl = $el.find('img').first();
      const imageUrl = imgEl.attr('src') || imgEl.attr('data-src') || undefined;

      if (href) {
        const id = href.replace(/\//g, '-').replace(/^-|-$/g, '') || `pararius-${Date.now()}-${Math.random()}`;
        results.push({
          id,
          url: href.startsWith('http') ? href : `https://www.pararius.nl${href}`,
          address,
          city,
          postalCode: '',
          price,
          area,
          rooms,
          propertyType: propertyType === 'huis' ? 'house' : 'apartment',
          imageUrl,
        });
      }
    });

    // Check for next page
    hasNextPage = $('a.pagination__link--next, a[rel="next"]').length > 0;

    return { results, hasNextPage };
  } catch (error: any) {
    console.error(JSON.stringify({ level: 'error', service: 'pararius-scraper', msg: 'Failed to fetch search page', page, err: error.message }));
    return { results: [], hasNextPage: false };
  }
}

/**
 * Fetch all listing pages
 */
export async function fetchAllListingPages(
  propertyType: 'appartement' | 'huis' = 'appartement'
): Promise<ParariusSearchResult[]> {
  const allListings: ParariusSearchResult[] = [];
  const seenIds = new Set<string>();
  const maxPages = parseInt(process.env.MAX_PAGES || '200');
  let page = 1;

  while (page <= maxPages) {
    console.log(JSON.stringify({ level: 'info', service: 'pararius-scraper', msg: 'Fetching page', page, propertyType }));

    const { results, hasNextPage } = await fetchSearchPage(page, propertyType);

    let newCount = 0;
    for (const r of results) {
      if (r.id && !seenIds.has(r.id)) {
        seenIds.add(r.id);
        allListings.push(r);
        newCount++;
      }
    }

    // Stop if no new results or no next page
    if (!hasNextPage || results.length === 0 || newCount === 0) break;

    page++;
    // Pararius rate limits aggressively - use 500-1000ms delays
    await delay(500 + Math.random() * 500);
  }

  console.log(JSON.stringify({ level: 'info', service: 'pararius-scraper', msg: 'Fetched total listings', propertyType, total: allListings.length }));
  return allListings;
}

/**
 * Fetch detail page for a single property
 */
export async function fetchPropertyDetail(url: string): Promise<ParariusDetailData | null> {
  const fullUrl = url.startsWith('http') ? url : `https://www.pararius.nl${url}`;
  const headers = getRealisticHeaders(fullUrl);

  try {
    const html = await fetchDataWithRetry(fullUrl, headers, 3);
    const $ = cheerio.load(html);

    const address = $('h1.listing-detail-summary__title').text().trim() || $('h1').first().text().trim();
    const city = $('.listing-detail-summary__location').text().trim();
    const priceText = $('.listing-detail-summary__price').text().trim();
    const price = parseInt(priceText.replace(/[^0-9]/g, '')) || 0;

    // Parse features table
    const features: string[] = [];
    const featureMap: Record<string, string> = {};
    $('.listing-features__list-item, .listing-features dt, dt').each((_, el) => {
      const label = $(el).text().trim().toLowerCase();
      const value = $(el).next('dd').text().trim();
      features.push(label);
      if (value) featureMap[label] = value;
    });

    const livingArea = parseInt(featureMap['woonoppervlakte'] || featureMap['oppervlakte'] || '') || undefined;
    const plotArea = parseInt(featureMap['perceeloppervlakte'] || '') || undefined;
    const rooms = parseInt(featureMap['kamers'] || featureMap['aantal kamers'] || '') || undefined;
    const bedrooms = parseInt(featureMap['slaapkamers'] || featureMap['aantal slaapkamers'] || '') || undefined;
    const bathrooms = parseInt(featureMap['badkamers'] || featureMap['aantal badkamers'] || '') || undefined;
    const yearBuilt = parseInt(featureMap['bouwjaar'] || '') || undefined;
    const energyLabel = featureMap['energielabel'] || undefined;

    const description = $('.listing-detail-description__content').text().trim() || '';

    const images: string[] = [];
    $('img[src*="pararius"], img[data-src*="pararius"], .listing-detail-media img').each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src');
      if (src && !src.includes('logo')) images.push(src);
    });

    const agentName = $('.agent-summary__title, .listing-detail-agent__name').text().trim() || undefined;

    const hasGarden = features.some(f => f.includes('tuin'));
    const hasGarage = features.some(f => f.includes('garage'));
    const hasBasement = features.some(f => f.includes('kelder') || f.includes('berging'));
    const hasBalcony = features.some(f => f.includes('balkon'));
    const hasElevator = features.some(f => f.includes('lift'));
    const hasParking = features.some(f => f.includes('parkeer') || f.includes('parking'));

    const propertyType = fullUrl.includes('huurwoningen') ? 'house' : 'apartment';

    // Try to extract coordinates from embedded map or JSON-LD
    let latitude: number | undefined;
    let longitude: number | undefined;
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const ld = JSON.parse($(el).text());
        if (ld.geo) {
          latitude = parseFloat(ld.geo.latitude);
          longitude = parseFloat(ld.geo.longitude);
        }
      } catch {}
    });

    const postalCode = featureMap['postcode'] || '';
    const depositText = featureMap['borg'] || featureMap['waarborgsom'] || '';
    const deposit = parseInt(depositText.replace(/[^0-9]/g, '')) || undefined;
    const availableFrom = featureMap['beschikbaar vanaf'] || featureMap['beschikbaar'] || undefined;
    const furnished = featureMap['interieur'] || featureMap['gemeubileerd'] || undefined;

    const id = fullUrl.match(/[\w-]+$/)?.[0] || fullUrl.replace(/\//g, '-');

    return {
      id,
      url: fullUrl,
      address,
      city,
      postalCode,
      price,
      currency: 'EUR',
      propertyType,
      livingArea,
      plotArea,
      rooms,
      bedrooms,
      bathrooms,
      hasGarden,
      hasGarage,
      hasBasement,
      hasBalcony,
      hasElevator,
      hasParking,
      energyLabel,
      yearBuilt,
      furnished,
      description,
      images,
      agentName,
      latitude,
      longitude,
      features,
      availableFrom,
      deposit,
    };
  } catch (error: any) {
    console.error(JSON.stringify({ level: 'error', service: 'pararius-scraper', msg: 'Failed to fetch detail', url: fullUrl, err: error.message }));
    return null;
  }
}
