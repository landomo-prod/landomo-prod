import { LandPropertyTierI, PropertyAgent } from '@landomo/core';
import { OikotieCard } from '../../types/oikotieTypes';
import { detectTransactionType } from '../../utils/categoryDetector';
import {
  parseOikotiePrice,
  parseOikotieSqm,
  buildLocation,
  buildMedia,
  buildPortalId,
} from '../shared';

/**
 * Transform Oikotie card (land/tontti) to LandPropertyTierI.
 *
 * Covers cardType 102 (tontit = land plots).
 *
 * Field mapping:
 *   data.size     → area_plot_sqm (land area in m²)
 *   data.sizeLot  → area_plot_sqm (alternative - sometimes more accurate)
 *
 * Finnish land plot types:
 * - Asuintontti (residential plot) - most common
 * - Kesämökkitontti (summer cabin plot)
 * - Maatila (farm land)
 * - Metsätila (forest)
 */
export function transformOikiotieLand(card: OikotieCard): LandPropertyTierI {
  const transaction_type = detectTransactionType(card);
  const price = parseOikotiePrice(card.data.price);
  const location = buildLocation(card.location);
  const media = buildMedia(card.medias);
  const portalId = buildPortalId(card);

  // Land area - prefer sizeLot (explicit lot field), fallback to size string
  const area_from_size = parseOikotieSqm(card.data.size);
  const area_plot_sqm = card.data.sizeLot ?? area_from_size ?? 0;

  const published_date = card.meta.published
    ? new Date(card.meta.published).toISOString()
    : undefined;

  // Build agent object (using PropertyAgent interface)
  const agent: PropertyAgent | undefined = card.company?.realtorName
    ? {
        name: card.company.realtorName,
        agency: card.company.companyName ?? undefined,
        agency_logo: card.company.logo ?? undefined,
      }
    : card.company?.companyName
    ? { name: card.company.companyName, agency_logo: card.company.logo ?? undefined }
    : undefined;

  const features = buildLandFeatures(card);

  return {
    property_category: 'land' as const,

    // Core
    title: buildTitle(card),
    price,
    currency: 'EUR',
    transaction_type,

    // Location
    location,

    // Land details
    area_plot_sqm,

    // Dates
    published_date,

    // Country-specific Finnish fields (stored in JSONB)
    country_specific: {
      fi_card_type: card.cardType,
      fi_card_sub_type: card.cardSubType,
      fi_listing_type: card.meta.listingType,
      fi_contract_type: card.meta.contractType,
      fi_vendor_ad_id: card.meta.vendorAdId,
      fi_vendor_company_id: card.meta.vendorCompanyId,
      fi_sell_status: card.meta.sellStatus ?? undefined,
      fi_price_per_sqm: card.data.pricePerSqm ?? undefined,
      fi_size_string: card.data.size ?? undefined,
      fi_size_lot: card.data.sizeLot ?? undefined,
    },

    // Media
    media,
    images: media.images,

    // Agent
    agent,

    // Features
    features,
    description: card.data.description ?? undefined,

    // Portal
    source_url: card.url,
    source_platform: 'oikotie',
    portal_id: portalId,
    status: 'active' as const,
  };
}

function buildTitle(card: OikotieCard): string {
  const parts = [
    'Tontti',
    card.data.size,
    card.location.district || card.location.city,
  ].filter(Boolean);

  return parts.join(', ') || `Oikotie tontti ${card.cardId}`;
}

function buildLandFeatures(card: OikotieCard): string[] {
  const features: string[] = ['land'];

  if (card.data.sizeLot && card.data.sizeLot > 0) features.push('plot_size_known');
  if (card.data.newDevelopment) features.push('new_development');
  if (card.data.nextViewing) features.push('viewing_scheduled');

  return features;
}
