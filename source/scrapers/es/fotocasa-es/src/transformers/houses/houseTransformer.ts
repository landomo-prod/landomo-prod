import { HousePropertyTierI } from '@landomo/core';
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
  extractVideoUrl,
  estimateBedrooms,
} from '../../utils/fotocasaHelpers';
import { getHouseSubtype } from '../../utils/categoryDetection';
import { normalizeCondition } from '../../../../shared/spanish-value-mappings';

export function transformHouse(listing: FotocasaListing): HousePropertyTierI {
  const features = listing.features || [];
  const rooms = getFeatureValue(features, 'rooms');
  const bathrooms = getFeatureValue(features, 'bathrooms');
  const surface = getFeatureValue(features, 'surface');
  const price = extractPrice(listing);
  const condition = extractCondition(features);
  const images = extractImages(listing);
  const videoUrl = extractVideoUrl(listing);

  return {
    property_category: 'house' as const,
    property_subtype: getHouseSubtype(listing.subtypeId),

    title: listing.description?.substring(0, 200) || `Chalet en ${extractCity(listing)}`,
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
    sqm_living: surface || 0,
    sqm_plot: 0, // Not available in search API; detail page may have it

    has_garden: hasFeature(features, 'garden'),
    has_garage: hasFeature(features, 'garage'),
    has_parking: hasFeature(features, 'parking') || hasFeature(features, 'garage'),
    has_basement: hasFeature(features, 'storage_room'),
    has_pool: hasFeature(features, 'swimming_pool') || undefined,
    has_terrace: hasFeature(features, 'terrace') || undefined,
    has_balcony: hasFeature(features, 'balcony') || undefined,

    condition: condition ? normalizeCondition(condition) as any : undefined,
    heating_type: hasFeature(features, 'heater') ? 'central' : undefined,

    published_date: listing.date || undefined,

    media: images.length > 0 ? {
      images,
      total_images: images.length,
    } : undefined,
    images: images.length > 0 ? images : undefined,
    videos: videoUrl ? [videoUrl] : undefined,

    description: listing.description || undefined,

    features: buildHouseFeaturesList(features),

    country_specific: {
      autonomous_community: listing.address?.location?.level1 || undefined,
      province: listing.address?.location?.level2 || undefined,
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

function buildHouseFeaturesList(features: FotocasaListing['features']): string[] {
  const result: string[] = [];
  if (hasFeature(features, 'air_conditioner')) result.push('air_conditioning');
  if (hasFeature(features, 'heater')) result.push('heating');
  if (hasFeature(features, 'garden')) result.push('garden');
  if (hasFeature(features, 'terrace')) result.push('terrace');
  if (hasFeature(features, 'swimming_pool')) result.push('pool');
  if (hasFeature(features, 'parking')) result.push('parking');
  if (hasFeature(features, 'garage')) result.push('garage');
  if (hasFeature(features, 'storage_room')) result.push('storage');
  return result;
}
