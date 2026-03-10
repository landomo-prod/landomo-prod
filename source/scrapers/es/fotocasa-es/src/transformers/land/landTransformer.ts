import { LandPropertyTierI } from '@landomo/core';
import { FotocasaListing } from '../../types/fotocasaTypes';
import {
  getFeatureValue,
  extractPrice,
  extractTransactionType,
  extractCity,
  extractRegion,
  buildSourceUrl,
  extractImages,
} from '../../utils/fotocasaHelpers';

export function transformLand(listing: FotocasaListing): LandPropertyTierI {
  const features = listing.features || [];
  const surface = getFeatureValue(features, 'surface');
  const price = extractPrice(listing);
  const images = extractImages(listing);

  return {
    property_category: 'land' as const,

    title: listing.description?.substring(0, 200) || `Terreno en ${extractCity(listing)}`,
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

    area_plot_sqm: surface || 0,

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
