/**
 * Detect property category from hybel.no housing type strings.
 *
 * All hybel.no listings are rentals. The primary distinction is:
 *  - apartment: leilighet, hybel, rom i bofellesskap, rom (studio/room)
 *  - house: enebolig, rekkehus, tomannsbolig, fritidsbolig
 */
export type PropertyCategory = 'apartment' | 'house';

const HOUSE_KEYWORDS = [
  'enebolig',
  'rekkehus',
  'tomannsbolig',
  'halvpart',
  'fritidsbolig',
  'hytte',
  'villa',
];

const APARTMENT_KEYWORDS = [
  'leilighet',
  'hybel',
  'rom i bofellesskap',
  'bofellesskap',
  'rom',
  'sokkel',
  'garasjeleilighet',
  'studentbolig',
];

export function detectCategory(housingTypeRaw: string): PropertyCategory {
  const lower = housingTypeRaw.toLowerCase().trim();

  for (const kw of HOUSE_KEYWORDS) {
    if (lower.includes(kw)) return 'house';
  }

  // Default to apartment (most listings on hybel.no are apartments/rooms)
  return 'apartment';
}

/**
 * Parse room count from title strings like "3 roms", "1 roms", "5 rom i bofellesskap".
 */
export function parseRoomCount(text: string): number | null {
  const match = text.match(/(\d+)\s*rom/i);
  if (match) return parseInt(match[1], 10);
  return null;
}

/**
 * Parse sqm from title strings like "67m2", "- 67m²".
 */
export function parseSqm(text: string): number | null {
  const match = text.match(/(\d+)\s*m[²2]/i);
  if (match) return parseInt(match[1], 10);
  return null;
}

/**
 * Parse a Norwegian price string like "28 000,-" or "28.000" into a number.
 */
export function parsePrice(raw: string): number | null {
  const cleaned = raw.replace(/[^\d]/g, '');
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? null : num;
}

/**
 * Parse floor number from strings like "2. etasje", "1. etasje".
 */
export function parseFloor(text: string): number | null {
  const match = text.match(/(\d+)\.\s*etasje/i);
  if (match) return parseInt(match[1], 10);
  if (/kjeller/i.test(text)) return -1;
  if (/loft/i.test(text)) return 99; // sentinel for loft
  return null;
}

/**
 * Parse Norwegian date "DD.MM.YYYY" into ISO format "YYYY-MM-DD".
 */
export function parseNorwegianDate(dateStr: string): string | null {
  const match = dateStr.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  if (match) {
    return `${match[3]}-${match[2]}-${match[1]}`;
  }
  return null;
}
