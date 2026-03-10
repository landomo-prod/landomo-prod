import { BoligsidenCase, BoligsidenBuilding } from '../types/boligsidenTypes';

/**
 * Shared utility functions for Boligsiden transformers
 */

/**
 * Build a human-readable address string from a Boligsiden listing
 */
export function buildAddress(listing: BoligsidenCase): string {
  const addr = listing.address;
  const parts = [
    addr.roadName,
    addr.houseNumber,
  ].filter(Boolean);

  const streetPart = parts.join(' ');
  const cityPart = [addr.zipCode || addr.zip?.zipCode, addr.cityName || addr.city?.name]
    .filter(Boolean)
    .join(' ');

  return [streetPart, cityPart].filter(Boolean).join(', ');
}

/**
 * Build the canonical URL for a Boligsiden listing
 *
 * Uses the slug from the listing to create the boligsiden.dk URL.
 * The external caseUrl (from the realtor's system) is stored in portal_metadata.
 */
export function buildSourceUrl(listing: BoligsidenCase): string {
  if (listing.slug) {
    return `https://www.boligsiden.dk/adresse/${listing.slug}`;
  }
  if (listing.slugAddress) {
    return `https://www.boligsiden.dk/adresse/${listing.slugAddress}`;
  }
  // Fallback to the realtor's case URL
  return listing.caseUrl || `https://www.boligsiden.dk/cases/${listing.caseID}`;
}

/**
 * Get the main/primary building from address buildings array
 * Boligsiden returns multiple buildings for a property (main house, garage, shed etc.)
 */
export function getMainBuilding(listing: BoligsidenCase): BoligsidenBuilding | undefined {
  const buildings = listing.address?.buildings || [];
  if (buildings.length === 0) return undefined;

  // Prefer building with housingArea (inhabited space) and buildingNumber "1"
  const mainBuilding = buildings.find(b => b.buildingNumber === '1' && (b.housingArea || 0) > 0);
  if (mainBuilding) return mainBuilding;

  // Otherwise return the first building with housingArea
  const withHousingArea = buildings.find(b => (b.housingArea || 0) > 0);
  if (withHousingArea) return withHousingArea;

  // Fallback to first building
  return buildings[0];
}

/**
 * Normalize Boligsiden energy label to standard format
 *
 * Boligsiden uses Danish energy labels: a2020, a2015, a2010, b, c, d, e, f, g
 * Standard format: A+, A, B, C, D, E, F, G
 */
export function normalizeEnergyLabel(
  label?: string
): 'A+' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | undefined {
  if (!label) return undefined;

  const normalized = label.toLowerCase().trim();

  // Handle Danish variants like a2020, a2015, a2010 (all are A or A+)
  if (normalized === 'a2020') return 'A+';
  if (normalized === 'a2015') return 'A';
  if (normalized === 'a2010') return 'A';
  if (normalized === 'a') return 'A';
  if (normalized === 'b') return 'B';
  if (normalized === 'c') return 'C';
  if (normalized === 'd') return 'D';
  if (normalized === 'e') return 'E';
  if (normalized === 'f') return 'F';
  if (normalized === 'g') return 'G';

  return undefined;
}
