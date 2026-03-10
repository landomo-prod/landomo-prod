import { OikotieMedia } from '../types/etuoviTypes';

/**
 * Parse price string like "297 000 €" or "1 200 € / kk" to number.
 * Returns 0 if parsing fails.
 */
export function parsePrice(priceStr: string | null): number {
  if (!priceStr) return 0;
  // Remove currency symbol, spaces, non-breaking spaces
  const cleaned = priceStr.replace(/[€\s\u00a0]/g, '').replace(/\/.*$/, '').trim();
  const num = parseFloat(cleaned.replace(',', '.'));
  return isNaN(num) ? 0 : num;
}

/**
 * Parse area string like "83 m²" or "1 589 m²" to number.
 * Returns 0 if parsing fails.
 */
export function parseSqm(sizeStr: string | null): number {
  if (!sizeStr) return 0;
  const match = sizeStr.match(/[\d\s\u00a0]+/);
  if (!match) return 0;
  const cleaned = match[0].replace(/[\s\u00a0]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Build sorted image URL list from Oikotie media objects.
 * Prefers desktop WebP for quality, falls back to large JPEG.
 */
export function buildImageList(medias: OikotieMedia[]): string[] {
  return medias.map(m => m.imageDesktopWebP || m.imageLargeJPEG || m.imageSmallJPEG);
}

/**
 * Map Oikotie condition string to standardized condition.
 */
export function mapCondition(
  condition: string | null
): 'new' | 'excellent' | 'good' | 'after_renovation' | 'requires_renovation' | undefined {
  if (!condition) return undefined;
  const c = condition.toLowerCase();
  if (c.includes('uusi') || c.includes('new')) return 'new';
  if (c.includes('erinomainen') || c.includes('excellent')) return 'excellent';
  if (c.includes('hyva') || c.includes('good')) return 'good';
  if (c.includes('remontoitu') || c.includes('renovated')) return 'after_renovation';
  if (c.includes('remontti') || c.includes('requires')) return 'requires_renovation';
  return undefined;
}

/**
 * Map Oikotie contractType to transaction_type.
 * 1 = sale, 2 = rent
 */
export function mapTransactionType(contractType: number): 'sale' | 'rent' {
  return contractType === 2 ? 'rent' : 'sale';
}
