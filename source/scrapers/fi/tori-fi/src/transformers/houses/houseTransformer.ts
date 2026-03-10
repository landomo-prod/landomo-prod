import { HousePropertyTierI } from '@landomo/core';
import { OikotieCard } from '../../types/toriTypes';
import { detectTransactionType, parsePrice, parseSqm } from '../../utils/categoryDetector';

/**
 * Transform Oikotie cards with cardSubType 2 (rivitalo/rowhouse),
 * 4 (omakotitalo/detached house), or 64 (paritalo/semi-detached) into
 * the Landomo HousePropertyTierI schema.
 */
export function transformHouse(card: OikotieCard): HousePropertyTierI {
  const transactionType = detectTransactionType(card);
  const price = parsePrice(card.data.price);
  const sqmLiving = parseSqm(card.data.size);

  const rooms = card.data.rooms ?? 0;
  const bedrooms = rooms > 0 ? Math.max(0, rooms - 1) : 0;

  const roomConfig = (card.data.roomConfiguration ?? '').toLowerCase();
  const description = (card.data.description ?? '').toLowerCase();

  // Feature detection from configuration string and description
  const hasGarage =
    roomConfig.includes('autotalli') ||
    roomConfig.includes('at') ||
    description.includes('autotalli');

  const hasParking =
    hasGarage ||
    roomConfig.includes('autopaikka') ||
    description.includes('autopaikka');

  const hasGarden =
    card.data.sizeLot != null && card.data.sizeLot > 0;

  const hasBasement =
    roomConfig.includes('kellari') ||
    roomConfig.includes('var') ||
    description.includes('kellari') ||
    description.includes('varasto');

  const images = (card.medias ?? [])
    .map(m => m.imageLargeJPEG)
    .filter(Boolean);

  return {
    property_category: 'house',
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
    sqm_living: sqmLiving,
    sqm_plot: card.data.sizeLot ?? 0,
    rooms: rooms > 0 ? rooms : undefined,
    has_garden: hasGarden,
    has_garage: hasGarage,
    has_parking: hasParking,
    has_basement: hasBasement,
    year_built: card.data.buildYear ?? undefined,
    stories: card.data.buildingFloorCount ?? undefined,
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
  const subtypeLabel =
    card.cardSubType === 2
      ? 'Rivitalo'
      : card.cardSubType === 64
      ? 'Paritalo'
      : 'Omakotitalo';

  if (rooms) {
    return `${sqm} m², ${rooms}h, ${subtypeLabel}, ${city}`;
  }
  return `${subtypeLabel} ${sqm} m², ${city}`;
}
