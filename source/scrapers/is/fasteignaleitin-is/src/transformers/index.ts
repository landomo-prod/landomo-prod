import {
  ApartmentPropertyTierI,
  HousePropertyTierI,
  LandPropertyTierI,
  CommercialPropertyTierI,
} from '@landomo/core';
import { RawListing } from '../scrapers/listingsScraper';

export type TransformedProperty =
  | ApartmentPropertyTierI
  | HousePropertyTierI
  | LandPropertyTierI
  | CommercialPropertyTierI;

/**
 * Determine property category from Icelandic type string.
 */
function mapCategory(typeRaw?: string): 'apartment' | 'house' | 'land' | 'commercial' {
  if (!typeRaw) return 'apartment';

  const t = typeRaw.toLowerCase();

  if (/fj[oö]lb[yý]lish[uú]s|fj[oö]lb[yý]li|[ií]b[uú][ðd]|ibud/.test(t)) {
    return 'apartment';
  }
  if (/einb[yý]lish[uú]s|einb[yý]li|ra[ðd]h[uú]s|parh[uú]s|sumarb[uú]sta[ðd]ur/.test(t)) {
    return 'house';
  }
  if (/l[oó][ðd](?!arflatarm)|l[oó][ðd]arland|jar[ðd]ir/.test(t)) {
    return 'land';
  }
  if (/atvinnuh[uú]sn[æa][ðd]i|verslun|skrifstofur/.test(t)) {
    return 'commercial';
  }

  return 'apartment';
}

export function transformListing(raw: RawListing): TransformedProperty {
  const category = mapCategory(raw.propertyTypeRaw);

  // Build location object
  const location = {
    address: raw.address || '',
    city: raw.city || '',
    country: 'IS',
    postal_code: raw.zipCode,
    ...(raw.latitude != null && raw.longitude != null
      ? { coordinates: { lat: raw.latitude, lon: raw.longitude } }
      : {}),
  };

  // Generate a title from address and type
  const title = raw.address
    ? `${raw.propertyTypeRaw || 'Fasteign'} - ${raw.address}`
    : `${raw.propertyTypeRaw || 'Fasteign'} - ${raw.slug}`;

  const derivedBedrooms = raw.bedrooms ?? (raw.rooms != null ? Math.max(0, raw.rooms - 1) : 0);

  const COMMON = {
    title,
    price: raw.price ?? 0,
    currency: 'ISK',
    transaction_type: 'sale' as const,
    location,
    source_url: raw.sourceUrl,
    source_platform: 'fasteignaleitin-is',
    status: 'active' as const,
    description: raw.description,
    year_built: raw.yearBuilt,
  };

  switch (category) {
    case 'apartment': {
      const apt: ApartmentPropertyTierI = {
        ...COMMON,
        property_category: 'apartment',
        bedrooms: derivedBedrooms,
        bathrooms: raw.bathrooms,
        sqm: raw.sqm ?? 0,
        rooms: raw.rooms,
        has_elevator: raw.hasElevator ?? false,
        has_balcony: raw.hasBalcony ?? false,
        has_parking: raw.hasParking ?? false,
        has_basement: raw.hasBasement ?? false,
        has_garage: raw.hasGarage,
        country_specific: {
          property_type_raw: raw.propertyTypeRaw,
          has_garden: raw.hasGarden,
        },
      };
      return apt;
    }

    case 'house': {
      const house: HousePropertyTierI = {
        ...COMMON,
        property_category: 'house',
        bedrooms: derivedBedrooms,
        bathrooms: raw.bathrooms,
        sqm_living: raw.sqm ?? 0,
        sqm_plot: raw.sqmPlot ?? 0,
        rooms: raw.rooms,
        has_garden: raw.hasGarden ?? false,
        has_garage: raw.hasGarage ?? false,
        has_parking: raw.hasParking ?? false,
        has_basement: raw.hasBasement ?? false,
        has_balcony: raw.hasBalcony,
        country_specific: {
          property_type_raw: raw.propertyTypeRaw,
          has_elevator: raw.hasElevator,
        },
      };
      return house;
    }

    case 'land': {
      const land: LandPropertyTierI = {
        ...COMMON,
        property_category: 'land',
        area_plot_sqm: raw.sqm ?? raw.sqmPlot ?? 0,
        country_specific: {
          property_type_raw: raw.propertyTypeRaw,
        },
      };
      return land;
    }

    case 'commercial': {
      const comm: CommercialPropertyTierI = {
        ...COMMON,
        property_category: 'commercial',
        sqm_total: raw.sqm ?? 0,
        has_elevator: raw.hasElevator ?? false,
        has_parking: raw.hasParking ?? false,
        has_bathrooms: (raw.bathrooms ?? 0) > 0,
        country_specific: {
          property_type_raw: raw.propertyTypeRaw,
          bathrooms: raw.bathrooms,
        },
      };
      return comm;
    }
  }
}
