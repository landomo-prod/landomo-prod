import { LandPropertyTierI, PropertyLocation } from '@landomo/core';
import { OikotieCard } from '../../types/etuoviTypes';
import { parsePrice, parseSqm, buildImageList, mapTransactionType } from '../shared';

/**
 * Transform Oikotie land/plot card (cardType=104, myytavat-tontit)
 * to LandPropertyTierI.
 *
 * Finnish land types include:
 *   - Asuinrakennuspaikka (residential plot)
 *   - Loma-asuntopaikka (holiday plot)
 *   - Maatila (farm)
 *   - Metsätila (forest)
 *   - Muu tila (other)
 */
export function transformOikovieLand(card: OikotieCard): LandPropertyTierI {
  const { data, location, meta, medias } = card;

  const transaction_type = mapTransactionType(meta.contractType);
  const price = parsePrice(data.price);

  // For land, sizeLot is the primary area; sizeMin/sizeMax may also apply
  const area_plot_sqm = data.sizeLot || data.sizeMin || parseSqm(data.size) || 0;

  const loc: PropertyLocation = {
    address: location.address,
    city: location.city,
    region: location.district || undefined,
    country: 'Finland',
    postal_code: location.zipCode,
    coordinates: (location.latitude && location.longitude)
      ? { lat: location.latitude, lon: location.longitude }
      : undefined,
  };

  const images = buildImageList(medias);

  return {
    property_category: 'land',

    // Core
    title: data.description || `Tontti - ${location.city}`,
    price,
    currency: 'EUR',
    transaction_type,

    // Location
    location: loc,

    // Land details
    area_plot_sqm,

    // Media
    images,
    media: {
      images,
    },

    // Description
    description: data.description || undefined,

    // Tier II (Finland-specific)
    country_specific: {
      fi_new_development: data.newDevelopment,
      fi_price_per_sqm: data.pricePerSqm || undefined,
      fi_card_id: card.cardId,
      fi_vendor_id: meta.vendorAdId,
    },

    // Portal metadata
    source_url: card.url,
    source_platform: 'etuovi',
    portal_id: `etuovi-${card.cardId}`,
    published_date: meta.published,
    status: 'active',
  };
}
