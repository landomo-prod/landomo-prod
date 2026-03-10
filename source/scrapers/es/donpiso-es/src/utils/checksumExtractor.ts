import { ChecksumFields, createListingChecksum, ListingChecksum } from '@landomo/core';
import { DonpisoListingRaw } from '../types/donpisoTypes';

export function extractDonpisoChecksumFields(listing: DonpisoListingRaw): ChecksumFields {
  return {
    price: listing.price ?? null,
    title: listing.title ?? null,
    description: listing.description ?? null,
    bedrooms: null,  // Not available on listing pages; extracted at detail stage
    bathrooms: null,
    sqm: null,
  };
}

export function createDonpisoChecksum(listing: DonpisoListingRaw): ListingChecksum {
  if (!listing.portalId) {
    throw new Error('Listing missing portalId');
  }
  return createListingChecksum('donpiso', listing.portalId, listing, extractDonpisoChecksumFields);
}

export function batchCreateDonpisoChecksums(listings: DonpisoListingRaw[]): ListingChecksum[] {
  return listings.map(createDonpisoChecksum);
}
