import { CommercialPropertyTierI } from '@landomo/core';
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
} from '../../utils/fotocasaHelpers';
import { getCommercialSubtype } from '../../utils/categoryDetection';

export function transformCommercial(listing: FotocasaListing): CommercialPropertyTierI {
  const features = listing.features || [];
  const surface = getFeatureValue(features, 'surface');
  const bathrooms = getFeatureValue(features, 'bathrooms');
  const price = extractPrice(listing);
  const condition = extractCondition(features);
  const images = extractImages(listing);

  return {
    property_category: 'commercial' as const,
    property_subtype: getCommercialSubtype(listing.typeId),

    title: listing.description?.substring(0, 200) || `Local en ${extractCity(listing)}`,
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

    sqm_total: surface || 0,
    has_elevator: hasFeature(features, 'elevator'),
    has_parking: hasFeature(features, 'parking') || hasFeature(features, 'garage'),
    has_bathrooms: bathrooms !== null && bathrooms > 0,
    bathroom_count: bathrooms ?? undefined,
    has_air_conditioning: hasFeature(features, 'air_conditioner') || undefined,

    condition: condition as any || undefined,

    published_date: listing.date || undefined,

    media: images.length > 0 ? {
      images,
      total_images: images.length,
    } : undefined,
    images: images.length > 0 ? images : undefined,

    description: listing.description || undefined,

    country_specific: {
      autonomous_community: listing.address?.location?.level1 || undefined,
      province: listing.address?.location?.level2 || undefined,
    },

    portal_metadata: {
      fotocasa: {
        id: listing.id,
        typeId: listing.typeId,
        subtypeId: listing.subtypeId,
        realEstateAdId: listing.realEstateAdId,
        isNew: listing.isNew,
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
