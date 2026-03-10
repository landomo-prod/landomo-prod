import { ChecksumFields, createListingChecksum, ListingChecksum } from '@landomo/core';
import { EnalquilerListingRaw } from '../types/enalquilerTypes';

export function extractEnalquilerChecksumFields(listing: EnalquilerListingRaw): ChecksumFields {
  return {
    price: listing.price ?? null,
    title: listing.title ?? null,
    description: listing.description ?? null,
    bedrooms: listing.rooms ?? null,
    bathrooms: listing.bathrooms ?? null,
    sqm: listing.sqm ?? null,
  };
}

export function createEnalquilerChecksum(listing: EnalquilerListingRaw): ListingChecksum {
  if (!listing.id) {
    throw new Error('Listing missing id');
  }
  return createListingChecksum('enalquiler', listing.id, listing, extractEnalquilerChecksumFields);
}

export function batchCreateEnalquilerChecksums(listings: EnalquilerListingRaw[]): ListingChecksum[] {
  return listings.map(createEnalquilerChecksum);
}
