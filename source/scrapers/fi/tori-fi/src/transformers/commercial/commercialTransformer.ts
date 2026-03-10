import { CommercialPropertyTierI } from '@landomo/core';
import { OikotieCard } from '../../types/toriTypes';
import { detectTransactionType, parsePrice, parseSqm } from '../../utils/categoryDetector';

/**
 * Transform an Oikotie commercial card (cardType 105/106) into the
 * Landomo CommercialPropertyTierI schema.
 */
export function transformCommercial(card: OikotieCard): CommercialPropertyTierI {
  const transactionType = detectTransactionType(card);
  const price = parsePrice(card.data.price);
  const sqmTotal = parseSqm(card.data.size);

  const roomConfig = (card.data.roomConfiguration ?? '').toLowerCase();
  const description = (card.data.description ?? '').toLowerCase();

  const hasParking =
    roomConfig.includes('autopaikka') ||
    description.includes('autopaikka') ||
    description.includes('autotalli');

  const hasElevator =
    description.includes('hissi') || roomConfig.includes('hissi');

  const hasBathrooms =
    roomConfig.includes('wc') ||
    roomConfig.includes('ph') ||
    description.includes('wc') ||
    description.includes('wc-tilat');

  const images = (card.medias ?? [])
    .map(m => m.imageLargeJPEG)
    .filter(Boolean);

  return {
    property_category: 'commercial',
    title: buildTitle(card, sqmTotal),
    price,
    currency: 'EUR',
    transaction_type: transactionType,
    location: {
      country: 'Finland',
      city: card.location.city,
      region: card.location.district || undefined,
      address: card.location.address || undefined,
      postal_code: card.location.zipCode || undefined,
      ...(card.location.latitude && card.location.longitude
        ? { coordinates: { lat: card.location.latitude, lon: card.location.longitude } }
        : {}),
    },
    sqm_total: sqmTotal,
    floor: card.data.floor ?? undefined,
    total_floors: card.data.buildingFloorCount ?? undefined,
    has_elevator: hasElevator,
    has_parking: hasParking,
    has_bathrooms: hasBathrooms,
    year_built: card.data.buildYear ?? undefined,
    published_date: card.meta.published || undefined,
    description: card.data.description ?? undefined,
    images: images.length > 0 ? images : undefined,
    media:
      images.length > 0
        ? { images: images.map((url, i) => ({ url, order: i })) }
        : undefined,
    source_url: card.url,
    source_platform: 'oikotie',
    portal_id: String(card.cardId),
    status: 'active',
    country_specific: {
      card_id: card.cardId,
      card_type: card.cardType,
      card_sub_type: card.cardSubType,
      room_configuration: card.data.roomConfiguration,
      maintenance_fee: card.data.maintenanceFee,
      price_per_sqm: card.data.pricePerSqm,
      new_development: card.data.newDevelopment,
      vendor_ad_id: card.meta.vendorAdId,
      vendor_company_id: card.meta.vendorCompanyId,
      listing_type: card.meta.listingType,
    },
  };
}

function buildTitle(card: OikotieCard, sqmTotal: number): string {
  const city = card.location.city;
  const district = card.location.district;
  const location = district ? `${district}, ${city}` : city;

  if (sqmTotal > 0) {
    return `Toimitila ${sqmTotal} m², ${location}`;
  }
  return `Toimitila, ${location}`;
}
