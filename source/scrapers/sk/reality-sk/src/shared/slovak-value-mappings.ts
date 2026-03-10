/**
 * Standardized Slovak Real Estate Value Mappings
 *
 * This file defines the CANONICAL values (in English) that the Slovak database expects.
 * All scrapers MUST map their portal-specific values to these standards.
 *
 * Pattern follows Czech/German/Austrian mappings with English canonical values.
 */

// ============================================================================
// SLOVAK DISPOSITION (Room Layout) - CANONICAL VALUES
// Similar to Czech but uses Slovak terminology
// ============================================================================
export const SLOVAK_DISPOSITIONS = [
  '1-room',      // 1-izbový
  '2-room',      // 2-izbový
  '3-room',      // 3-izbový
  '4-room',      // 4-izbový
  '5-room',      // 5-izbový
  '6-room',      // 6-izbový
  '6-room-plus', // viac-izbový (more than 6)
  'studio',      // garsónka
  'atypical'     // atypický
] as const;

export type SlovakDisposition = typeof SLOVAK_DISPOSITIONS[number];

// ============================================================================
// SLOVAK OWNERSHIP TYPE - CANONICAL VALUES
// ============================================================================
export const SLOVAK_OWNERSHIP_TYPES = [
  'personal',      // Osobné vlastníctvo
  'cooperative',   // Družstevné vlastníctvo
  'state',         // Štátne/obecné
  'municipal',     // Obecné
  'other'          // Iné
] as const;

export type SlovakOwnership = typeof SLOVAK_OWNERSHIP_TYPES[number];

// ============================================================================
// PROPERTY CONDITION - CANONICAL VALUES
// ============================================================================
export const PROPERTY_CONDITIONS = [
  'new',                 // Novostavba
  'excellent',           // Výborný
  'very_good',           // Veľmi dobrý
  'good',                // Dobrý
  'after_renovation',    // Po rekonštrukcii
  'before_renovation',   // Pred rekonštrukciou
  'requires_renovation', // Vyžaduje rekonštrukciu
  'project',             // Projekt
  'under_construction'   // Vo výstavbe
] as const;

export type PropertyCondition = typeof PROPERTY_CONDITIONS[number];

// ============================================================================
// MAPPER: Normalize Disposition String
// ============================================================================
export function normalizeDisposition(input: string | undefined): SlovakDisposition | undefined {
  if (!input) return undefined;

  const clean = input.toLowerCase().trim().replace(/\s+/g, '');

  // Garsónka (studio) variants
  if (clean.includes('garsón') || clean.includes('garson') || clean.includes('studio')) {
    return 'studio';
  }

  // N-izbový patterns (1-6 rooms)
  const match = clean.match(/(\d)\s*[-\s]?\s*izb/i);
  if (match) {
    const rooms = parseInt(match[1]);
    if (rooms >= 1 && rooms <= 6) {
      return `${rooms}-room` as SlovakDisposition;
    }
    if (rooms > 6) {
      return '6-room-plus';
    }
  }

  // Direct text matches
  if (clean.includes('1izb') || clean === '1') return '1-room';
  if (clean.includes('2izb') || clean === '2') return '2-room';
  if (clean.includes('3izb') || clean === '3') return '3-room';
  if (clean.includes('4izb') || clean === '4') return '4-room';
  if (clean.includes('5izb') || clean === '5') return '5-room';
  if (clean.includes('6izb') || clean === '6') return '6-room';

  // Atypical
  if (clean.includes('atypick') || clean.includes('neštandardn') || clean.includes('nestandardn')) {
    return 'atypical';
  }

  return undefined;
}

// ============================================================================
// MAPPER: Normalize Ownership Type
// ============================================================================
export function normalizeOwnership(input: string | undefined): SlovakOwnership | undefined {
  if (!input) return undefined;

  const clean = input.toLowerCase().trim();

  // Slovak to English mapping
  if (clean.includes('osobn') || clean.includes('personal')) return 'personal';
  if (clean.includes('družstev') || clean.includes('druzstev') || clean.includes('cooperative')) return 'cooperative';
  if (clean.includes('obecn') || clean.includes('municipal')) return 'municipal';
  if (clean.includes('štátn') || clean.includes('statn') || clean.includes('state')) return 'state';

  return 'other';
}

// ============================================================================
// MAPPER: Normalize Property Condition
// ============================================================================
export function normalizeCondition(input: string | undefined): PropertyCondition | undefined {
  if (!input) return undefined;

  const clean = input.toLowerCase().trim();

  // Check specific English phrases first
  if (clean === 'new') return 'new';
  if (clean.includes('after renovation')) return 'after_renovation';
  if (clean.includes('before renovation')) return 'before_renovation';
  if (clean.includes('requires renovation')) return 'requires_renovation';
  if (clean.includes('under construction')) return 'under_construction';

  // Slovak-specific patterns
  if (clean.includes('novostavb') || clean.includes('nový') || clean.includes('novy')) return 'new';
  if (clean.includes('výborn') || clean.includes('vyborn') || clean.includes('excellent')) return 'excellent';
  if (clean.includes('veľmi dobr') || clean.includes('velmi dobr') || clean.includes('very good')) return 'very_good';
  if (clean.includes('dobr') || clean.includes('good')) return 'good';
  if (clean.includes('po rekonštrukc') || clean.includes('po rekonstrukc')) return 'after_renovation';
  if (clean.includes('pred rekonštrukc') || clean.includes('pred rekonstrukc')) return 'before_renovation';
  if (clean.includes('vyžaduje rekonštrukc') || clean.includes('vyzaduje rekonstrukc')) return 'requires_renovation';
  if (clean.includes('projekt') || clean.includes('project')) return 'project';
  if (clean.includes('vo výstavb') || clean.includes('vo vystavb')) return 'under_construction';

  return undefined;
}

// ============================================================================
// FURNISHED STATUS - CANONICAL VALUES
// ============================================================================
export const FURNISHED_STATUSES = [
  'furnished',              // Zariadený
  'partially_furnished',    // Čiastočne zariadený
  'not_furnished'           // Nezariadený
] as const;

export type FurnishedStatus = typeof FURNISHED_STATUSES[number];

// ============================================================================
// ENERGY RATING - CANONICAL VALUES
// ============================================================================
export const ENERGY_RATINGS = [
  'a',
  'b',
  'c',
  'd',
  'e',
  'f',
  'g'
] as const;

export type EnergyRating = typeof ENERGY_RATINGS[number];

// ============================================================================
// HEATING TYPE - CANONICAL VALUES
// ============================================================================
export const HEATING_TYPES = [
  'central_heating',        // Ústredné kúrenie
  'individual_heating',     // Lokálne/individuálne
  'electric_heating',       // Elektrické
  'gas_heating',            // Plynové
  'boiler',                 // Kotol
  'heat_pump',              // Tepelné čerpadlo
  'other'                   // Iné
] as const;

export type HeatingType = typeof HEATING_TYPES[number];

// ============================================================================
// MAPPER: Normalize Furnished Status
// ============================================================================
export function normalizeFurnished(input: string | undefined | boolean): FurnishedStatus | undefined {
  if (input === undefined || input === null) return undefined;

  if (typeof input === 'boolean') {
    return input ? 'furnished' : 'not_furnished';
  }

  const clean = String(input).toLowerCase().trim();

  // Fully furnished
  if (
    clean === 'yes' ||
    clean === 'áno' ||
    clean === 'ano' ||
    clean === 'zariadený' ||
    clean === 'zariadeny' ||
    clean === 'zariadene' ||
    clean === 'furnished' ||
    clean === 'complete'
  ) {
    return 'furnished';
  }

  // Partially furnished
  if (
    clean.includes('čiastočn') ||
    clean.includes('ciastocn') ||
    clean === 'partial' ||
    clean.includes('partly') ||
    clean.includes('partially')
  ) {
    return 'partially_furnished';
  }

  // Not furnished
  if (
    clean === 'no' ||
    clean === 'nie' ||
    clean === 'nezariadený' ||
    clean === 'nezariadeny' ||
    clean === 'nezariadene' ||
    clean === 'unfurnished'
  ) {
    return 'not_furnished';
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
    .replace(/trieda/i, '')
    .replace(/class/i, '')
    .substring(0, 1);

  if (ENERGY_RATINGS.includes(clean as EnergyRating)) {
    return clean as EnergyRating;
  }

  return undefined;
}

// ============================================================================
// MAPPER: Normalize Heating Type
// ============================================================================
export function normalizeHeatingType(input: string | undefined): HeatingType | undefined {
  if (!input) return undefined;

  const clean = input.toLowerCase().trim();
  if (!clean) return undefined;

  // Central heating
  if (
    clean.includes('ústred') ||
    clean.includes('ustred') ||
    clean.includes('central')
  ) {
    return 'central_heating';
  }

  // Local/individual
  if (
    clean.includes('lokál') ||
    clean.includes('lokal') ||
    clean.includes('individual') ||
    clean.includes('bytov')
  ) {
    return 'individual_heating';
  }

  // Electric
  if (
    clean.includes('elektr') ||
    clean.includes('electric')
  ) {
    return 'electric_heating';
  }

  // Gas
  if (
    clean.includes('plyn') ||
    clean.includes('gas')
  ) {
    return 'gas_heating';
  }

  // Boiler
  if (
    clean.includes('kotol') ||
    clean.includes('boiler')
  ) {
    return 'boiler';
  }

  // Heat pump
  if (
    clean.includes('tepelné čerpadlo') ||
    clean.includes('tepelne cerpadl') ||
    clean.includes('heat pump')
  ) {
    return 'heat_pump';
  }

  return 'other';
}

// ============================================================================
// CONSTRUCTION TYPE - CANONICAL VALUES
// ============================================================================
export const CONSTRUCTION_TYPES = [
  'panel',              // Panelový
  'brick',              // Tehla
  'stone',              // Murovaný
  'wood',               // Drevo
  'concrete',           // Betón
  'mixed',              // Zmiešaný
  'other'               // Iný
] as const;

export type ConstructionType = typeof CONSTRUCTION_TYPES[number];

// ============================================================================
// MAPPER: Normalize Construction Type
// ============================================================================
export function normalizeConstructionType(input: string | undefined): ConstructionType | undefined {
  if (!input) return undefined;

  const clean = input.toLowerCase().trim();
  if (!clean) return undefined;

  if (clean.includes('panel')) return 'panel';
  if (clean.includes('tehl') || clean.includes('brick')) return 'brick';
  if (clean.includes('murovan') || clean.includes('stone') || clean.includes('kamen')) return 'stone';
  if (clean.includes('drevo') || clean.includes('drev') || clean.includes('wood')) return 'wood';
  if (clean.includes('betón') || clean.includes('beton') || clean.includes('concrete')) return 'concrete';
  if (clean.includes('zmiešan') || clean.includes('zmiesan') || clean.includes('mixed')) return 'mixed';

  return undefined;
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================
export function isValidDisposition(value: string): value is SlovakDisposition {
  return SLOVAK_DISPOSITIONS.includes(value as SlovakDisposition);
}

export function isValidOwnership(value: string): value is SlovakOwnership {
  return SLOVAK_OWNERSHIP_TYPES.includes(value as SlovakOwnership);
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

// ============================================================================
// FEATURES ARRAY PARSER - Slovak Amenities
// ============================================================================

export interface ParsedAmenities {
  has_parking?: boolean;
  has_garage?: boolean;
  has_balcony?: boolean;
  has_terrace?: boolean;
  has_basement?: boolean;
  has_elevator?: boolean;
  is_furnished?: boolean;
  has_loggia?: boolean;
  is_barrier_free?: boolean;
  is_pet_friendly?: boolean;
  has_garden?: boolean;
  is_low_energy?: boolean;
  has_sauna?: boolean;
  has_gym?: boolean;
  has_ac?: boolean;
  has_wifi?: boolean;
  has_security?: boolean;
  has_storage?: boolean;
}

export function parseSlovakFeatures(features?: string[]): ParsedAmenities {
  const amenities: ParsedAmenities = {};

  if (!features || features.length === 0) {
    return amenities;
  }

  const normalized = features.map(f => f.toLowerCase().trim());

  if (normalized.some(f => f.includes('parkova') || f.includes('parking'))) amenities.has_parking = true;
  if (normalized.some(f => f.includes('garáž') || f.includes('garaz') || f.includes('garage'))) amenities.has_garage = true;
  if (normalized.some(f => f.includes('balkón') || f.includes('balkon') || f.includes('balcony'))) amenities.has_balcony = true;
  if (normalized.some(f => f.includes('terasa') || f.includes('terrace'))) amenities.has_terrace = true;
  if (normalized.some(f => f.includes('pivnica') || f.includes('sklep') || f.includes('basement'))) amenities.has_basement = true;
  if (normalized.some(f => f.includes('výťah') || f.includes('vytah') || f.includes('elevator') || f.includes('lift'))) amenities.has_elevator = true;
  if (normalized.some(f => f.includes('lodžia') || f.includes('lodzia') || f.includes('loggia'))) amenities.has_loggia = true;
  if (normalized.some(f => f.includes('bezbariér') || f.includes('bezbarier') || f.includes('barrier'))) amenities.is_barrier_free = true;
  if (normalized.some(f => f.includes('zviera') || f.includes('pet'))) amenities.is_pet_friendly = true;
  if (normalized.some(f => f.includes('záhrad') || f.includes('zahrad') || f.includes('garden'))) amenities.has_garden = true;
  if (normalized.some(f => f.includes('nízkoenerget') || f.includes('nizkoenerg') || f.includes('low energy'))) amenities.is_low_energy = true;
  if (normalized.some(f => f.includes('sauna'))) amenities.has_sauna = true;
  if (normalized.some(f => f.includes('fitness') || f.includes('posilňov') || f.includes('posilnov') || f.includes('gym'))) amenities.has_gym = true;
  if (normalized.some(f => f.includes('klimatizác') || f.includes('klimatizac') || f.includes('air condition'))) amenities.has_ac = true;
  if (normalized.some(f => f.includes('wifi') || f.includes('internet'))) amenities.has_wifi = true;
  if (normalized.some(f => f.includes('bezpečnostn') || f.includes('bezpecnostn') || f.includes('alarm') || f.includes('security'))) amenities.has_security = true;
  if (normalized.some(f => f.includes('sklad') || f.includes('komora') || f.includes('storage'))) amenities.has_storage = true;

  return amenities;
}
