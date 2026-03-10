import { ChecksumFields, createListingChecksum, ListingChecksum } from '@landomo/core';
import { RealityListing, RealityApiListItem } from '../types/realityTypes';

/**
 * Extract checksum fields from a full Reality.cz detail listing.
 * Used when we already have a fully-fetched RealityListing.
 */
export function extractRealityChecksumFields(listing: RealityListing): ChecksumFields {
  const disposition = listing.information.find(i => i.key === 'Dispozice')?.value ?? null;
  const sqmStr = listing.information.find(i => i.key === 'Plocha' || i.key === 'Užitná plocha')?.value;
  const sqm = sqmStr ? parseFloat(sqmStr.replace(/[^\d.,]/g, '').replace(',', '.')) || null : null;
  const floorStr = listing.information.find(i => i.key === 'Podlaží' || i.key === 'Patro')?.value;
  const floor = floorStr ? parseInt(floorStr) || null : null;

  return {
    price: listing.price ?? null,
    title: listing.title ?? null,
    description: listing.description ?? null,
    sqm,
    disposition,
    floor,
  };
}

export function createRealityChecksum(listing: RealityListing): ListingChecksum {
  const portalId = listing.id;
  if (!portalId) throw new Error('Listing missing id');
  return createListingChecksum('reality', portalId, listing, extractRealityChecksumFields);
}

export function batchCreateRealityChecksums(listings: RealityListing[]): ListingChecksum[] {
  return listings.map(createRealityChecksum);
}

/**
 * Extract checksum fields from a search result (RealityApiListItem).
 *
 * The search result already contains: id, type (encodes disposition + sqm),
 * place, and price — enough to detect any meaningful change without fetching
 * the detail page. This is the key to Phase 1 speed.
 */
export function extractListItemChecksumFields(item: RealityApiListItem): ChecksumFields {
  const price = item.price?.sale?.price ?? item.price?.rent?.price ?? null;
  return {
    price,
    title: item.type ?? null,   // "byt 2+1, 62 m², panel, osobní" - encodes disposition+sqm
    description: item.place ?? null,
    sqm: null,
    disposition: null,
    floor: null,
  };
}

export function createListItemChecksum(item: RealityApiListItem): ListingChecksum {
  if (!item.id) throw new Error('ListItem missing id');
  return createListingChecksum('reality', item.id, item, extractListItemChecksumFields);
}

export function batchCreateListItemChecksums(items: RealityApiListItem[]): ListingChecksum[] {
  return items.map(createListItemChecksum);
}
