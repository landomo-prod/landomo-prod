import { ChecksumFields, createListingChecksum, ListingChecksum } from '@landomo/core';
import { BieniciListingRaw } from '../types/bieniciTypes';

export function extractBieniciChecksumFields(listing: BieniciListingRaw): ChecksumFields {
  return {
    price: listing.price ?? null,
    title: listing.title != null ? String(listing.title) : null,
    description: listing.description != null ? String(listing.description) : null,
    bedrooms: listing.bedroomsQuantity ?? null,
    bathrooms: listing.bathroomsQuantity ?? null,
    sqm: listing.surfaceArea ?? null,
  };
}

export function createBieniciChecksum(listing: BieniciListingRaw): ListingChecksum {
  const portalId = listing.portalId || `bienici-${listing.id}`;
  if (!portalId) {
    throw new Error('Listing missing portalId/id');
  }
  return createListingChecksum('bienici', portalId, listing, extractBieniciChecksumFields);
}

export function batchCreateBieniciChecksums(listings: BieniciListingRaw[]): ListingChecksum[] {
  return listings.map(createBieniciChecksum);
}
