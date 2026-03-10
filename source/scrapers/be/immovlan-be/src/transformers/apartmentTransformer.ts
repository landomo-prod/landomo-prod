import { ApartmentPropertyTierI } from '@landomo/core';

export function transformApartment(raw: any, transactionType: string): ApartmentPropertyTierI {
  const addr = raw.address || {};

  return {
    property_category: 'apartment',
    title: raw.title || `Apartment in ${addr.city || 'Belgium'}`,
    price: raw.price ?? 0,
    currency: 'EUR',
    transaction_type: transactionType === 'sale' ? 'sale' : 'rent',
    location: {
      address: [addr.street, addr.number].filter(Boolean).join(' ') || undefined,
      city: addr.city || undefined,
      zip_code: addr.postalCode || undefined,
      region: addr.province || undefined,
      country: 'BE',
      latitude: addr.latitude || undefined,
      longitude: addr.longitude || undefined,
    },
    bedrooms: raw.bedrooms ?? 0,
    bathrooms: raw.bathrooms,
    sqm: raw.surface ?? 0,
    floor: raw.building?.floor,
    total_floors: raw.building?.floors,
    has_elevator: raw.features?.hasLift ?? false,
    has_balcony: raw.features?.hasBalcony ?? false,
    has_parking: raw.features?.hasParking ?? false,
    parking_spaces: raw.features?.parkingSpaces,
    has_basement: raw.features?.hasBasement ?? false,
    has_terrace: raw.features?.hasTerrace ?? false,
    terrace_area: raw.features?.terraceSurface,
    has_garage: raw.features?.hasGarage ?? false,
    year_built: raw.building?.constructionYear,
    heating_type: raw.energy?.heatingType,
    energy_class: raw.energy?.epcScore,
    description: raw.description,
    images: raw.images?.map((i: any) => typeof i === 'string' ? i : i.url),
    published_date: raw.publicationDate,
    source_url: `https://www.immovlan.be/en/property/${raw.id}`,
    source_platform: 'immovlan',
    portal_id: `immovlan-${raw.id}`,
    status: 'active',
  };
}
