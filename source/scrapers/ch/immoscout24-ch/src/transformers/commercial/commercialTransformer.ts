import { CommercialPropertyTierI } from '@landomo/core';
import { ImmoScout24ChDetailResponse } from '../../types/immoscout24ChTypes';

export function transformCommercialToStandard(property: ImmoScout24ChDetailResponse): CommercialPropertyTierI & Record<string, any> {
  const chars = property.characteristics || {};
  const price = property.price || 0;
  const isRent = property.offerTypeId === 2;

  return {
    property_category: 'commercial',
    title: property.title || `Commercial in ${property.cityName || 'Switzerland'}`,
    price,
    currency: property.currency || 'CHF',
    property_type: 'commercial',
    transaction_type: isRent ? 'rent' : 'sale',
    source_url: `https://www.immoscout24.ch/en/d/commercial/${isRent ? 'rent' : 'buy'}/${property.id}`,
    source_platform: 'immoscout24-ch',
    status: 'active',

    // Commercial required fields
    sqm_total: property.surfaceLiving || property.surfaceUsable || 0,
    has_elevator: chars.hasLift ?? property.lift ?? false,
    has_parking: chars.hasParking ?? property.parking ?? false,
    bathrooms: property.numberOfBathrooms,

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
      bathrooms: property.numberOfBathrooms,
      sqm: property.surfaceLiving || property.surfaceUsable,
      floor: property.floor,
      total_floors: property.numberOfFloors,
      year_built: property.yearBuilt,
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
      agency: property.agency?.name || property.contact.company,
    } : undefined,

    amenities: {
      has_parking: chars.hasParking ?? property.parking,
      has_elevator: chars.hasLift ?? property.lift,
    },

    published_date: property.createdAt,
    available_from: property.availableFrom,

    country_specific: {
      canton_id: property.cantonId,
      minergie: property.minergie,
      monthly_charges: property.monthlyCharges,
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
