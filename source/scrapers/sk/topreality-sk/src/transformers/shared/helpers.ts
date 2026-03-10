/**
 * Shared helper functions for all TopReality.sk transformers
 */

import { TopRealityListing } from '../../types/toprealityTypes';
import {
  normalizeDisposition,
  normalizeOwnership,
  normalizeCondition,
  normalizeFurnished,
  normalizeEnergyRating,
  normalizeHeatingType,
  normalizeConstructionType
} from '../../shared/slovak-value-mappings';

/**
 * Extract city from location string
 */
export function extractCity(location: string): string {
  if (!location) return '';

  const city = location
    .split(/[-,]/)[0]
    .trim()
    .replace(/\s*\d+$/, '');

  return city || location;
}

/**
 * Extract property condition from text
 * Slovak: novostavba, po rekonštrukcii, dobrý stav, etc.
 */
export function extractConditionFromText(text: string): string | undefined {
  if (!text) return undefined;
  const lower = text.toLowerCase();

  if (lower.includes('novostavb') || lower.includes('nový dom') || lower.includes('nový byt')) return 'novostavba';
  if (lower.includes('po kompletnej rekonštrukci') || lower.includes('po kompletnej rekonstrukci')) return 'po_rekonštrukcii';
  if (lower.includes('po rekonštrukci') || lower.includes('po rekonstrukci')) return 'po_rekonštrukcii';
  if (lower.includes('pred rekonštrukci') || lower.includes('pred rekonstrukci')) return 'pred_rekonštrukciou';
  if (lower.includes('vyžaduje rekonštrukci') || lower.includes('vyzaduje rekonstrukci')) return 'vyžaduje_rekonštrukciu';
  if (lower.includes('výborný stav') || lower.includes('vyborny stav')) return 'výborný';
  if (lower.includes('veľmi dobrý stav') || lower.includes('velmi dobry stav')) return 'veľmi_dobrý';
  if (lower.includes('dobrý stav') || lower.includes('dobry stav')) return 'dobrý';
  if (lower.includes('vo výstavbe') || lower.includes('vo vystavbe')) return 'vo_výstavbe';
  if (lower.includes('projekt')) return 'projekt';

  return undefined;
}

/**
 * Extract heating type from text
 * Slovak: ústredné, plynové, elektrické, etc.
 */
export function extractHeatingFromText(text: string): string | undefined {
  if (!text) return undefined;
  const lower = text.toLowerCase();

  if (lower.includes('ústredné kúreni') || lower.includes('ustredne kureni') || lower.includes('centrálne kúreni')) return 'ústredné';
  if (lower.includes('plynové kúreni') || lower.includes('plynove kureni') || lower.includes('plyn. kúreni')) return 'plynové';
  if (lower.includes('elektrické kúreni') || lower.includes('elektricke kureni')) return 'elektrické';
  if (lower.includes('tepelné čerpadl') || lower.includes('tepelne cerpadl')) return 'tepelné_čerpadlo';
  if (lower.includes('podlahové kúreni') || lower.includes('podlahove kureni')) return 'lokálne';
  if (lower.includes('kotol')) return 'kotol';

  return undefined;
}

/**
 * Extract furnished status from text
 * Slovak: zariadený, nezariadený, čiastočne zariadený
 */
export function extractFurnishedFromText(text: string): string | undefined {
  if (!text) return undefined;
  const lower = text.toLowerCase();

  if (lower.includes('čiastočne zariadený') || lower.includes('ciastocne zariadeny') || lower.includes('čiastočne zariaden')) return 'čiastočne_zariadený';
  if (lower.includes('kompletne zariadený') || lower.includes('plne zariadený') || lower.includes('zariadený byt') || lower.includes('zariadený dom')) return 'zariadený';
  if (lower.includes('zariadený') || lower.includes('zariadene') || lower.includes('zariadeny')) return 'zariadený';
  if (lower.includes('nezariadený') || lower.includes('nezariadeny') || lower.includes('nezariadene')) return 'nezariadený';

  return undefined;
}

/**
 * Extract construction type from text
 * Slovak: panel, tehla, murovaný, drevo, etc.
 */
export function extractConstructionTypeFromText(text: string): string | undefined {
  if (!text) return undefined;
  const lower = text.toLowerCase();

  if (lower.includes('panelový') || lower.includes('panelovy') || lower.includes('panelák') || lower.includes('panelak')) return 'panel';
  if (lower.includes('tehlov') || lower.includes('tehlový') || lower.includes('tehlovy')) return 'tehla';
  if (lower.includes('murovan')) return 'murovaný';
  if (lower.includes('dreven') || lower.includes('drevostavb')) return 'drevo';
  if (lower.includes('betónov') || lower.includes('betonov')) return 'betón';

  return undefined;
}

/**
 * Extract floor number from text
 * Patterns: "3. poschodie", "3/8", "prízemie", "3.p."
 */
export function extractFloorFromText(text: string): number | undefined {
  if (!text) return undefined;
  const lower = text.toLowerCase();

  if (lower.includes('prízemie') || lower.includes('prizemie')) return 0;

  // "3. poschodie" or "3.p." or "3. NP"
  const floorMatch = lower.match(/(\d+)\s*\.\s*(?:poschodie|p\b|np\b|podlažie|podlazie)/);
  if (floorMatch) return parseInt(floorMatch[1]);

  // "3/8" pattern (floor/total)
  const slashMatch = lower.match(/(\d+)\s*\/\s*(\d+)\s*(?:poschodie|podlažie|podlazie|p\b)/);
  if (slashMatch) return parseInt(slashMatch[1]);

  return undefined;
}

/**
 * Extract total floors from text
 */
export function extractTotalFloorsFromText(text: string): number | undefined {
  if (!text) return undefined;

  // "3/8" pattern (floor/total)
  const slashMatch = text.match(/\d+\s*\/\s*(\d+)\s*(?:poschodie|podlažie|podlazie|p\b)/i);
  if (slashMatch) return parseInt(slashMatch[1]);

  // "8-poschodový" or "8 podlažný"
  const totalMatch = text.match(/(\d+)\s*[-\s]?(?:poschodov|podlažn|podlazn|poschodí|poschod[ií])/i);
  if (totalMatch) return parseInt(totalMatch[1]);

  return undefined;
}

/**
 * Extract year built from text
 */
export function extractYearBuiltFromText(text: string): number | undefined {
  if (!text) return undefined;

  // "rok výstavby 1985" or "postavený v roku 2010" or "r.v. 1998"
  const yearMatch = text.match(/(?:rok výstavby|rok vystavby|postavený v roku|postaveny v roku|r\.?\s*v\.?\s*)\s*(\d{4})/i);
  if (yearMatch) {
    const year = parseInt(yearMatch[1]);
    if (year >= 1800 && year <= 2030) return year;
  }

  // "z roku 1985" (from year)
  const fromYearMatch = text.match(/z\s+roku\s+(\d{4})/i);
  if (fromYearMatch) {
    const year = parseInt(fromYearMatch[1]);
    if (year >= 1800 && year <= 2030) return year;
  }

  return undefined;
}

/**
 * Extract renovation year from text
 */
export function extractRenovationYearFromText(text: string): number | undefined {
  if (!text) return undefined;

  // "rekonštrukcia 2020" or "rekonštruovaný v roku 2018"
  const match = text.match(/(?:rekonštrukci|rekonstrukci|rekonštruovan|rekonstruovan)\w*\s*(?:v\s+roku\s+)?(\d{4})/i);
  if (match) {
    const year = parseInt(match[1]);
    if (year >= 1950 && year <= 2030) return year;
  }

  return undefined;
}

/**
 * Extract energy rating from text
 */
export function extractEnergyRatingFromText(text: string): string | undefined {
  if (!text) return undefined;

  // "energetická trieda A" or "energ. trieda B" or "trieda A"
  const match = text.match(/(?:energetick[áa]\s+)?trieda\s+([A-Ga-g])\b/i);
  if (match) return match[1];

  return undefined;
}

/**
 * Extract deposit amount from text
 */
export function extractDepositFromText(text: string): number | undefined {
  if (!text) return undefined;

  // "depozit 500 €" or "kaucia 1000" or "záloha 800 €"
  const match = text.match(/(?:depozit|kaucia|záloha|zaloha)\s*:?\s*(\d[\d\s,.]*)\s*€?/i);
  if (match) {
    const cleaned = match[1].replace(/[\s,]/g, '');
    const amount = parseFloat(cleaned);
    if (!isNaN(amount) && amount > 0) return amount;
  }

  return undefined;
}

/**
 * Extract plot area from text
 */
export function extractAreaPlotFromText(text: string): number | undefined {
  if (!text) return undefined;

  // "pozemok 500 m²" or "záhrada 200 m2" or "parcela 800m²"
  const match = text.match(/(?:pozemok|záhrada|zahrada|parcela)\s*:?\s*(\d+)\s*m[²2]/i);
  if (match) return parseInt(match[1]);

  return undefined;
}

/**
 * Extract amenities (boolean features) from text
 */
export function extractAmenitiesFromText(text: string): Record<string, boolean> {
  if (!text) return {};
  const lower = text.toLowerCase();

  return {
    has_parking: lower.includes('parking') || lower.includes('parkovanie') || lower.includes('parkovac'),
    has_garage: lower.includes('garáž') || lower.includes('garaz') || lower.includes('garážov'),
    has_balcony: lower.includes('balkón') || lower.includes('balkon') || lower.includes('balkón'),
    has_terrace: lower.includes('terasa') || lower.includes('terasou') || lower.includes('terasy'),
    has_elevator: lower.includes('výťah') || lower.includes('vytah') || lower.includes('výťah'),
    has_basement: lower.includes('pivnic') || lower.includes('suterén') || lower.includes('suteren'),
    has_garden: lower.includes('záhrad') || lower.includes('zahrad'),
    has_pool: lower.includes('bazén') || lower.includes('bazen'),
    has_fireplace: lower.includes('krb') || lower.includes('kozub'),
    has_ac: lower.includes('klimatizáci') || lower.includes('klimatizaci'),
    has_loggia: lower.includes('loggia') || lower.includes('lódži') || lower.includes('lodzia'),
  };
}

// ============================================================================
// MAPPING HELPERS: Slovak → English canonical values
// ============================================================================

export function mapConditionToEnglish(slovakCondition: any): string | undefined {
  if (!slovakCondition) return undefined;
  const mapping: Record<string, string> = {
    'novostavba': 'new',
    'výborný': 'excellent',
    'veľmi_dobrý': 'very_good',
    'dobrý': 'good',
    'po_rekonštrukcii': 'after_renovation',
    'pred_rekonštrukciou': 'before_renovation',
    'vyžaduje_rekonštrukciu': 'before_renovation',
    'projekt': 'under_construction',
    'vo_výstavbe': 'under_construction'
  };
  return mapping[slovakCondition];
}

export function mapFurnishedToEnglish(slovakFurnished: any): 'furnished' | 'partially_furnished' | 'unfurnished' | undefined {
  if (!slovakFurnished) return undefined;
  const mapping: Record<string, 'furnished' | 'partially_furnished' | 'unfurnished'> = {
    'zariadený': 'furnished',
    'čiastočne_zariadený': 'partially_furnished',
    'nezariadený': 'unfurnished'
  };
  return mapping[slovakFurnished];
}

export function mapHeatingToEnglish(slovakHeating: any): string | undefined {
  if (!slovakHeating) return undefined;
  const mapping: Record<string, string> = {
    'ústredné': 'central_heating',
    'lokálne': 'individual_heating',
    'elektrické': 'electric_heating',
    'plynové': 'gas_heating',
    'kotol': 'gas_heating',
    'tepelné_čerpadlo': 'heat_pump',
    'iné': 'other'
  };
  return mapping[slovakHeating];
}

export function mapConstructionToEnglish(slovakConstruction: any): string | undefined {
  if (!slovakConstruction) return undefined;
  const mapping: Record<string, string> = {
    'panel': 'panel',
    'tehla': 'brick',
    'murovaný': 'stone',
    'drevo': 'wood',
    'betón': 'concrete',
    'zmiešaný': 'mixed',
    'iný': 'other'
  };
  return mapping[slovakConstruction];
}

/**
 * Map TopReality.sk transaction type to standard type
 */
export function mapTransactionType(transactionType: string): 'sale' | 'rent' {
  const typeMap: Record<string, 'sale' | 'rent'> = {
    'predaj': 'sale',
    'prenajom': 'rent',
    'prenájom': 'rent'
  };
  return typeMap[transactionType.toLowerCase()] || 'sale';
}
