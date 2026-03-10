import { ApartmentPropertyTierI } from '@landomo/core';
import { OikotieCard } from '../../types/toriTypes';
import { detectTransactionType, parsePrice, parseSqm } from '../../utils/categoryDetector';

/**
 * Transform an Oikotie card with cardSubType=1 (kerrostalo/apartment) into
 * the Landomo ApartmentPropertyTierI schema.
 *
 * Oikotie does not expose per-amenity boolean fields in the search API
 * (e.g. has_elevator, has_balcony). Those details are available only on the
 * individual listing page. We detect certain features from the roomConfiguration
 * string and description as a best-effort heuristic:
 *   "parv" / "parveke" → balcony
 *   "at"               → autotalli (garage) → parking
 *   "h" count          → bedrooms ≈ rooms - 1
 *   "hissi" in desc    → elevator
 */
export function transformApartment(card: OikotieCard): ApartmentPropertyTierI {
  const transactionType = detectTransactionType(card);
  const price = parsePrice(card.data.price);
  const sqm = parseSqm(card.data.size);

  // Room count and bedrooms
  const rooms = card.data.rooms ?? 0;
  const bedrooms = rooms > 0 ? Math.max(0, rooms - 1) : 0;

  // Feature detection from roomConfiguration string
  const roomConfig = (card.data.roomConfiguration ?? '').toLowerCase();
  const description = (card.data.description ?? '').toLowerCase();

  const hasBalcony =
    roomConfig.includes('parveke') ||
    roomConfig.includes('parv') ||
    roomConfig.includes('terassi') ||
    roomConfig.includes('terr');

  const hasParking =
    roomConfig.includes('autotalli') ||
    roomConfig.includes('at') ||
    roomConfig.includes('autopaikka') ||
    description.includes('autopaikka');

  const hasElevator =
    description.includes('hissi') ||
    roomConfig.includes('hissi');

  const hasBasement =
    roomConfig.includes('varasto') ||
    roomConfig.includes('var') ||
    description.includes('varasto') ||
    description.includes('kellari');

  // Images: prefer large JPEG
  const images = (card.medias ?? [])
    .map(m => m.imageLargeJPEG)
    .filter(Boolean);

  return {
    property_category: 'apartment',
    title: buildTitle(card),
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
    bedrooms,
    sqm,
    floor: card.data.floor ?? undefined,
    total_floors: card.data.buildingFloorCount ?? undefined,
    rooms: rooms > 0 ? rooms : undefined,
    has_elevator: hasElevator,
    has_balcony: hasBalcony,
    has_parking: hasParking,
    has_basement: hasBasement,
    year_built: card.data.buildYear ?? undefined,
    condition: card.data.newDevelopment ? ('new' as any) : undefined,
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
      size_lot: card.data.sizeLot,
      price_per_sqm: card.data.pricePerSqm,
      new_development: card.data.newDevelopment,
      vendor_ad_id: card.meta.vendorAdId,
      vendor_company_id: card.meta.vendorCompanyId,
      sell_status: card.meta.sellStatus,
      listing_type: card.meta.listingType,
    },
  };
}

function buildTitle(card: OikotieCard): string {
  const sqm = parseSqm(card.data.size);
  const rooms = card.data.rooms;
  const city = card.location.city;
  const roomConfig = card.data.roomConfiguration;

  if (roomConfig) {
    return `${sqm} m², ${roomConfig}, ${city}`;
  }
  if (rooms) {
    return `${rooms}h, ${sqm} m², ${city}`;
  }
  return `Apartment ${sqm} m², ${city}`;
}
