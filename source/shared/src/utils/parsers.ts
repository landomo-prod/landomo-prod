/**
 * Common Parsing Utilities
 * Helper functions for parsing data from various portals
 */

/**
 * Parse price from various string formats
 */
export function parsePrice(priceText: string): number | undefined {
  if (!priceText) return undefined;

  // Remove common currency symbols and separators
  const cleaned = priceText
    .replace(/[€$£¥₹฿₽₪₩₱₦₵₡₢₣₤₥₧₨₫₭₮₯₰₱₲₳₴₵]/g, '')
    .replace(/[,\s]/g, '')
    .replace(/\.(?=\d{3})/g, '') // Remove thousand separators (.)
    .trim();

  const match = cleaned.match(/[\d.]+/);
  if (!match) return undefined;

  const number = parseFloat(match[0]);
  return isNaN(number) ? undefined : number;
}

/**
 * Parse price in CZK format (Czech)
 */
export function parsePriceCZK(priceText: string): number | undefined {
  if (!priceText) return undefined;
  // Czech format: "5 500 000 Kč" or "5.500.000 Kč"
  const cleaned = priceText
    .replace(/Kč/g, '')
    .replace(/\s/g, '')
    .replace(/\./g, '') // Dots are thousand separators in CZ
    .trim();
  const number = parseInt(cleaned, 10);
  return isNaN(number) ? undefined : number;
}

/**
 * Parse price in EUR format
 */
export function parsePriceEUR(priceText: string): number | undefined {
  if (!priceText) return undefined;
  // EUR format: "1,500,000€" or "1.500.000€" or "€1,500,000"
  const cleaned = priceText
    .replace(/[€\s]/g, '')
    .replace(/,/g, '')
    .replace(/\.(?=\d{3})/g, '') // Remove thousand separators
    .trim();
  const number = parseFloat(cleaned);
  return isNaN(number) ? undefined : number;
}

/**
 * Parse area/size in sqm
 */
export function parseArea(areaText: string): number | undefined {
  if (!areaText) return undefined;

  const cleaned = areaText
    .replace(/m²|m2|sqm|sq\s*m/gi, '')
    .replace(/,/g, '.')
    .trim();

  const match = cleaned.match(/[\d.]+/);
  if (!match) return undefined;

  const number = parseFloat(match[0]);
  return isNaN(number) ? undefined : number;
}

/**
 * Parse number of bedrooms/bathrooms/rooms
 */
export function parseRoomCount(text: string): number | undefined {
  if (!text) return undefined;

  const match = text.match(/\d+/);
  if (!match) return undefined;

  const number = parseInt(match[0], 10);
  return isNaN(number) ? undefined : number;
}

/**
 * Normalize property type to standard values
 */
export function normalizePropertyType(type: string): string {
  if (!type) return 'other';

  const normalized = type.toLowerCase().trim();

  const mapping: Record<string, string> = {
    // Apartment
    'apartment': 'apartment',
    'flat': 'apartment',
    'unit': 'apartment',
    'byt': 'apartment',           // Czech
    'wohnung': 'apartment',       // German
    'appartamento': 'apartment',  // Italian
    'apartamento': 'apartment',   // Spanish/Portuguese

    // House
    'house': 'house',
    'home': 'house',
    'dum': 'house',              // Czech
    'haus': 'house',             // German
    'casa': 'house',             // Italian/Spanish
    'maison': 'house',           // French

    // Villa
    'villa': 'villa',

    // Townhouse
    'townhouse': 'townhouse',
    'town house': 'townhouse',
    'terraced': 'townhouse',

    // Studio
    'studio': 'studio',

    // Land
    'land': 'land',
    'plot': 'land',
    'terrain': 'land',

    // Commercial
    'commercial': 'commercial',
    'office': 'commercial',
    'retail': 'commercial',
    'warehouse': 'commercial'
  };

  return mapping[normalized] || 'other';
}

/**
 * Extract currency from country
 */
export function getCurrency(country: string): string {
  const currencyMap: Record<string, string> = {
    'australia': 'AUD',
    'newzealand': 'NZD',
    'usa': 'USD',
    'united_states': 'USD',
    'uk': 'GBP',
    'united_kingdom': 'GBP',
    'czechia': 'CZK',
    'czech': 'CZK',
    'czech_republic': 'CZK',
    'germany': 'EUR',
    'france': 'EUR',
    'italy': 'EUR',
    'spain': 'EUR',
    'portugal': 'EUR',
    'netherlands': 'EUR',
    'belgium': 'EUR',
    'austria': 'EUR',
    'poland': 'PLN',
    'sweden': 'SEK',
    'norway': 'NOK',
    'denmark': 'DKK',
    'switzerland': 'CHF',
    'canada': 'CAD',
    'japan': 'JPY',
    'china': 'CNY',
    'india': 'INR',
    'brazil': 'BRL',
    'mexico': 'MXN',
    'argentina': 'ARS',
    'chile': 'CLP',
    'thailand': 'THB',
    'vietnam': 'VND',
    'singapore': 'SGD',
    'malaysia': 'MYR',
    'philippines': 'PHP',
    'indonesia': 'IDR',
    'turkey': 'TRY',
    'uae': 'AED',
    'saudi_arabia': 'SAR',
    'south_africa': 'ZAR',
    'egypt': 'EGP'
  };

  const key = country.toLowerCase().replace(/\s+/g, '_');
  return currencyMap[key] || 'USD';
}

/**
 * Random delay (for rate limiting)
 */
export function randomDelay(min: number, max: number): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Extract a number from a string (first numeric sequence)
 */
export function extractNumber(text: string): number | undefined {
  if (!text) return undefined;

  const match = text.match(/-?[\d]+(?:[.,]\d+)?/);
  if (!match) return undefined;

  const number = parseFloat(match[0].replace(',', '.'));
  return isNaN(number) ? undefined : number;
}

/**
 * Parse coordinates from various string formats
 * Supports: "48.24029,16.34025" | "48.24029 16.34025" | {lat, lon/lng}
 */
export function parseCoordinates(
  input: string | { lat?: any; lon?: any; lng?: any; longitude?: any; latitude?: any } | undefined
): { lat: number; lon: number } | undefined {
  if (!input) return undefined;

  // Object form
  if (typeof input === 'object') {
    const lat = parseFloat(String(input.lat ?? input.latitude));
    const lon = parseFloat(String(input.lon ?? input.lng ?? input.longitude));
    if (!isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
      return { lat, lon };
    }
    return undefined;
  }

  // String form: "lat,lon" or "lat lon"
  if (typeof input === 'string') {
    const parts = input.split(/[,\s]+/).map(s => s.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const lat = parseFloat(parts[0]);
      const lon = parseFloat(parts[1]);
      if (!isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
        return { lat, lon };
      }
    }
  }

  return undefined;
}

/**
 * Parse a date from various portal formats
 * Returns ISO 8601 string or undefined
 */
export function parseDate(dateInput: string | number | Date | undefined): string | undefined {
  if (!dateInput) return undefined;

  // Already a Date object
  if (dateInput instanceof Date) {
    return isNaN(dateInput.getTime()) ? undefined : dateInput.toISOString();
  }

  // Unix timestamp (seconds)
  if (typeof dateInput === 'number') {
    // Distinguish seconds vs milliseconds (anything > 1e12 is likely ms)
    const ms = dateInput > 1e12 ? dateInput : dateInput * 1000;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? undefined : d.toISOString();
  }

  if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim();

    // ISO 8601 or standard Date.parse-able formats
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }

    // European format: DD.MM.YYYY or DD/MM/YYYY
    const euMatch = trimmed.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
    if (euMatch) {
      const d = new Date(`${euMatch[3]}-${euMatch[2].padStart(2, '0')}-${euMatch[1].padStart(2, '0')}`);
      if (!isNaN(d.getTime())) return d.toISOString();
    }

    // Czech/Slovak: "1. 3. 2024" or "1.3.2024"
    const czMatch = trimmed.match(/^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})$/);
    if (czMatch) {
      const d = new Date(`${czMatch[3]}-${czMatch[2].padStart(2, '0')}-${czMatch[1].padStart(2, '0')}`);
      if (!isNaN(d.getTime())) return d.toISOString();
    }
  }

  return undefined;
}

/**
 * Normalize an address by trimming, collapsing whitespace, and removing trailing commas
 */
export function normalizeAddress(address: string | undefined): string | undefined {
  if (!address) return undefined;

  return address
    .replace(/\s+/g, ' ')
    .replace(/,\s*$/, '')
    .replace(/^\s*,/, '')
    .trim() || undefined;
}
