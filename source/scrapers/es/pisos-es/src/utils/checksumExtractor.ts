import { ChecksumFields, createListingChecksum, ListingChecksum } from '@landomo/core';
import { PisosListingRaw } from '../types/pisosTypes';

export function extractPisosChecksumFields(listing: PisosListingRaw): ChecksumFields {
  return {
    price: listing.price ?? null,
    title: listing.title ?? null,
    description: listing.description ?? null,
    bedrooms: listing.bedrooms ?? null,
    bathrooms: listing.bathrooms ?? null,
    sqm: listing.sqm ?? null,
  };
}

export function createPisosChecksum(listing: PisosListingRaw): ListingChecksum {
  if (!listing.portalId) {
    throw new Error('Listing missing portalId');
  }
  return createListingChecksum('pisos-com', listing.portalId, listing, extractPisosChecksumFields);
}

export function batchCreatePisosChecksums(listings: PisosListingRaw[]): ListingChecksum[] {
  return listings.map(createPisosChecksum);
}
