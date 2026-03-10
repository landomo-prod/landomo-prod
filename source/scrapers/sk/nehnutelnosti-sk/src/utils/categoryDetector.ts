import { NehnutelnostiListing } from '../types/nehnutelnostiTypes';

/**
 * Category Detection for Nehnutelnosti.sk Listings
 *
 * Uses property_type and category fields to determine partition routing
 */

export type PropertyCategory = 'apartment' | 'house' | 'land' | 'commercial';

/**
 * Detect property category from Nehnutelnosti.sk listing
 *
 * Nehnutelnosti.sk categories:
 * - byty (apartments) → apartment
 * - domy (houses) → house
 * - pozemky (land) → land
 * - garsónka (studio) → apartment
 * - garáž (garage) → house (building)
 * - komerčné (commercial) → house (non-residential building)
 */
export function detectCategory(listing: NehnutelnostiListing): PropertyCategory {
  const propertyType = (listing.property_type || listing.category || '').toLowerCase().trim();

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

  // House category (includes garages, recreational)
  if (
    propertyType.includes('dom') ||
    propertyType === 'house' ||
    propertyType === 'houses' ||
    propertyType.includes('rodinný') ||
    propertyType.includes('rodinny') ||
    propertyType.includes('garáž') ||
    propertyType.includes('garaz')
  ) {
    return 'house';
  }

  // Default fallback: analyze other fields
  // If there's disposition (e.g., "2+kk"), it's likely an apartment
  if (listing.disposition && /\d+\s*\+\s*(kk|1)/.test(listing.disposition)) {
    return 'apartment';
  }

  // If there's land area but no building area, it's likely land
  if (listing.area_land && !listing.area_build && !listing.usable_area) {
    return 'land';
  }

  // Default to house (most versatile category)
  return 'house';
}
