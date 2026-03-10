/**
 * Shared Helper Functions for Bezrealitky Transformers
 *
 * These utilities handle common transformations:
 * - Czech disposition → bedrooms
 * - Floor parsing
 * - Ownership normalization
 * - Building type mapping
 */

/**
 * Extract bedroom count from Czech disposition
 *
 * Czech logic:
 * - "1+kk" = 1 room (studio) → 0 bedrooms
 * - "2+kk" = 2 rooms → 1 bedroom
 * - "3+1" = 3 rooms + 1 kitchen → 2 bedrooms
 * - "4+kk" = 4 rooms → 3 bedrooms
 *
 * Formula: bedrooms = rooms - 1 (except for 1+kk = 0)
 */
export function bedroomsFromDisposition(disposition: string): number {
  // Normalize bezrealitky enum format: DISP_3_KK → 3+kk, DISP_2_1 → 2+1
  const normalized = normalizeBezrealitkyDisposition(disposition);
  const match = normalized.match(/^(\d+)\+/);
  if (!match) return 0;

  const rooms = parseInt(match[1]);

  // Special case: 1+kk = studio (0 bedrooms)
  if (rooms === 1) return 0;

  // Standard: N rooms = N-1 bedrooms
  return rooms - 1;
}

/**
 * Convert bezrealitky GraphQL disposition enum to standard Czech format
 *
 * Bezrealitky uses: DISP_1_KK, DISP_2_KK, DISP_3_1, DISP_4_KK, etc.
 * Standard Czech: 1+kk, 2+kk, 3+1, 4+kk, etc.
 * Also handles: UNDEFINED, ROOM (pokoj), OTHER
 */
export function normalizeBezrealitkyDisposition(disposition: string): string {
  if (!disposition) return '';

  // Match DISP_N_KK or DISP_N_1 pattern
  const match = disposition.match(/^DISP_(\d+)_(KK|1)$/i);
  if (match) {
    return `${match[1]}+${match[2].toLowerCase()}`;
  }

  // Already in standard format (N+kk or N+1)
  if (/^\d+\+(kk|1)$/i.test(disposition)) {
    return disposition;
  }

  return disposition;
}

/**
 * Parse Czech floor string to number
 *
 * Handles:
 * - "přízemí" / "parter" → 0
 * - "3. patro" → 3
 * - "podkroví" → extracts number or returns undefined
 */
export function parseFloor(floor: string): number {
  const clean = floor.toLowerCase().trim();

  // Ground floor variants
  if (clean.includes('přízemí') || clean.includes('parter') || clean.includes('ground')) {
    return 0;
  }

  // Extract number
  const match = clean.match(/(\d+)/);
  return match ? parseInt(match[1]) : 0;
}

/**
 * Normalize Czech ownership type
 *
 * Maps:
 * - "osobni" / "ov" → personal
 * - "druzstevni" / "db" → cooperative
 * - "statni" → state
 * - "obecni" / "mestske" → municipal
 */
export function normalizeOwnership(
  ownership: string
): 'personal' | 'cooperative' | 'state' | 'municipal' {
  const norm = ownership.toLowerCase().trim();

  if (norm.includes('osobni') || norm === 'ov') return 'personal';
  if (norm.includes('druzstevni') || norm === 'db') return 'cooperative';
  if (norm.includes('statni')) return 'state';
  if (norm.includes('obecni') || norm.includes('mestske')) return 'municipal';

  return 'personal'; // Default
}

/**
 * Extract floor location category
 *
 * Maps floor string to:
 * - ground_floor (přízemí, 0)
 * - middle_floor (1-N)
 * - top_floor (podkroví, highest floor when total_floors known)
 * - semi_basement (suterén)
 */
export function extractFloorLocation(
  floor?: string,
  totalFloors?: number
): 'ground_floor' | 'middle_floor' | 'top_floor' | 'semi_basement' | undefined {
  if (!floor) return undefined;

  const clean = floor.toLowerCase().trim();

  // Ground floor
  if (clean.includes('přízemí') || clean.includes('parter')) {
    return 'ground_floor';
  }

  // Semi-basement
  if (clean.includes('suterén') || clean.includes('podzemí')) {
    return 'semi_basement';
  }

  // Top floor (attic)
  if (clean.includes('podkroví') || clean.includes('mansarda')) {
    return 'top_floor';
  }

  // Extract floor number
  const match = clean.match(/(\d+)/);
  if (match) {
    const floorNum = parseInt(match[1]);

    if (floorNum === 0) return 'ground_floor';

    // If we know total floors, check if this is the top
    if (totalFloors !== undefined && floorNum === totalFloors) {
      return 'top_floor';
    }

    return 'middle_floor';
  }

  return undefined;
}

/**
 * Parse Czech reconstruction/renovation year
 *
 * Handles various formats:
 * - "2018" → 2018
 * - "2015-2018" → 2018 (take most recent)
 * - "před 5 lety" → calculate year
 * - "ano" / "ne" → undefined
 */
export function parseRenovationYear(reconstruction?: string): number | undefined {
  if (!reconstruction) return undefined;

  const clean = reconstruction.trim();

  // Direct year: "2018"
  const directYear = clean.match(/^(\d{4})$/);
  if (directYear) {
    return parseInt(directYear[1]);
  }

  // Year range: "2015-2018" → take most recent
  const rangeMatch = clean.match(/(\d{4})\s*-\s*(\d{4})/);
  if (rangeMatch) {
    return Math.max(parseInt(rangeMatch[1]), parseInt(rangeMatch[2]));
  }

  // Single year in text: "rekonstrukce 2018"
  const yearInText = clean.match(/(\d{4})/);
  if (yearInText) {
    return parseInt(yearInText[1]);
  }

  // "před X lety" (X years ago)
  const yearsAgo = clean.match(/před\s+(\d+)\s+le/i);
  if (yearsAgo) {
    const years = parseInt(yearsAgo[1]);
    return new Date().getFullYear() - years;
  }

  return undefined;
}
