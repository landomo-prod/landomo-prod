import { HousePropertyTierI } from '@landomo/core';

export function transformHouse(raw: any, transactionType: string): HousePropertyTierI {
  const addr = raw.address || {};

  return {
    property_category: 'house',
    title: raw.title || `House in ${addr.city || 'Belgium'}`,
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
    sqm_living: raw.surface ?? 0,
    sqm_plot: raw.landSurface ?? 0,
    stories: raw.building?.floors,
    has_garden: raw.features?.hasGarden ?? false,
    garden_area: raw.features?.gardenSurface,
    has_garage: raw.features?.hasGarage ?? false,
    has_parking: raw.features?.hasParking ?? false,
    has_basement: raw.features?.hasBasement ?? false,
    has_pool: raw.features?.hasPool,
    has_terrace: raw.features?.hasTerrace,
    terrace_area: raw.features?.terraceSurface,
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
