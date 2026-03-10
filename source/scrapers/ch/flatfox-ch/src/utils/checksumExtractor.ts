import { ChecksumFields, createListingChecksum, ListingChecksum } from '@landomo/core';
import { FlatfoxListing } from '../types/flatfoxTypes';

export function extractFlatfoxChecksumFields(listing: FlatfoxListing): ChecksumFields {
  return {
    price: listing.price_display ?? listing.rent_gross ?? listing.rent_net ?? null,
    title: listing.public_title ?? listing.short_title ?? null,
    description: listing.description ?? null,
    bedrooms: listing.number_of_rooms ? parseFloat(listing.number_of_rooms) : null,
    bathrooms: null,
    sqm: listing.livingspace ?? null,
  };
}

export function createFlatfoxChecksum(listing: FlatfoxListing): ListingChecksum {
  const portalId = listing.pk?.toString();

  if (!portalId) {
    throw new Error('Listing missing pk');
  }

  return createListingChecksum('flatfox-ch', portalId, listing, extractFlatfoxChecksumFields);
}

export function batchCreateFlatfoxChecksums(listings: FlatfoxListing[]): ListingChecksum[] {
  return listings.map(createFlatfoxChecksum);
}
