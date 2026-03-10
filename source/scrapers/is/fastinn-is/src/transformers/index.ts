import {
  ApartmentPropertyTierI,
  HousePropertyTierI,
  LandPropertyTierI,
  CommercialPropertyTierI,
} from '@landomo/core';
import { FastinnRawListing } from '../scrapers/listingsScraper';

export type PropertyCategory = 'apartment' | 'house' | 'land' | 'commercial';

export type TransformedProperty =
  | ApartmentPropertyTierI
  | HousePropertyTierI
  | LandPropertyTierI
  | CommercialPropertyTierI;

/**
 * Detect property category from Icelandic type keywords
 *
 * Apartment: Fjölbýlishús, Fjölbýli, Íbúð
 * House:     Einbýlishús, Einbýli, Raðhús, Parhús, Sumarbústaður
 * Land:      Lóð, Lóðarland, Jarðir, Jörð
 * Commercial: Atvinnuhúsnæði, Verslun, Skrifstofurými
 */
export function detectCategory(listing: FastinnRawListing): PropertyCategory {
  const type = (listing.propertyType || '').toLowerCase();

  if (
    type.includes('íbúð') ||
    type.includes('fjölbýlishús') ||
    type.includes('fjölbýli')
  ) {
    return 'apartment';
  }

  if (
    type.includes('einbýlishús') ||
    type.includes('einbýli') ||
    type.includes('raðhús') ||
    type.includes('parhús') ||
    type.includes('sumarbústaður')
  ) {
    return 'house';
  }

  if (
    type.includes('lóð') ||
    type.includes('lóðarland') ||
    type.includes('jarðir') ||
    type.includes('jörð')
  ) {
    return 'land';
  }

  if (
    type.includes('atvinnuhúsnæði') ||
    type.includes('verslun') ||
    type.includes('skrifstofu')
  ) {
    return 'commercial';
  }

  // Default: if rooms/bedrooms present, lean apartment; otherwise house
  if (listing.bedrooms !== undefined || listing.rooms !== undefined) {
    return 'apartment';
  }

  return 'house';
}

function buildBaseFields(listing: FastinnRawListing) {
  return {
    source_url: listing.url,
    source_platform: 'fastinn-is' as const,
    country: 'IS' as const,
    city: listing.city,
    zip_code: listing.zip,
    address: listing.address,
    price: listing.price,
    currency: 'ISK' as const,
    status: 'active' as const,
    transaction_type: listing.listingType === 'rent' ? 'rent' : 'sale',
    lat: listing.lat,
    lon: listing.lon,
    renovation_year: undefined,
    published_date: undefined,
  };
}

function transformApartment(listing: FastinnRawListing): ApartmentPropertyTierI {
  const base = buildBaseFields(listing);
  return {
    ...base,
    property_category: 'apartment',
    sqm: listing.sqm,
    bedrooms: listing.bedrooms ?? (listing.rooms !== undefined ? Math.max(0, listing.rooms - 1) : undefined),
    has_elevator: listing.hasElevator ?? false,
    has_balcony: listing.hasBalcony ?? false,
    has_parking: listing.hasParking ?? false,
    has_basement: false,
    construction_year: listing.yearBuilt,
    country_specific: {
      rooms_total: listing.rooms,
      bathrooms: listing.bathrooms,
      property_type_icelandic: listing.propertyType,
      has_garage: listing.hasGarage,
      has_garden: listing.hasGarden,
    },
    portal_metadata: {
      portal_id: listing.id,
      scraped_at: new Date().toISOString(),
    },
  } as unknown as ApartmentPropertyTierI;
}

function transformHouse(listing: FastinnRawListing): HousePropertyTierI {
  const base = buildBaseFields(listing);
  return {
    ...base,
    property_category: 'house',
    sqm_living: listing.sqm,
    sqm_plot: undefined,
    bedrooms: listing.bedrooms ?? (listing.rooms !== undefined ? Math.max(0, listing.rooms - 1) : undefined),
    has_garden: listing.hasGarden ?? false,
    has_garage: listing.hasGarage ?? false,
    has_parking: listing.hasParking ?? false,
    has_basement: false,
    construction_year: listing.yearBuilt,
    country_specific: {
      rooms_total: listing.rooms,
      bathrooms: listing.bathrooms,
      property_type_icelandic: listing.propertyType,
      has_balcony: listing.hasBalcony,
    },
    portal_metadata: {
      portal_id: listing.id,
      scraped_at: new Date().toISOString(),
    },
  } as unknown as HousePropertyTierI;
}

function transformLand(listing: FastinnRawListing): LandPropertyTierI {
  const base = buildBaseFields(listing);
  return {
    ...base,
    property_category: 'land',
    area_plot_sqm: listing.sqm,
    country_specific: {
      property_type_icelandic: listing.propertyType,
    },
    portal_metadata: {
      portal_id: listing.id,
      scraped_at: new Date().toISOString(),
    },
  } as unknown as LandPropertyTierI;
}

function transformCommercial(listing: FastinnRawListing): CommercialPropertyTierI {
  const base = buildBaseFields(listing);
  return {
    ...base,
    property_category: 'commercial',
    sqm_total: listing.sqm,
    has_elevator: listing.hasElevator ?? false,
    has_parking: listing.hasParking ?? false,
    has_bathrooms: (listing.bathrooms ?? 0) > 0,
    country_specific: {
      bathrooms: listing.bathrooms,
      property_type_icelandic: listing.propertyType,
      has_garage: listing.hasGarage,
    },
    portal_metadata: {
      portal_id: listing.id,
      scraped_at: new Date().toISOString(),
    },
  } as unknown as CommercialPropertyTierI;
}

/**
 * Main transformer entry point.
 * Detects category and routes to the appropriate category transformer.
 */
export function transformFastinnToStandard(listing: FastinnRawListing): TransformedProperty {
  const category = detectCategory(listing);

  switch (category) {
    case 'apartment':
      return transformApartment(listing);
    case 'house':
      return transformHouse(listing);
    case 'land':
      return transformLand(listing);
    case 'commercial':
      return transformCommercial(listing);
    default: {
      const _exhaustive: never = category;
      throw new Error(`Unknown category: ${_exhaustive}`);
    }
  }
}
