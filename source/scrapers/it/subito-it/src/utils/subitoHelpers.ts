import { SubitoItem, SubitoFeature } from '../types/subitoTypes';

/**
 * Extract ad ID from Subito URN.
 * Hades API URN format: "id:ad:608241847:list:636897239"
 * The ad/listing ID is the last colon-separated segment.
 */
export function extractIdFromUrn(urn: string): string {
  const parts = urn.split(':');
  return parts[parts.length - 1];
}

/**
 * Find a feature by its URI (e.g. "/price", "/size", "/room") and return the first value string.
 * URI-based lookup is more reliable than label-based when the URI is known.
 */
export function getFeatureValueByUri(features: SubitoFeature[] | undefined, uri: string): string | undefined {
  if (!features) return undefined;
  const found = features.find(f => f.uri === uri);
  if (found && found.values.length > 0) return found.values[0].value;
  return undefined;
}

/**
 * Find a feature by its Italian label and return the first value string.
 */
export function getFeatureValue(features: SubitoFeature[] | undefined, ...labels: string[]): string | undefined {
  if (!features) return undefined;
  for (const label of labels) {
    const found = features.find(f => f.label.toLowerCase() === label.toLowerCase());
    if (found && found.values.length > 0) {
      return found.values[0].value;
    }
  }
  return undefined;
}

/**
 * Parse numeric value from a string, stripping non-numeric chars.
 * Returns undefined if not parseable.
 */
export function parseNumeric(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const cleaned = value.replace(/[^\d.,]/g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? undefined : num;
}

/**
 * Parse floor value from Italian string.
 * "piano terra" / "T" => 0, "seminterrato" => -1, "2" => 2, etc.
 */
export function parseFloor(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const lower = value.toLowerCase().trim();
  if (lower === 'terra' || lower === 'piano terra' || lower === 't' || lower === 'ground') return 0;
  if (lower === 'seminterrato' || lower === 's' || lower === 'basement') return -1;
  if (lower === 'rialzato' || lower === 'r') return 0;
  if (lower === 'ultimo piano' || lower === 'attico') return 99; // sentinel for top floor
  const num = parseInt(value);
  return isNaN(num) ? undefined : num;
}

/**
 * Extract images from SubitoItem.
 * Prefers the largest scale available.
 */
export function extractImages(item: SubitoItem): string[] {
  if (!item.images || item.images.length === 0) return [];
  return item.images
    .map(img => {
      // scales ordered by size; take largest
      if (!img.scale || img.scale.length === 0) return null;
      const largest = img.scale[img.scale.length - 1];
      return largest.secureUri || largest.uri || null;
    })
    .filter((url): url is string => url !== null);
}

/**
 * Build a canonical source URL from item data.
 * Hades API provides urls.default (full URL).
 */
export function buildSourceUrl(item: SubitoItem): string {
  if (item.urls?.default) return item.urls.default;
  const id = extractIdFromUrn(item.urn);
  return `https://www.subito.it/annunci/immobili/vendita/annuncio-${id}.htm`;
}

/**
 * Determine transaction type from Subito contract string.
 */
export function mapTransactionType(contract: 'vendita' | 'affitto'): 'sale' | 'rent' {
  return contract === 'vendita' ? 'sale' : 'rent';
}

/**
 * Map Italian condition strings to TierI condition values.
 */
export function mapCondition(value: string | undefined): 'new' | 'excellent' | 'good' | 'after_renovation' | 'requires_renovation' | undefined {
  if (!value) return undefined;
  const lower = value.toLowerCase();
  if (lower.includes('nuovo') || lower.includes('nuova costruzione')) return 'new';
  if (lower.includes('ottimo') || lower.includes('ristrutturato')) return 'after_renovation';
  if (lower.includes('buono') || lower.includes('buone')) return 'good';
  if (lower.includes('da ristrutturare') || lower.includes('abitabile')) return 'requires_renovation';
  return undefined;
}
