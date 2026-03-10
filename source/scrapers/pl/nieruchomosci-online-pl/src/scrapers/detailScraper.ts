import axios from 'axios';
import * as cheerio from 'cheerio';
import { getRealisticHeaders } from '../utils/headers';

export interface RawDetailData {
  id: string;
  title: string;
  description: string;
  price: number | null;
  pricePerSqm: number | null;
  currency: string;
  area: number | null;
  rooms: number | null;
  floor: number | null;
  totalFloors: number | null;
  yearBuilt: number | null;
  propertyCategory: 'apartment' | 'house' | 'land' | 'commercial';
  transactionType: 'sale' | 'rent';
  location: {
    city: string | null;
    district: string | null;
    street: string | null;
    voivodeship: string | null;
    lat: number | null;
    lng: number | null;
  };
  features: string[];
  images: string[];
  agent: {
    name: string | null;
    phone: string | null;
    agency: string | null;
  };
  sourceUrl: string;
  // Raw HTML attributes for portal_metadata
  rawAttributes: Record<string, string>;
}

/**
 * Fetch and parse a property detail page
 */
export async function fetchDetailPage(
  url: string,
  propertyCategory: 'apartment' | 'house' | 'land' | 'commercial',
  transactionType: 'sale' | 'rent',
): Promise<RawDetailData | null> {
  const response = await axios.get(url, {
    headers: getRealisticHeaders(),
    timeout: 30000,
  });

  const $ = cheerio.load(response.data);
  return parseDetailPage($, url, propertyCategory, transactionType);
}

function parseDetailPage(
  $: cheerio.CheerioAPI,
  sourceUrl: string,
  propertyCategory: 'apartment' | 'house' | 'land' | 'commercial',
  transactionType: 'sale' | 'rent',
): RawDetailData | null {
  const id = extractIdFromUrl(sourceUrl);
  if (!id) return null;

  // Title
  const title = $('h1, .offer-title, [class*="title"]').first().text().trim() || '';

  // Description
  const description = $('[class*="description"], .offer-description, #description, .opis').first().text().trim() || '';

  // Price
  const priceText = $('[class*="price"]:not([class*="per"]), .offer-price').first().text().trim();
  const price = parsePolishPrice(priceText);

  // Price per sqm
  const pricePerSqmText = $('[class*="price-per"], [class*="cena-za"]').first().text().trim();
  const pricePerSqm = parsePolishPrice(pricePerSqmText);

  // Collect all key-value attributes from detail tables
  const rawAttributes: Record<string, string> = {};
  $('table tr, .detail-item, .param-item, [class*="param"], dl dt, dl dd').each((_, el) => {
    const $el = $(el);
    const label = $el.find('th, .label, dt').first().text().trim().toLowerCase();
    const value = $el.find('td, .value, dd').first().text().trim();
    if (label && value) {
      rawAttributes[label] = value;
    }
  });

  // Also try key:value patterns in list items
  $('li, .attribute, .feature-item').each((_, el) => {
    const text = $(el).text().trim();
    const match = text.match(/^([^:]+):\s*(.+)$/);
    if (match) {
      rawAttributes[match[1].trim().toLowerCase()] = match[2].trim();
    }
  });

  // Area
  const area = parseNumericAttr(rawAttributes, ['powierzchnia', 'pow.', 'area', 'metraż', 'powierzchnia użytkowa'])
    || parseAreaFromText($('body').text());

  // Rooms
  const rooms = parseIntAttr(rawAttributes, ['pokoje', 'liczba pokoi', 'pokoi', 'rooms', 'l. pokoi']);

  // Floor
  const floor = parseIntAttr(rawAttributes, ['piętro', 'floor', 'kondygnacja']);

  // Total floors
  const totalFloors = parseIntAttr(rawAttributes, ['piętrowość', 'liczba pięter', 'pięter w budynku', 'floors']);

  // Year built
  const yearBuilt = parseIntAttr(rawAttributes, ['rok budowy', 'year built', 'rok']);

  // Location
  const locationText = $('[class*="location"], .address, .breadcrumb, [class*="adres"]').text().trim();
  const location = parseLocation(locationText, rawAttributes);

  // Try to extract coordinates from scripts or data attributes
  const lat = extractCoordinate($, 'lat');
  const lng = extractCoordinate($, 'lng');
  location.lat = lat;
  location.lng = lng;

  // Features
  const features: string[] = [];
  $('[class*="feature"], [class*="cecha"], .amenity, .equipment-item').each((_, el) => {
    const text = $(el).text().trim();
    if (text && text.length < 100) {
      features.push(text);
    }
  });

  // Images
  const images: string[] = [];
  $('img[data-src*="nieruchomosci"], img[src*="foto"], img[src*="image"], [class*="gallery"] img, [class*="slider"] img').each((_, el) => {
    const src = $(el).attr('data-src') || $(el).attr('src');
    if (src && !src.includes('logo') && !src.includes('avatar')) {
      images.push(src.startsWith('http') ? src : `https://www.nieruchomosci-online.pl${src}`);
    }
  });

  // Agent
  const agentName = $('[class*="agent-name"], [class*="contact-name"], .agent .name').first().text().trim() || null;
  const agentPhone = $('[class*="phone"], [href^="tel:"]').first().text().trim() || null;
  const agentAgency = $('[class*="agency"], [class*="biuro"], .agent .company').first().text().trim() || null;

  return {
    id,
    title,
    description,
    price,
    pricePerSqm,
    currency: 'PLN',
    area,
    rooms,
    floor,
    totalFloors,
    yearBuilt,
    propertyCategory,
    transactionType,
    location,
    features,
    images: [...new Set(images)], // deduplicate
    agent: { name: agentName, phone: agentPhone, agency: agentAgency },
    sourceUrl,
    rawAttributes,
  };
}

function extractIdFromUrl(url: string): string | null {
  const match = url.match(/(\d{4,})/);
  return match ? match[1] : null;
}

function parsePolishPrice(text: string): number | null {
  if (!text) return null;
  const cleaned = text.replace(/[^\d,.\s]/g, '').replace(/\s/g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function parseNumericAttr(attrs: Record<string, string>, keys: string[]): number | null {
  for (const key of keys) {
    for (const [k, v] of Object.entries(attrs)) {
      if (k.includes(key)) {
        const match = v.match(/([\d,.]+)/);
        if (match) {
          const num = parseFloat(match[1].replace(',', '.'));
          if (!isNaN(num)) return num;
        }
      }
    }
  }
  return null;
}

function parseIntAttr(attrs: Record<string, string>, keys: string[]): number | null {
  for (const key of keys) {
    for (const [k, v] of Object.entries(attrs)) {
      if (k.includes(key)) {
        const match = v.match(/(\d+)/);
        if (match) return parseInt(match[1], 10);
      }
    }
  }
  return null;
}

function parseAreaFromText(text: string): number | null {
  const match = text.match(/([\d,.]+)\s*m[²2]/);
  if (!match) return null;
  const num = parseFloat(match[1].replace(',', '.'));
  return isNaN(num) ? null : num;
}

function parseLocation(text: string, attrs: Record<string, string>): {
  city: string | null;
  district: string | null;
  street: string | null;
  voivodeship: string | null;
  lat: number | null;
  lng: number | null;
} {
  const city = findAttr(attrs, ['miasto', 'city', 'miejscowość']) || extractCity(text);
  const district = findAttr(attrs, ['dzielnica', 'district', 'osiedle']);
  const street = findAttr(attrs, ['ulica', 'street', 'adres']);
  const voivodeship = findAttr(attrs, ['województwo', 'voivodeship', 'woj']);

  return { city, district, street, voivodeship, lat: null, lng: null };
}

function findAttr(attrs: Record<string, string>, keys: string[]): string | null {
  for (const key of keys) {
    for (const [k, v] of Object.entries(attrs)) {
      if (k.includes(key) && v) return v;
    }
  }
  return null;
}

function extractCity(text: string): string | null {
  // Try to extract city name from breadcrumb-like text
  const parts = text.split(/[,>\/]/).map(p => p.trim()).filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : null;
}

function extractCoordinate($: cheerio.CheerioAPI, type: 'lat' | 'lng'): number | null {
  // Search in script tags for coordinates
  const scripts = $('script').toArray();
  for (const script of scripts) {
    const content = $(script).html() || '';
    const patterns = type === 'lat'
      ? [/lat[itude]*['":\s]+(-?\d+\.\d+)/, /position.*?(\d{2}\.\d+)/]
      : [/ln?g[itude]*['":\s]+(-?\d+\.\d+)/, /position.*?\d{2}\.\d+.*?(\d{2}\.\d+)/];

    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match) {
        const num = parseFloat(match[1]);
        if (!isNaN(num)) return num;
      }
    }
  }

  // Search data attributes
  const mapEl = $('[data-lat], [data-lng], [data-latitude], [data-longitude]').first();
  if (mapEl.length) {
    const attr = type === 'lat'
      ? (mapEl.attr('data-lat') || mapEl.attr('data-latitude'))
      : (mapEl.attr('data-lng') || mapEl.attr('data-longitude'));
    if (attr) {
      const num = parseFloat(attr);
      if (!isNaN(num)) return num;
    }
  }

  return null;
}
