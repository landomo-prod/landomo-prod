/**
 * Standardized Hungarian Real Estate Value Mappings
 *
 * This file defines the CANONICAL values that the Hungarian database expects.
 * All scrapers MUST map their portal-specific values to these standards.
 */

// ============================================================================
// HUNGARIAN DISPOSITION (Room Layout) - CANONICAL VALUES
// Hungarian uses "szobás" suffix (e.g., 1-szobás = 1 room apartment)
// ============================================================================
export const HUNGARIAN_DISPOSITIONS = [
  '1-szobás',      // 1 room apartment
  '2-szobás',      // 2 room apartment
  '3-szobás',      // 3 room apartment
  '4-szobás',      // 4 room apartment
  '5-szobás',      // 5 room apartment
  '6-szobás',      // 6 room apartment
  'több-szobás',   // More than 6 rooms
  'garzonlakás',   // Studio apartment
  'félszobás',     // Half-room
  'atipikus'       // Non-standard layout
] as const;

export type HungarianDisposition = typeof HUNGARIAN_DISPOSITIONS[number];

// ============================================================================
// HUNGARIAN OWNERSHIP TYPE - CANONICAL VALUES
// ============================================================================
export const HUNGARIAN_OWNERSHIP_TYPES = [
  'tulajdon',      // Tulajdon (Full ownership)
  'társasházi',    // Társasházi (Condominium)
  'szövetkezeti',  // Szövetkezeti (Cooperative)
  'állami',        // Állami/önkormányzati (State/municipal)
  'egyéb'          // Egyéb (Other)
] as const;

export type HungarianOwnership = typeof HUNGARIAN_OWNERSHIP_TYPES[number];

// ============================================================================
// PROPERTY CONDITION - CANONICAL VALUES (Hungarian)
// Based on standard Hungarian real estate classifications
// ============================================================================
export const PROPERTY_CONDITIONS = [
  'újépítésű',           // New construction / Újépítésű
  'újszerű',             // New-like / Újszerű
  'kiváló',              // Excellent / Kiváló
  'jó',                  // Good condition / Jó állapotú
  'felújított',          // Renovated / Felújított
  'felújítandó',         // Requires renovation / Felújítandó
  'közepes',             // Average / Közepes
  'romos',               // Dilapidated / Romos
  'építés_alatt'         // Under construction / Építés alatt
] as const;

export type PropertyCondition = typeof PROPERTY_CONDITIONS[number];

// ============================================================================
// MAPPER: Normalize Disposition String
// ============================================================================
export function normalizeDisposition(input: string | undefined): HungarianDisposition | undefined {
  if (!input) return undefined;

  const clean = input.toLowerCase().trim().replace(/\s+/g, '');

  // Garzonlakás (studio) variants
  if (clean.includes('garzon') || clean.includes('studio') || clean.includes('garzó')) {
    return 'garzonlakás';
  }

  // Félszobás (half-room)
  if (clean.includes('fél') && clean.includes('szob')) {
    return 'félszobás';
  }

  // N-szobás patterns (1-6 rooms)
  const match = clean.match(/(\d+)\s*[-\s]?\s*szob/i);
  if (match) {
    const rooms = parseInt(match[1]);
    if (rooms >= 1 && rooms <= 6) {
      return `${rooms}-szobás` as HungarianDisposition;
    }
    if (rooms > 6) {
      return 'több-szobás';
    }
  }

  // Direct numeric matches
  if (clean.includes('1szob') || clean === '1') return '1-szobás';
  if (clean.includes('2szob') || clean === '2') return '2-szobás';
  if (clean.includes('3szob') || clean === '3') return '3-szobás';
  if (clean.includes('4szob') || clean === '4') return '4-szobás';
  if (clean.includes('5szob') || clean === '5') return '5-szobás';
  if (clean.includes('6szob') || clean === '6') return '6-szobás';

  // Atipikus (atypical)
  if (clean.includes('atipik') || clean.includes('atypical') || clean.includes('egyedi')) {
    return 'atipikus';
  }

  return undefined;
}

// ============================================================================
// MAPPER: Normalize Ownership Type
// ============================================================================
export function normalizeOwnership(input: string | undefined): HungarianOwnership | undefined {
  if (!input) return 'egyéb';

  const clean = input.toLowerCase().trim();

  // Hungarian to canonical mapping
  if (clean.includes('tulajdon') || clean.includes('teljes') || clean.includes('full ownership')) {
    return 'tulajdon';
  }
  if (clean.includes('társasház') || clean.includes('condominium')) {
    return 'társasházi';
  }
  if (clean.includes('szövetkezet') || clean.includes('cooperative')) {
    return 'szövetkezeti';
  }
  if (clean.includes('állam') || clean.includes('önkormányzat') || clean.includes('state') || clean.includes('municipal')) {
    return 'állami';
  }

  return 'egyéb';
}

// ============================================================================
// MAPPER: Normalize Property Condition
// ============================================================================
export function normalizeCondition(input: string | undefined): PropertyCondition | undefined {
  if (!input) return undefined;

  const clean = input.toLowerCase().trim();

  // New construction
  if (clean.includes('újépítés') || clean.includes('new construction') || clean.includes('új építés')) {
    return 'újépítésű';
  }

  // New-like
  if (clean.includes('újszerű') || clean.includes('new-like') || clean.includes('mint az új')) {
    return 'újszerű';
  }

  // Excellent
  if (clean.includes('kiváló') || clean.includes('excellent') || clean.includes('tökéletes')) {
    return 'kiváló';
  }

  // Good
  if (clean.includes('jó állapot') || clean.includes('good') || clean.includes('jó')) {
    return 'jó';
  }

  // Renovated
  if (clean.includes('felújított') || clean.includes('renovated') || clean.includes('felújítva')) {
    return 'felújított';
  }

  // Requires renovation
  if (clean.includes('felújítandó') || clean.includes('requires renovation') || clean.includes('felújításra szorul')) {
    return 'felújítandó';
  }

  // Average
  if (clean.includes('közepes') || clean.includes('average') || clean.includes('átlagos')) {
    return 'közepes';
  }

  // Dilapidated
  if (clean.includes('romos') || clean.includes('dilapidated') || clean.includes('rossz')) {
    return 'romos';
  }

  // Under construction
  if (clean.includes('építés alatt') || clean.includes('under construction') || clean.includes('épül')) {
    return 'építés_alatt';
  }

  return undefined;
}

// ============================================================================
// FURNISHED STATUS - CANONICAL VALUES
// ============================================================================
export const FURNISHED_STATUSES = [
  'bútorozott',           // Fully furnished (Bútorozott)
  'részben_bútorozott',   // Partially furnished (Részben bútorozott)
  'bútorozatlan'          // Not furnished (Bútorozatlan)
] as const;

export type FurnishedStatus = typeof FURNISHED_STATUSES[number];

// ============================================================================
// ENERGY RATING - CANONICAL VALUES (EU Standard)
// ============================================================================
export const ENERGY_RATINGS = [
  'a++',   // Most efficient
  'a+',
  'a',
  'b',
  'c',
  'd',
  'e',
  'f',
  'g',
  'h',
  'i',
  'j'      // Least efficient
] as const;

export type EnergyRating = typeof ENERGY_RATINGS[number];

// ============================================================================
// HEATING TYPE - CANONICAL VALUES (Hungarian heating types)
// ============================================================================
export const HEATING_TYPES = [
  'központi',           // Central heating (Központi fűtés)
  'gázfűtés',           // Gas heating (Gázfűtés)
  'elektromos',         // Electric heating (Elektromos fűtés)
  'távfűtés',           // District heating (Távfűtés)
  'házközponti',        // House-central heating (Házközponti)
  'egyedi',             // Individual heating (Egyedi)
  'gázkonvektor',       // Gas convector (Gázkonvektor)
  'fan_coil',           // Fan coil
  'geotermikus',        // Geothermal (Geotermikus)
  'napkollektor',       // Solar panels (Napkollektor)
  'egyéb'               // Other
] as const;

export type HeatingType = typeof HEATING_TYPES[number];

// ============================================================================
// MAPPER: Normalize Furnished Status
// ============================================================================
export function normalizeFurnished(input: string | undefined | boolean): FurnishedStatus | undefined {
  if (input === undefined || input === null) return undefined;

  // Handle boolean values
  if (typeof input === 'boolean') {
    return input ? 'bútorozott' : 'bútorozatlan';
  }

  const clean = String(input).toLowerCase().trim();

  // Fully furnished
  if (
    clean === 'yes' ||
    clean === 'igen' ||
    clean === 'bútorozott' ||
    clean === 'butorozott' ||
    clean === 'furnished' ||
    clean === 'complete'
  ) {
    return 'bútorozott';
  }

  // Partially furnished
  if (
    clean.includes('részben') ||
    clean.includes('reszben') ||
    clean === 'partial' ||
    clean.includes('partly')
  ) {
    return 'részben_bútorozott';
  }

  // Not furnished
  if (
    clean === 'no' ||
    clean === 'nem' ||
    clean === 'bútorozatlan' ||
    clean === 'butorozatlan' ||
    clean === 'unfurnished'
  ) {
    return 'bútorozatlan';
  }

  return undefined;
}

// ============================================================================
// MAPPER: Normalize Energy Rating
// ============================================================================
export function normalizeEnergyRating(input: string | undefined): EnergyRating | undefined {
  if (!input) return undefined;

  const clean = String(input)
    .toLowerCase()
    .trim()
    .replace(/[\s\-]/g, '')
    .replace(/energetikai|besorolás|osztály/gi, '');

  // Handle A++, A+, A-J ratings
  if (clean.includes('a++')) return 'a++';
  if (clean.includes('a+')) return 'a+';
  if (clean.match(/^a$/)) return 'a';

  const singleLetter = clean.substring(0, 1);
  if (ENERGY_RATINGS.includes(singleLetter as EnergyRating)) {
    return singleLetter as EnergyRating;
  }

  return undefined;
}

// ============================================================================
// MAPPER: Normalize Heating Type
// ============================================================================
export function normalizeHeatingType(input: string | undefined): HeatingType | undefined {
  if (!input) return 'egyéb';

  const clean = input.toLowerCase().trim();
  if (!clean) return 'egyéb';

  // Central heating
  if (
    clean.includes('központ') ||
    clean.includes('central')
  ) {
    return 'központi';
  }

  // District heating
  if (
    clean.includes('távfűt') ||
    clean.includes('távfut') ||
    clean.includes('district')
  ) {
    return 'távfűtés';
  }

  // House-central
  if (
    clean.includes('házközpont') ||
    clean.includes('hazkozpont')
  ) {
    return 'házközponti';
  }

  // Gas heating
  if (
    clean.includes('gáz') ||
    clean.includes('gaz') ||
    clean.includes('gas')
  ) {
    // Check for gas convector
    if (clean.includes('konvektor')) {
      return 'gázkonvektor';
    }
    return 'gázfűtés';
  }

  // Electric
  if (
    clean.includes('elektr') ||
    clean.includes('electric')
  ) {
    return 'elektromos';
  }

  // Individual
  if (
    clean.includes('egyedi') ||
    clean.includes('individual')
  ) {
    return 'egyedi';
  }

  // Fan coil
  if (
    clean.includes('fan') && clean.includes('coil')
  ) {
    return 'fan_coil';
  }

  // Geothermal
  if (
    clean.includes('geotermik') ||
    clean.includes('geothermal') ||
    clean.includes('földhő')
  ) {
    return 'geotermikus';
  }

  // Solar
  if (
    clean.includes('napkol') ||
    clean.includes('solar') ||
    clean.includes('nap energia')
  ) {
    return 'napkollektor';
  }

  return 'egyéb';
}

// ============================================================================
// CONSTRUCTION TYPE - CANONICAL VALUES (Hungarian)
// ============================================================================
export const CONSTRUCTION_TYPES = [
  'panel',              // Panel building (Panelház)
  'tégla',              // Brick (Tégla)
  'vasbeton',           // Reinforced concrete (Vasbeton)
  'vályog',             // Adobe (Vályog)
  'fa',                 // Wood (Fa)
  'könnyűszerkezet',    // Lightweight structure (Könnyűszerkezetes)
  'vegyesfalazat',      // Mixed masonry (Vegyes falazat)
  'egyéb'               // Other
] as const;

export type ConstructionType = typeof CONSTRUCTION_TYPES[number];

// ============================================================================
// MAPPER: Normalize Construction Type
// ============================================================================
export function normalizeConstructionType(input: string | undefined): ConstructionType | undefined {
  if (!input) return undefined;

  const clean = input.toLowerCase().trim();
  if (!clean) return undefined;

  // Panel
  if (clean.includes('panel')) {
    return 'panel';
  }

  // Brick
  if (
    clean.includes('tégl') ||
    clean.includes('tegl') ||
    clean.includes('brick')
  ) {
    return 'tégla';
  }

  // Reinforced concrete
  if (
    clean.includes('vasbeton') ||
    clean.includes('beton') ||
    clean.includes('concrete')
  ) {
    return 'vasbeton';
  }

  // Adobe
  if (
    clean.includes('vályog') ||
    clean.includes('valyog') ||
    clean.includes('adobe')
  ) {
    return 'vályog';
  }

  // Wood
  if (
    clean.includes('fa') ||
    clean.includes('wood') ||
    clean.includes('fából')
  ) {
    return 'fa';
  }

  // Lightweight
  if (
    clean.includes('könnyű') ||
    clean.includes('konnyu') ||
    clean.includes('lightweight')
  ) {
    return 'könnyűszerkezet';
  }

  // Mixed masonry
  if (
    clean.includes('vegyes') ||
    clean.includes('mixed')
  ) {
    return 'vegyesfalazat';
  }

  return undefined;
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================
export function isValidDisposition(value: string): value is HungarianDisposition {
  return HUNGARIAN_DISPOSITIONS.includes(value as HungarianDisposition);
}

export function isValidOwnership(value: string): value is HungarianOwnership {
  return HUNGARIAN_OWNERSHIP_TYPES.includes(value as HungarianOwnership);
}

export function isValidCondition(value: string): value is PropertyCondition {
  return PROPERTY_CONDITIONS.includes(value as PropertyCondition);
}

export function isValidFurnished(value: string): value is FurnishedStatus {
  return FURNISHED_STATUSES.includes(value as FurnishedStatus);
}

export function isValidEnergyRating(value: string): value is EnergyRating {
  return ENERGY_RATINGS.includes(value as EnergyRating);
}

export function isValidHeatingType(value: string): value is HeatingType {
  return HEATING_TYPES.includes(value as HeatingType);
}

export function isValidConstructionType(value: string): value is ConstructionType {
  return CONSTRUCTION_TYPES.includes(value as ConstructionType);
}
