import {
  ApartmentPropertyTierI,
  HousePropertyTierI,
  LandPropertyTierI,
  CommercialPropertyTierI,
} from '@landomo/core';
import { RawProperty, PropertyCategory } from '../scrapers/listingsScraper';

export type TierIProperty =
  | ApartmentPropertyTierI
  | HousePropertyTierI
  | LandPropertyTierI
  | CommercialPropertyTierI;

function buildTitle(raw: RawProperty): string {
  const parts: string[] = [];
  if (raw.propertyTypeRaw) parts.push(raw.propertyTypeRaw);
  if (raw.address) parts.push(raw.address);
  if (raw.city) parts.push(raw.city);
  return parts.join(' - ') || `Property ${raw.id}`;
}

function buildLocation(raw: RawProperty) {
  return {
    address: raw.address || undefined,
    city: raw.city || 'Reykjavík',
    country: 'is',
    postal_code: raw.zipCode || undefined,
    coordinates:
      raw.latitude !== null && raw.longitude !== null
        ? { lat: raw.latitude, lon: raw.longitude }
        : undefined,
  };
}

export function transformToTierI(raw: RawProperty, category: PropertyCategory): TierIProperty {
  const transactionType = raw.listingType === 'rental' ? 'rent' : 'sale';
  const title = buildTitle(raw);
  const location = buildLocation(raw);
  const price = raw.price ?? 0;

  const shared = {
    title,
    price,
    currency: 'ISK',
    transaction_type: transactionType as 'sale' | 'rent',
    location,
    year_built: raw.yearBuilt ?? undefined,
    description: raw.description ?? undefined,
    source_url: `https://fasteignir.visir.is/property/${raw.id}`,
    source_platform: 'fasteignir-is' as const,
    status: 'active' as const,
    country_specific: {
      fasteignanumer: raw.fasteignanumer,
      listing_type: raw.listingType,
      property_type_raw: raw.propertyTypeRaw,
    },
    portal_metadata: {
      portal_id: raw.id,
      scraped_at: new Date().toISOString(),
    },
  };

  if (category === 'apartment') {
    const apt: ApartmentPropertyTierI = {
      ...shared,
      property_category: 'apartment',
      sqm: raw.sqm ?? 0,
      bedrooms: raw.bedrooms ?? 0,
      rooms: raw.rooms ?? undefined,
      bathrooms: raw.bathrooms ?? undefined,
      has_elevator: raw.hasElevator,
      has_balcony: raw.hasBalcony,
      has_parking: raw.hasParking,
      has_basement: false,
    };
    return apt;
  }

  if (category === 'house') {
    const house: HousePropertyTierI = {
      ...shared,
      property_category: 'house',
      sqm_living: raw.sqm ?? 0,
      sqm_plot: raw.sqmPlot ?? 0,
      bedrooms: raw.bedrooms ?? 0,
      bathrooms: raw.bathrooms ?? undefined,
      has_garden: raw.hasGarden,
      has_garage: raw.hasGarage,
      has_parking: raw.hasParking,
      has_basement: false,
    };
    return house;
  }

  if (category === 'land') {
    const land: LandPropertyTierI = {
      ...shared,
      property_category: 'land',
      area_plot_sqm: raw.sqm ?? 0,
    };
    return land;
  }

  // commercial
  const commercial: CommercialPropertyTierI = {
    ...shared,
    property_category: 'commercial',
    sqm_total: raw.sqm ?? 0,
    has_elevator: raw.hasElevator,
    has_parking: raw.hasParking,
    has_bathrooms: (raw.bathrooms ?? 0) > 0,
  };
  return commercial;
}
