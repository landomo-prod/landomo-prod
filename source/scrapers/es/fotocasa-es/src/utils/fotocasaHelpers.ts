import { FotocasaFeature, FotocasaListing, CONSERVATION_STATES, FOTOCASA_TRANSACTION_TYPES } from '../types/fotocasaTypes';

/**
 * Extract a numeric feature value from Fotocasa features array
 */
export function getFeatureValue(features: FotocasaFeature[], key: string): number | null {
  const feature = features?.find(f => f.key === key);
  if (!feature || !feature.value || feature.value.length === 0) return null;
  return feature.value[0] || null;
}

/**
 * Check if a boolean feature is present (value > 0)
 */
export function hasFeature(features: FotocasaFeature[], key: string): boolean {
  const value = getFeatureValue(features, key);
  return value !== null && value > 0;
}

/**
 * Extract price from transactions
 */
export function extractPrice(listing: FotocasaListing): number {
  const transaction = listing.transactions?.[0];
  if (!transaction || !transaction.value || transaction.value.length === 0) return 0;
  return transaction.value[0] || 0;
}

/**
 * Extract transaction type (sale/rent)
 */
export function extractTransactionType(listing: FotocasaListing): 'sale' | 'rent' {
  const transaction = listing.transactions?.[0];
  if (!transaction) return 'sale';
  return transaction.transactionTypeId === FOTOCASA_TRANSACTION_TYPES.RENT ? 'rent' : 'sale';
}

/**
 * Extract conservation/condition state
 */
export function extractCondition(features: FotocasaFeature[]): string | undefined {
  const stateValue = getFeatureValue(features, 'conservationState');
  if (stateValue === null) return undefined;
  return CONSERVATION_STATES[stateValue] || undefined;
}

/**
 * Extract city from Fotocasa location
 */
export function extractCity(listing: FotocasaListing): string {
  const loc = listing.address?.location;
  if (!loc) return '';
  return loc.level5 || loc.upperLevel || loc.level4 || loc.level3 || loc.level2 || '';
}

/**
 * Extract region/province from Fotocasa location
 */
export function extractRegion(listing: FotocasaListing): string {
  const loc = listing.address?.location;
  if (!loc) return '';
  return loc.level2 || loc.level1 || '';
}

/**
 * Build source URL from detail path
 */
export function buildSourceUrl(listing: FotocasaListing): string {
  const detailPath = listing.detail?.es;
  if (detailPath) {
    return `https://www.fotocasa.es${detailPath}`;
  }
  return `https://www.fotocasa.es/es/comprar/viviendas/${listing.id}`;
}

/**
 * Extract images from multimedias array
 */
export function extractImages(listing: FotocasaListing): string[] {
  if (!listing.multimedias) return [];
  return listing.multimedias
    .filter(m => m.typeId === 2) // Only images
    .map(m => m.url)
    .filter(Boolean);
}

/**
 * Extract virtual tour URL
 */
export function extractVirtualTourUrl(listing: FotocasaListing): string | undefined {
  if (!listing.multimedias) return undefined;
  const tour = listing.multimedias.find(m => m.typeId === 12);
  return tour?.url || undefined;
}

/**
 * Extract video URL
 */
export function extractVideoUrl(listing: FotocasaListing): string | undefined {
  if (!listing.multimedias) return undefined;
  const video = listing.multimedias.find(m => m.typeId === 21);
  return video?.url || undefined;
}

/**
 * Estimate bedrooms from rooms count
 * Spanish convention: rooms = bedrooms (dormitorios)
 */
export function estimateBedrooms(rooms: number | null): number {
  if (rooms === null || rooms <= 0) return 0;
  return rooms;
}
