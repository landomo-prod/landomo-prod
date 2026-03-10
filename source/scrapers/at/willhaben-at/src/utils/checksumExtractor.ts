import { ChecksumFields, createListingChecksum, ListingChecksum } from '@landomo/core';
import { WillhabenListing, getAttribute } from '../types/willhabenTypes';

export function extractWillhabenChecksumFields(listing: WillhabenListing): ChecksumFields {
  return {
    price: parseFloat(getAttribute(listing, 'PRICE')?.replace(/[€\s.]/g, '').replace(',', '.') || '') || null,
    title: getAttribute(listing, 'HEADING') || listing.description || null,
    description: getAttribute(listing, 'BODY_DYN') || null,
    bedrooms: parseFloat(getAttribute(listing, 'NUMBER_OF_ROOMS') || '') || null,
    bathrooms: null,
    sqm: parseFloat(getAttribute(listing, 'ESTATE_SIZE/LIVING_AREA')?.replace(/[^\d.,]/g, '').replace(',', '.') || '') || null,
  };
}

export function createWillhabenChecksum(listing: WillhabenListing): ListingChecksum {
  const portalId = listing.id?.toString();

  if (!portalId) {
    throw new Error('Listing missing id');
  }

  return createListingChecksum('willhaben', portalId, listing, extractWillhabenChecksumFields);
}

export function batchCreateWillhabenChecksums(listings: WillhabenListing[]): ListingChecksum[] {
  return listings.map(createWillhabenChecksum);
}
