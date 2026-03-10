import { HousePropertyTierI } from '@landomo/core';
import { ImmoScout24ChDetailResponse } from '../../types/immoscout24ChTypes';

export function transformHouseToStandard(property: ImmoScout24ChDetailResponse): HousePropertyTierI & Record<string, any> {
  const chars = property.characteristics || {};
  const price = property.price || 0;
  const isRent = property.offerTypeId === 2;

  return {
    property_category: 'house',
    title: property.title || `House in ${property.cityName || 'Switzerland'}`,
    price,
    currency: property.currency || 'CHF',
    property_type: 'house',
    transaction_type: isRent ? 'rent' : 'sale',
    source_url: `https://www.immoscout24.ch/en/d/house/${isRent ? 'rent' : 'buy'}/${property.id}`,
    source_platform: 'immoscout24-ch',
    status: 'active',

    // House required fields
    bedrooms: property.numberOfRooms ? Math.max(1, property.numberOfRooms - 1) : undefined,
    sqm_living: property.surfaceLiving || 0,
    sqm_plot: property.surfaceProperty || 0,
    has_garden: chars.hasGarden ?? property.garden ?? false,
    has_garage: chars.hasGarage ?? property.garage ?? false,
    has_parking: chars.hasParking ?? property.parking ?? false,
    has_basement: chars.hasCellar ?? property.cellar ?? false,

    location: {
      address: property.street,
      city: property.cityName || 'Unknown',
      country: 'Switzerland',
      postal_code: property.zip,
      coordinates: property.latitude && property.longitude ? {
        lat: property.latitude,
        lon: property.longitude,
      } : undefined,
    },

    details: {
      bedrooms: property.numberOfRooms ? Math.max(1, property.numberOfRooms - 1) : undefined,
      bathrooms: property.numberOfBathrooms,
      sqm: property.surfaceLiving,
      rooms: property.numberOfRooms,
      year_built: property.yearBuilt,
      renovation_year: property.yearRenovated,
    },

    price_per_sqm: price && property.surfaceLiving ? Math.round(price / property.surfaceLiving) : undefined,

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

    agent: property.contact ? {
      name: property.contact.name,
      phone: property.contact.phone,
      email: property.contact.email,
      agency: property.agency?.name || property.contact.company,
    } : undefined,

    amenities: {
      has_parking: chars.hasParking ?? property.parking,
      has_garage: chars.hasGarage ?? property.garage,
      has_garden: chars.hasGarden ?? property.garden,
      has_basement: chars.hasCellar ?? property.cellar,
      has_elevator: chars.hasLift ?? property.lift,
      is_furnished: chars.isFurnished,
    },

    condition: undefined,
    heating_type: undefined,
    furnished: chars.isFurnished ? 'furnished' : undefined,
    available_from: property.availableFrom,
    published_date: property.createdAt,
    deposit: property.deposit,

    country_specific: {
      canton_id: property.cantonId,
      minergie: property.minergie,
      energy_label: property.energyLabel,
      monthly_charges: property.monthlyCharges,
      surface_property: property.surfaceProperty,
    },

    portal_metadata: {
      'immoscout24-ch': {
        property_id: property.id,
        property_type_id: property.propertyTypeId,
        offer_type_id: property.offerTypeId,
        last_modified: property.lastModified,
      },
    },
  } as any;
}
