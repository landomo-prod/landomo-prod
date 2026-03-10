import axios from 'axios';
import * as cheerio from 'cheerio';
import pLimit from 'p-limit';
import { getRealisticHeaders, getRandomDelay } from '../utils/headers';
import { adresowoRateLimiter } from '../utils/rateLimiter';

const BASE_URL = 'https://www.adresowo.pl';
const CONCURRENT_DETAILS = parseInt(process.env.CONCURRENT_DETAILS || '10');

export interface AdresowoDetailData {
  title: string;
  description: string;
  price: number | null;
  currency: string;
  area: number | null;
  rooms: number | null;
  floor: number | null;
  totalFloors: number | null;
  yearBuilt: number | null;
  address: string;
  city: string;
  district: string;
  street: string;
  latitude: number | null;
  longitude: number | null;
  images: string[];
  features: Record<string, string>;  // key-value pairs from the detail table
  agentName: string | null;
  agentPhone: string | null;
  sourceUrl: string;
}

export interface DetailFetchResult {
  portalId: string;
  detail?: AdresowoDetailData;
  error?: string;
}

/**
 * Fetch and parse a single listing detail page from adresowo.pl
 */
async function fetchDetail(portalId: string, relativeUrl: string): Promise<DetailFetchResult> {
  const url = `${BASE_URL}${relativeUrl}`;

  try {
    await adresowoRateLimiter.throttle();
    await new Promise(resolve => setTimeout(resolve, getRandomDelay(200, 800)));

    const headers = getRealisticHeaders();
    const response = await axios.get(url, {
      headers,
      timeout: 30000,
      validateStatus: (status) => status < 500,
    });

    if (response.status === 404 || response.status === 410) {
      return { portalId, error: `HTTP ${response.status}` };
    }

    if (response.status !== 200) {
      return { portalId, error: `HTTP ${response.status}` };
    }

    const $ = cheerio.load(response.data);

    // Extract title
    const title = $('h1').first().text().trim() || $('title').text().trim();

    // Extract description
    const description = $('[class*="description"], [class*="opis"], [id*="description"]')
      .first().text().trim() || '';

    // Extract features from detail tables (key-value rows)
    const features: Record<string, string> = {};
    $('table tr, dl dt, [class*="param"], [class*="detail"] li').each((_, el) => {
      const $el = $(el);
      const label = $el.find('td:first-child, dt, [class*="label"], [class*="name"]').text().trim().toLowerCase();
      const value = $el.find('td:last-child, dd, [class*="value"]').text().trim();
      if (label && value && label !== value) {
        features[label] = value;
      }
    });

    // Extract price
    let price: number | null = null;
    const priceText = $('[class*="price"], [class*="cena"]').first().text();
    const priceMatch = priceText.match(/([\d\s]+)\s*(?:zł|PLN)/i);
    if (priceMatch) {
      price = parseInt(priceMatch[1].replace(/\s/g, ''), 10);
    }

    // Extract area
    let area: number | null = null;
    const areaFeature = features['powierzchnia'] || features['pow.'] || features['metraż'];
    if (areaFeature) {
      const areaMatch = areaFeature.match(/([\d,\.]+)/);
      if (areaMatch) area = parseFloat(areaMatch[1].replace(',', '.'));
    }

    // Extract rooms
    let rooms: number | null = null;
    const roomsFeature = features['pokoje'] || features['liczba pokoi'] || features['pokoi'];
    if (roomsFeature) {
      const roomsMatch = roomsFeature.match(/(\d+)/);
      if (roomsMatch) rooms = parseInt(roomsMatch[1], 10);
    }

    // Extract floor
    let floor: number | null = null;
    let totalFloors: number | null = null;
    const floorFeature = features['piętro'] || features['kondygnacja'];
    if (floorFeature) {
      const floorParts = floorFeature.match(/(\d+)\s*(?:\/\s*(\d+))?/);
      if (floorParts) {
        floor = parseInt(floorParts[1], 10);
        if (floorParts[2]) totalFloors = parseInt(floorParts[2], 10);
      }
    }

    // Extract year built
    let yearBuilt: number | null = null;
    const yearFeature = features['rok budowy'] || features['rok'];
    if (yearFeature) {
      const yearMatch = yearFeature.match(/(19|20)\d{2}/);
      if (yearMatch) yearBuilt = parseInt(yearMatch[0], 10);
    }

    // Extract address components from breadcrumbs or header
    const breadcrumbs = $('[class*="breadcrumb"] a, nav a').map((_, el) => $(el).text().trim()).get();
    const city = breadcrumbs.find(b => b.length > 2 && !['Strona główna', 'Mieszkania', 'Domy', 'Działki', 'Lokale'].includes(b)) || '';
    const district = features['dzielnica'] || '';
    const street = features['ulica'] || '';
    const address = [street, district, city].filter(Boolean).join(', ');

    // Extract GPS from any embedded map data or structured data
    let latitude: number | null = null;
    let longitude: number | null = null;
    const scriptTags = $('script[type="application/ld+json"]').map((_, el) => $(el).html()).get();
    for (const script of scriptTags) {
      try {
        const json = JSON.parse(script || '');
        if (json.geo) {
          latitude = parseFloat(json.geo.latitude);
          longitude = parseFloat(json.geo.longitude);
        }
        if (json['@type'] === 'Place' && json.geo) {
          latitude = parseFloat(json.geo.latitude);
          longitude = parseFloat(json.geo.longitude);
        }
      } catch {}
    }

    // Extract images
    const images: string[] = [];
    $('img[src*="img"], img[data-src*="img"], [class*="gallery"] img, [class*="slider"] img').each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src') || '';
      if (src && !src.includes('logo') && !src.includes('avatar') && !src.includes('icon')) {
        const fullUrl = src.startsWith('http') ? src : `${BASE_URL}${src}`;
        if (!images.includes(fullUrl)) {
          images.push(fullUrl);
        }
      }
    });

    // Extract agent info
    const agentName = $('[class*="agent"] [class*="name"], [class*="kontakt"] [class*="name"]').first().text().trim() || null;
    const agentPhone = $('[class*="phone"], a[href^="tel:"]').first().text().trim() || null;

    return {
      portalId,
      detail: {
        title,
        description,
        price,
        currency: 'PLN',
        area,
        rooms,
        floor,
        totalFloors,
        yearBuilt,
        address,
        city,
        district,
        street,
        latitude,
        longitude,
        images,
        features,
        agentName,
        agentPhone,
        sourceUrl: url,
      },
    };
  } catch (error: any) {
    return { portalId, error: error.message };
  }
}

/**
 * Fetch details for multiple listings with bounded concurrency
 */
export async function fetchDetailsBatch(
  listings: Array<{ portalId: string; url: string }>,
  onProgress?: (current: number, total: number) => void
): Promise<Map<string, DetailFetchResult>> {
  const limit = pLimit(CONCURRENT_DETAILS);
  const results = new Map<string, DetailFetchResult>();
  let completed = 0;

  const tasks = listings.map(listing =>
    limit(async () => {
      const result = await fetchDetail(listing.portalId, listing.url);
      results.set(listing.portalId, result);

      completed++;
      if (onProgress && completed % 50 === 0) {
        onProgress(completed, listings.length);
      }
    })
  );

  await Promise.all(tasks);
  return results;
}
