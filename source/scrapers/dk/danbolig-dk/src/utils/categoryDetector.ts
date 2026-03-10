/**
 * Category detection for danbolig.dk property types.
 *
 * Danish type → Landomo category mapping:
 *   Lejlighed, Andelsbolig                                → apartment
 *   Villa, Rækkehus, Fritidsbolig, Liebhaveri,
 *   Landejendom, Villa/Fritidsbolig, Villa/Helårsgrund    → house
 *   Helårsgrund, Sommerhusgrund, *grund*                  → land
 *   Erhverv                                               → commercial
 */

export type PropertyCategory = 'apartment' | 'house' | 'land' | 'commercial';

const APARTMENT_TYPES = new Set([
  'lejlighed',
  'andelsbolig',
  'ejerlejlighed',
]);

const HOUSE_TYPES = new Set([
  'villa',
  'rækkehus',
  'fritidsbolig',
  'liebhaveri',
  'landejendom',
  'villa / fritidsbolig',
  'villa / helårsgrund',
  'villa/fritidsbolig',
  'villa/helårsgrund',
  'helårshus',
]);

const LAND_TYPES = new Set([
  'helårsgrund',
  'sommerhusgrund',
  'grund',
]);

const COMMERCIAL_TYPES = new Set([
  'erhverv',
  'erhvervsejendom',
  'butik',
  'kontor',
  'lager',
]);

export function detectCategory(type: string): PropertyCategory {
  const normalized = type.toLowerCase().trim();

  if (APARTMENT_TYPES.has(normalized)) return 'apartment';
  if (HOUSE_TYPES.has(normalized)) return 'house';
  if (LAND_TYPES.has(normalized) || normalized.includes('grund')) return 'land';
  if (COMMERCIAL_TYPES.has(normalized)) return 'commercial';

  // Fallback heuristics
  if (normalized.includes('lejlighed') || normalized.includes('andels')) return 'apartment';
  if (normalized.includes('villa') || normalized.includes('hus') || normalized.includes('bolig')) return 'house';
  if (normalized.includes('grund')) return 'land';
  if (normalized.includes('erhverv') || normalized.includes('kontor') || normalized.includes('butik')) return 'commercial';

  // Default unknown types to house
  return 'house';
}
