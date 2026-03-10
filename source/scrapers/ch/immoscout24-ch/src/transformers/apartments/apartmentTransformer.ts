import { ApartmentPropertyTierI } from '@landomo/core';
import { ImmoScout24ChDetailResponse } from '../../types/immoscout24ChTypes';

/**
 * Transform ImmoScout24.ch property to ApartmentPropertyTierI
 */
export function transformToStandard(property: ImmoScout24ChDetailResponse): ApartmentPropertyTierI & Record<string, any> {
  const chars = property.characteristics || {};
  const price = property.price || 0;
  const sqm = property.surfaceLiving || 0;
  const isRent = property.offerTypeId === 2;

  return {
    property_category: 'apartment',
    title: property.title || `Apartment in ${property.cityName || 'Switzerland'}`,
    price,
    currency: property.currency || 'CHF',
    property_type: 'apartment',
    transaction_type: isRent ? 'rent' : 'sale',
    source_url: `https://www.immoscout24.ch/en/d/apartment/${isRent ? 'rent' : 'buy'}/${property.id}`,
    source_platform: 'immoscout24-ch',
    status: 'active',

    // Apartment required fields
    bedrooms: property.numberOfRooms ? Math.max(1, property.numberOfRooms - 1) : undefined,
    sqm,
    has_elevator: chars.hasLift ?? property.lift ?? false,
    has_balcony: chars.hasBalcony ?? property.balcony ?? false,
    has_parking: chars.hasParking ?? property.parking ?? false,
    has_basement: chars.hasCellar ?? property.cellar ?? false,

    // Location
    location: {
      address: property.street,
      city: property.cityName || 'Unknown',
      region: undefined,
      country: 'Switzerland',
      postal_code: property.zip,
      coordinates: property.latitude && property.longitude ? {
        lat: property.latitude,
        lon: property.longitude,
      } : undefined,
    },

    // Details
    details: {
      bedrooms: property.numberOfRooms ? Math.max(1, property.numberOfRooms - 1) : undefined,
      bathrooms: property.numberOfBathrooms,
      sqm,
      floor: property.floor,
      total_floors: property.numberOfFloors,
      rooms: property.numberOfRooms,
      year_built: property.yearBuilt,
      renovation_year: property.yearRenovated,
    },

    price_per_sqm: price && sqm ? Math.round(price / sqm) : undefined,

    // Media
    media: {
      images: (property.images || []).map((img, i) => ({
        url: img.originalUrl || img.url || '',
        alt: img.description,
        order: i,
        is_main: i === 0,
      })),
      total_images: property.images?.length || 0,
    },
    images: (property.images || []).map(img => img.originalUrl || img.url || '').filter(Boolean),
    description: property.description,

    // Agent
    agent: property.contact ? {
      name: property.contact.name,
      phone: property.contact.phone,
      email: property.contact.email,
      agency: property.agency?.name || property.contact.company,
      agency_logo: property.agency?.logoUrl,
    } : undefined,

    // Amenities
    amenities: {
      has_parking: chars.hasParking ?? property.parking,
      has_garage: chars.hasGarage ?? property.garage,
      has_balcony: chars.hasBalcony ?? property.balcony,
      has_garden: chars.hasGarden ?? property.garden,
      has_basement: chars.hasCellar ?? property.cellar,
      has_elevator: chars.hasLift ?? property.lift,
      is_barrier_free: chars.isWheelchairAccessible,
      is_furnished: chars.isFurnished,
    },

    // Universal Tier 1 fields
    condition: normalizeCondition(property.condition),
    heating_type: normalizeHeatingType(property.heatingType),
    furnished: chars.isFurnished ? 'furnished' : undefined,
    available_from: property.availableFrom,
    published_date: property.createdAt,
    deposit: property.deposit,
    parking_spaces: undefined,

    // Swiss-specific country_specific
    country_specific: {
      canton_id: property.cantonId,
      minergie: property.minergie,
      energy_label: property.energyLabel,
      monthly_charges: property.monthlyCharges,
      year_built: property.yearBuilt,
      year_renovated: property.yearRenovated,
      surface_usable: property.surfaceUsable,
    },

    portal_metadata: {
      'immoscout24-ch': {
        property_id: property.id,
        account_id: property.accountId,
        property_type_id: property.propertyTypeId,
        offer_type_id: property.offerTypeId,
        is_premium: property.isPremium,
        is_featured: property.isFeatured,
        last_modified: property.lastModified,
      },
    },
  } as any;
}

function normalizeCondition(condition?: string): string | undefined {
  if (!condition) return undefined;
  const c = condition.toLowerCase();
  if (c.includes('new') || c.includes('neu')) return 'new';
  if (c.includes('renov')) return 'after_renovation';
  if (c.includes('good') || c.includes('gut')) return 'good';
  return undefined;
}

function normalizeHeatingType(heating?: string): string | undefined {
  if (!heating) return undefined;
  const h = heating.toLowerCase();
  if (h.includes('central') || h.includes('zentral')) return 'central_heating';
  if (h.includes('floor') || h.includes('fussboden')) return 'floor_heating';
  if (h.includes('gas')) return 'gas_heating';
  if (h.includes('oil') || h.includes('oel')) return 'oil_heating';
  if (h.includes('heat pump') || h.includes('waermepumpe')) return 'heat_pump';
  if (h.includes('electric') || h.includes('elektro')) return 'electric_heating';
  if (h.includes('district') || h.includes('fernwaerme')) return 'district_heating';
  return 'unknown';
}
