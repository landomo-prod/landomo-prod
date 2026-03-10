import { CommercialPropertyTierI, PropertyLocation } from '@landomo/core';
import { OikotieCard } from '../../types/etuoviTypes';
import { parsePrice, parseSqm, buildImageList, mapTransactionType } from '../shared';

/**
 * Transform Oikotie commercial card (cardType=105, myytavat-toimitilat)
 * or rental commercial (cardType=103)
 * to CommercialPropertyTierI.
 *
 * Finnish commercial types:
 *   - Liiketila (commercial/retail space)
 *   - Toimisto (office)
 *   - Varasto (warehouse)
 *   - Tuotantotila (production space)
 *   - Hotelli (hotel)
 */
export function transformOikotieCommercial(card: OikotieCard): CommercialPropertyTierI {
  const { data, location, meta, medias } = card;

  const transaction_type = mapTransactionType(meta.contractType);
  const price = parsePrice(data.price);
  const sqm_total = data.sizeMin || parseSqm(data.size) || 0;

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

  const roomConfig = (data.roomConfiguration || '').toLowerCase();
  const has_elevator = false; // Not provided in list API
  const has_parking = roomConfig.includes('autopaikka') || roomConfig.includes('autotalli') ||
    roomConfig.includes('autokatos');
  const has_bathrooms = roomConfig.includes('wc') || roomConfig.includes('kph');

  const images = buildImageList(medias);

  return {
    property_category: 'commercial',

    // Core
    title: data.description || `Toimitila - ${location.city}`,
    price,
    currency: 'EUR',
    transaction_type,

    // Location
    location: loc,

    // Commercial details
    sqm_total,
    floor: data.floor || undefined,

    // Amenities
    has_elevator,
    has_parking,
    has_bathrooms,

    // Building context
    year_built: data.buildYear || undefined,

    // Financials
    deposit: data.securityDeposit || undefined,
    operating_costs: data.maintenanceFee || undefined,

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
