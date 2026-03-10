/**
 * Maps home.dk property type strings to Landomo property categories.
 *
 * home.dk `type` field values (from listing pages) and `propertyCategory` field
 * values (from detail pages) use Danish property type names.
 */

export type LandoCategory = 'apartment' | 'house' | 'land' | 'commercial';

/**
 * Known apartment types on home.dk
 */
const APARTMENT_TYPES = new Set([
  'Ejerlejlighed',
  'Andelsbolig',
  'Almenbolig',
  'Lejlighed',
  'Fritidslejlighed',
  'Penthouse',
]);

/**
 * Known house types on home.dk
 */
const HOUSE_TYPES = new Set([
  'Villa',
  'Villalejlighed',
  'Rækkehus',
  'Liebhaveri',
  'Landejendom',
  'Sommerhus',
  'Fritidshus',
  'Helårshus',
  'Enfamiliehus',
  'Tofamiliehus',
  'Parcel',
  'Byhus',
  'Dobbelthus',
  'Række-/kædehus',
]);

/**
 * Known land types on home.dk
 */
const LAND_TYPES = new Set([
  'Grund',
  'Byggegrund',
  'Erhvervsgrund',
]);

/**
 * Known commercial types on home.dk
 */
const COMMERCIAL_TYPES = new Set([
  'Erhverv',
  'Butik',
  'Kontor',
  'Lager',
  'Produktion',
  'Værksted',
  'Industri',
  'Hotel',
  'Klinik',
  'Restaurant',
]);

export function detectCategory(
  propertyType: string,
  isBusinessCase: boolean,
  isPlot: boolean,
): LandoCategory {
  if (isBusinessCase) return 'commercial';
  if (isPlot) return 'land';

  if (APARTMENT_TYPES.has(propertyType)) return 'apartment';
  if (HOUSE_TYPES.has(propertyType)) return 'house';
  if (LAND_TYPES.has(propertyType)) return 'land';
  if (COMMERCIAL_TYPES.has(propertyType)) return 'commercial';

  // Fallback: if type contains certain keywords
  const lower = propertyType.toLowerCase();
  if (lower.includes('lejlighed') || lower.includes('andel')) return 'apartment';
  if (lower.includes('villa') || lower.includes('hus') || lower.includes('sommerhus')) return 'house';
  if (lower.includes('grund')) return 'land';
  if (lower.includes('erhverv')) return 'commercial';

  // Default to house for unknown types
  return 'house';
}
