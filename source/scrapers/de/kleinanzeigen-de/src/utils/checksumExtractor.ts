import { ChecksumFields, createListingChecksum, ListingChecksum } from '@landomo/core';
import { KleinanzeigenListing } from '../types/kleinanzeigenTypes';

export function extractKleinanzeigenChecksumFields(listing: KleinanzeigenListing): ChecksumFields {
  return {
    price: listing.price?.amount ?? null,
    title: listing.title ?? null,
    description: listing.description?.value || listing.description?.text || null,
    bedrooms: listing.rooms ? Math.floor(listing.rooms - 1) : null,
    bathrooms: null,
    sqm: listing.livingSpace ?? null,
  };
}

export function createKleinanzeigenChecksum(listing: KleinanzeigenListing): ListingChecksum {
  const portalId = listing.id?.toString();

  if (!portalId) {
    throw new Error('Listing missing id');
  }

  return createListingChecksum('kleinanzeigen', portalId, listing, extractKleinanzeigenChecksumFields);
}

export function batchCreateKleinanzeigenChecksums(listings: KleinanzeigenListing[]): ListingChecksum[] {
  return listings.map(createKleinanzeigenChecksum);
}
