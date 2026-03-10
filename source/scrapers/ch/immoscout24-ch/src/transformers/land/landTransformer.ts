import { LandPropertyTierI } from '@landomo/core';
import { ImmoScout24ChDetailResponse } from '../../types/immoscout24ChTypes';

export function transformLandToStandard(property: ImmoScout24ChDetailResponse): LandPropertyTierI & Record<string, any> {
  const price = property.price || 0;

  return {
    property_category: 'land',
    title: property.title || `Land in ${property.cityName || 'Switzerland'}`,
    price,
    currency: property.currency || 'CHF',
    property_type: 'land',
    transaction_type: 'sale',
    source_url: `https://www.immoscout24.ch/en/d/land/buy/${property.id}`,
    source_platform: 'immoscout24-ch',
    status: 'active',

    // Land required field
    area_plot_sqm: property.surfaceProperty || property.surfaceUsable || 0,

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
      sqm: property.surfaceProperty || property.surfaceUsable,
    },

    price_per_sqm: price && property.surfaceProperty ? Math.round(price / property.surfaceProperty) : undefined,

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

    published_date: property.createdAt,

    country_specific: {
      canton_id: property.cantonId,
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
