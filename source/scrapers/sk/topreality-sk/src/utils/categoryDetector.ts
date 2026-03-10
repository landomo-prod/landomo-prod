import { TopRealityListing } from '../types/toprealityTypes';

/**
 * Category Detection for TopReality.sk Listings
 *
 * Uses propertyType field to determine partition routing
 */

export type PropertyCategory = 'apartment' | 'house' | 'land' | 'commercial';

/**
 * Detect property category from TopReality.sk listing
 *
 * TopReality.sk property types:
 * - byty (apartments) → apartment
 * - domy (houses) → house
 * - pozemky (land) → land
 * - komerčné (commercial) → house (non-residential building)
 * - ostatné (other) → house (default)
 */
export function detectCategory(listing: TopRealityListing): PropertyCategory {
  const propertyType = (listing.propertyType || '').toLowerCase().trim();

  // Apartment category
  if (
    propertyType.includes('byt') ||
    propertyType === 'apartment' ||
    propertyType === 'apartments' ||
    propertyType.includes('garsónka') ||
    propertyType.includes('garsonka') ||
    propertyType === 'studio'
  ) {
    return 'apartment';
  }

  // Land category
  if (
    propertyType.includes('pozemok') ||
    propertyType.includes('pozemky') ||
    propertyType === 'land' ||
    propertyType === 'lands'
  ) {
    return 'land';
  }

  // Commercial category
  if (
    propertyType.includes('komerčn') ||
    propertyType.includes('komercn') ||
    propertyType === 'commercial' ||
    propertyType.includes('kancelár') ||
    propertyType.includes('kancelar') ||
    propertyType.includes('obchodn')
  ) {
    return 'commercial';
  }

  // House category (includes other and default)
  if (
    propertyType.includes('dom') ||
    propertyType === 'house' ||
    propertyType === 'houses' ||
    propertyType.includes('rodinný') ||
    propertyType.includes('rodinny') ||
    propertyType.includes('ostatn')
  ) {
    return 'house';
  }

  // Default fallback: analyze other fields
  // If there are rooms (2+), it's likely an apartment
  if (listing.rooms && listing.rooms >= 2) {
    return 'apartment';
  }

  // If title/description mentions pozemok
  const allText = [listing.title, listing.description].filter(Boolean).join(' ').toLowerCase();
  if (allText.includes('pozemok') || allText.includes('pozemky')) {
    return 'land';
  }

  // Default to house (most versatile category)
  return 'house';
}
