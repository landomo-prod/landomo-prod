import { ApartmentPropertyTierI } from '@landomo/core';
import { MblRentalListing } from '../types/mblTypes';

const PORTAL = 'mbl-is';

function buildRentalTitle(listing: MblRentalListing): string {
  const parts: string[] = [];
  if (listing.address) parts.push(listing.address);
  if (listing.postal_code?.city) parts.push(listing.postal_code.city);
  return parts.length > 0 ? parts.join(', ') : `Leiga ${listing.id}`;
}

export function transformRentalListing(listing: MblRentalListing): ApartmentPropertyTierI {
  const images: string[] = [];
  if (listing.images && listing.images.length > 0 && listing.images[0].big) {
    images.push(listing.images[0].big);
  }

  const city = listing.postal_code?.city ?? 'Iceland';
  const zipCode = listing.zipcode != null ? String(listing.zipcode) : undefined;

  const apt: ApartmentPropertyTierI = {
    property_category: 'apartment',
    title: buildRentalTitle(listing),
    price: listing.price ?? 0,
    currency: 'ISK',
    transaction_type: 'rent',
    location: {
      address: listing.address ?? undefined,
      city,
      country: 'IS',
      postal_code: zipCode,
    },
    source_url: `https://fasteignir.mbl.is/leiga/${listing.id}/`,
    source_platform: PORTAL,
    status: 'active',
    sqm: listing.size ?? 0,
    rooms: listing.rooms ?? undefined,
    bedrooms: 0,
    has_elevator: listing.lift === true,
    has_balcony: false,
    has_parking: false,
    has_basement: false,
    description: listing.description ?? undefined,
    published_date: listing.created ?? undefined,
    available_from: listing.available_from ?? undefined,
    images: images.length > 0 ? images : undefined,
    country_specific: {
      pet_allowed: listing.pet_allowed,
      type_id: listing.type_id,
      listing_type: 'rental',
    },
  };

  return apt;
}
