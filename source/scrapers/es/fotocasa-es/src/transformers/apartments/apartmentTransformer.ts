import { ApartmentPropertyTierI } from '@landomo/core';
import { FotocasaListing } from '../../types/fotocasaTypes';
import {
  getFeatureValue,
  hasFeature,
  extractPrice,
  extractTransactionType,
  extractCondition,
  extractCity,
  extractRegion,
  buildSourceUrl,
  extractImages,
  extractVirtualTourUrl,
  extractVideoUrl,
  estimateBedrooms,
} from '../../utils/fotocasaHelpers';
import { getApartmentSubtype } from '../../utils/categoryDetection';
import { normalizeCondition, normalizeHeatingType } from '../../../../shared/spanish-value-mappings';

export function transformApartment(listing: FotocasaListing): ApartmentPropertyTierI {
  const features = listing.features || [];
  const rooms = getFeatureValue(features, 'rooms');
  const bathrooms = getFeatureValue(features, 'bathrooms');
  const surface = getFeatureValue(features, 'surface');
  const price = extractPrice(listing);
  const condition = extractCondition(features);
  const images = extractImages(listing);
  const videoUrl = extractVideoUrl(listing);

  return {
    property_category: 'apartment' as const,
    property_subtype: getApartmentSubtype(listing.subtypeId),

    title: listing.description?.substring(0, 200) || `Piso en ${extractCity(listing)}`,
    price,
    currency: 'EUR',
    transaction_type: extractTransactionType(listing),

    location: {
      city: extractCity(listing),
      region: extractRegion(listing),
      country: 'es',
      address: listing.address?.ubication || undefined,
      postal_code: listing.address?.zipCode || undefined,
      coordinates: listing.address?.coordinates ? {
        lat: listing.address.coordinates.latitude,
        lon: listing.address.coordinates.longitude,
      } : undefined,
    },

    bedrooms: estimateBedrooms(rooms),
    bathrooms: bathrooms ?? undefined,
    sqm: surface || 0,

    has_elevator: hasFeature(features, 'elevator'),
    has_balcony: hasFeature(features, 'balcony'),
    has_parking: hasFeature(features, 'parking') || hasFeature(features, 'garage'),
    has_basement: hasFeature(features, 'storage_room'),
    has_terrace: hasFeature(features, 'terrace') || undefined,
    has_garage: hasFeature(features, 'garage') || undefined,

    condition: condition ? normalizeCondition(condition) as any : undefined,
    heating_type: hasFeature(features, 'heater') ? normalizeHeatingType('calefacción') || 'central' : undefined,
    energy_class: undefined, // Not available in search results

    published_date: listing.date || undefined,

    media: images.length > 0 ? {
      images,
      total_images: images.length,
    } : undefined,
    images: images.length > 0 ? images : undefined,
    videos: videoUrl ? [videoUrl] : undefined,

    description: listing.description || undefined,

    features: buildFeaturesList(features),

    country_specific: {
      autonomous_community: listing.address?.location?.level1 || undefined,
      province: listing.address?.location?.level2 || undefined,
      comarca: listing.address?.location?.level3 || undefined,
      condition_raw: condition || undefined,
    },

    portal_metadata: {
      fotocasa: {
        id: listing.id,
        typeId: listing.typeId,
        subtypeId: listing.subtypeId,
        realEstateAdId: listing.realEstateAdId,
        isNew: listing.isNew,
        isTop: listing.isTop,
        isVirtualTour: listing.isVirtualTour,
        promotionId: listing.promotionId || undefined,
        advertiser: listing.advertiser ? {
          clientAlias: listing.advertiser.clientAlias,
          phone: listing.advertiser.phone,
        } : undefined,
      },
    },

    source_url: buildSourceUrl(listing),
    source_platform: 'fotocasa',
    portal_id: `fotocasa-${listing.id}`,
    status: 'active',
  };
}

function buildFeaturesList(features: FotocasaListing['features']): string[] {
  const result: string[] = [];
  if (hasFeature(features, 'air_conditioner')) result.push('air_conditioning');
  if (hasFeature(features, 'heater')) result.push('heating');
  if (hasFeature(features, 'garden')) result.push('garden');
  if (hasFeature(features, 'terrace')) result.push('terrace');
  if (hasFeature(features, 'balcony')) result.push('balcony');
  if (hasFeature(features, 'swimming_pool')) result.push('pool');
  if (hasFeature(features, 'elevator')) result.push('elevator');
  if (hasFeature(features, 'parking')) result.push('parking');
  if (hasFeature(features, 'garage')) result.push('garage');
  if (hasFeature(features, 'storage_room')) result.push('storage');
  return result;
}
