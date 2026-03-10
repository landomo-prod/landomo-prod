import { PropertyLocation } from '@landomo/core';
import { KrogsveenEstate } from '../types/krogsveenTypes';

/**
 * Extract the primary sqm figure from a Krogsveen estate.
 *
 * Priority order (Norwegian BRA standard):
 *   1. braI  – BRA-i (indoor usable area) — the primary marketed figure
 *   2. bra   – total BRA (includes all usable areas)
 *   3. boa   – boareal (older standard, still common)
 *   4. brua  – bruksareal (synonym, older)
 *   5. areaSize – generic area
 *   6. parea – primary room area (P-ROM, typically smaller)
 */
export function extractSqm(estate: KrogsveenEstate): number {
  return (
    estate.braI ??
    estate.bra ??
    estate.boa ??
    estate.brua ??
    estate.areaSize ??
    estate.parea ??
    0
  );
}

/**
 * Build a PropertyLocation from a Krogsveen estate.
 * Normalises city to title case (API returns "OSLO", "TRONDHEIM", etc.)
 */
export function buildLocation(estate: KrogsveenEstate): PropertyLocation {
  const rawCity = estate.city || '';
  const city = toTitleCase(rawCity);

  const address = [estate.vadr, estate.zip, city]
    .filter(Boolean)
    .join(', ');

  return {
    address: address || '',
    city,
    postal_code: estate.zip || undefined,
    region: estate.localAreaName || undefined,
    country: 'Norway',
    coordinates:
      estate.lat != null && estate.lon != null
        ? { lat: estate.lat, lon: estate.lon }
        : undefined,
  };
}

/**
 * Build the public listing URL for a Krogsveen estate.
 * Pattern confirmed by observing the Next.js router:
 *   https://www.krogsveen.no/kjope/{bsrPropertyType}/{id}
 *
 * Special case for tomt (land):
 *   https://www.krogsveen.no/kjope/tomt/{id}
 */
export function buildSourceUrl(estate: KrogsveenEstate): string {
  const type = slugifyPropertyType(estate.bsrPropertyType);
  return `https://www.krogsveen.no/kjope/${type}/${estate.id}`;
}

/**
 * Convert Krogsveen bsrPropertyType to URL-safe slug.
 */
function slugifyPropertyType(propType: string): string {
  // "hytter/fritid" → "hytter-fritid", "gårdsbruk/småbruk" → "gardsbruk-smabruk"
  return propType
    .toLowerCase()
    .replace(/\//g, '-')
    .replace(/å/g, 'a')
    .replace(/æ/g, 'ae')
    .replace(/ø/g, 'o')
    .replace(/[^a-z0-9-]/g, '');
}

/**
 * Convert an all-caps Norwegian city name to title case.
 * "OSLO" → "Oslo", "TRONDHEIM" → "Trondheim"
 */
function toTitleCase(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
