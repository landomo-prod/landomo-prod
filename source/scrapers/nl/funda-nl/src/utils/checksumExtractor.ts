import { ChecksumFields, createListingChecksum, ListingChecksum } from '@landomo/core';
import { FundaSearchResult } from '../types/rawTypes';

export function extractFundaChecksumFields(listing: FundaSearchResult): ChecksumFields {
  return {
    price: listing.KoopPrijs ?? listing.HuurPrijs ?? null,
    title: listing.Adres ?? null,
    description: listing.Omschrijving ?? null,
    bedrooms: listing.AantalSlaapkamers ?? null,
    bathrooms: listing.AantalBadkamers ?? null,
    sqm: listing.WoonOppervlakte ?? null,
  };
}

export function createFundaChecksum(listing: FundaSearchResult): ListingChecksum {
  const portalId = listing.Id?.toString() || listing.GlobalId?.toString();
  if (!portalId) {
    throw new Error('Listing missing Id and GlobalId');
  }
  return createListingChecksum('funda', portalId, listing, extractFundaChecksumFields);
}

export function batchCreateFundaChecksums(listings: FundaSearchResult[]): ListingChecksum[] {
  return listings.map(createFundaChecksum);
}
