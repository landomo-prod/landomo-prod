import { LandPropertyTierI } from '@landomo/core';
import { OikotieCard } from '../../types/toriTypes';
import { detectTransactionType, parsePrice, parseSqm } from '../../utils/categoryDetector';

/**
 * Transform an Oikotie land/plot card (cardSubType=5 or heuristic) into
 * the Landomo LandPropertyTierI schema.
 */
export function transformLand(card: OikotieCard): LandPropertyTierI {
  const transactionType = detectTransactionType(card);
  const price = parsePrice(card.data.price);

  // Land area: sizeLot is the primary field; fall back to sizeMin
  const plotSqm = card.data.sizeLot ?? parseSqm(card.data.size);

  const images = (card.medias ?? [])
    .map(m => m.imageLargeJPEG)
    .filter(Boolean);

  return {
    property_category: 'land',
    title: buildTitle(card, plotSqm),
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
    area_plot_sqm: plotSqm,
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
      new_development: card.data.newDevelopment,
      vendor_ad_id: card.meta.vendorAdId,
      vendor_company_id: card.meta.vendorCompanyId,
      listing_type: card.meta.listingType,
    },
  };
}

function buildTitle(card: OikotieCard, plotSqm: number): string {
  const city = card.location.city;
  if (plotSqm > 0) {
    const plotLabel = plotSqm >= 10000
      ? `${(plotSqm / 10000).toFixed(2)} ha`
      : `${plotSqm} m²`;
    return `Tontti ${plotLabel}, ${city}`;
  }
  return `Tontti, ${city}`;
}
