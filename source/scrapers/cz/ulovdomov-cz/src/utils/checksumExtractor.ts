import { ChecksumFields, createListingChecksum, ListingChecksum } from '@landomo/core';
import { UlovDomovOffer } from '../types/ulovdomovTypes';

export function extractUlovDomovChecksumFields(offer: UlovDomovOffer): ChecksumFields {
  const price = offer.rentalPrice?.value ?? null;
  const location = [offer.village?.title, offer.villagePart?.title].filter(Boolean).join(', ') || null;
  return {
    price,
    title: offer.title ?? null,
    description: location,
    sqm: offer.area ?? null,
    disposition: offer.disposition ?? null,
    floor: offer.floorLevel ?? null,
  };
}

export function createUlovDomovChecksum(offer: UlovDomovOffer): ListingChecksum {
  if (!offer.id) throw new Error('Offer missing id');
  return createListingChecksum('ulovdomov', String(offer.id), offer, extractUlovDomovChecksumFields);
}

export function batchCreateUlovDomovChecksums(offers: UlovDomovOffer[]): ListingChecksum[] {
  return offers.map(createUlovDomovChecksum);
}
