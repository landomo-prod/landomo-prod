import { ChecksumFields, createListingChecksum, ListingChecksum } from '@landomo/core';

export function extractImmowebChecksumFields(listing: any): ChecksumFields {
  return {
    price: listing.transaction?.sale?.price ?? listing.transaction?.rental?.monthlyRentalPrice ?? listing.price ?? null,
    title: listing.property?.title ?? listing.title ?? null,
    description: null,
    bedrooms: listing.property?.bedroomCount ?? listing.bedroomCount ?? null,
    bathrooms: listing.property?.bathroomCount ?? listing.bathroomCount ?? null,
    sqm: listing.property?.netHabitableSurface ?? listing.netHabitableSurface ?? null,
  };
}

export function createImmowebChecksum(listing: any): ListingChecksum {
  const portalId = (listing.id ?? listing.classified_id)?.toString();
  if (!portalId) throw new Error('Listing missing id');
  return createListingChecksum('immoweb', portalId, listing, extractImmowebChecksumFields);
}

export function batchCreateImmowebChecksums(listings: any[]): ListingChecksum[] {
  return listings.map(createImmowebChecksum);
}
