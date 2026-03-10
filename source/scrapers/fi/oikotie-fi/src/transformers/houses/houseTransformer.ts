import { HousePropertyTierI, PropertyAgent } from '@landomo/core';
import { OikotieCard } from '../../types/oikotieTypes';
import { detectTransactionType, getFinnishPropertyTypeName } from '../../utils/categoryDetector';
import {
  parseOikotiePrice,
  parseOikotieSqm,
  parseRooms,
  buildLocation,
  buildMedia,
  buildPortalId,
} from '../shared';

/**
 * Transform Oikotie card (house types) to HousePropertyTierI.
 *
 * Covers cardSubType:
 *   2   = Rivitalo (row house)
 *   4   = Omakotitalo (detached house)
 *   32  = Huvila/villa (multi-floor)
 *   64  = Paritalo (semi-detached)
 *   256 = Other house type
 * Also covers cardType 104 (vacation/loma-asunto)
 *
 * Field mapping:
 *   data.rooms      → bedrooms
 *   data.size       → sqm_living ("57 m²", "100/156 m²" → take living area)
 *   data.sizeLot    → sqm_plot (lot size in m²)
 *   data.buildYear  → year_built
 *   data.maintenanceFee → hoa_fees (for row houses in housing companies)
 */
export function transformOikotieHouse(card: OikotieCard): HousePropertyTierI {
  const transaction_type = detectTransactionType(card);
  const price = parseOikotiePrice(card.data.price);
  const sqm_living = parseOikotieSqm(card.data.size);
  const bedrooms = parseRooms(card.data.rooms);
  const location = buildLocation(card.location);
  const media = buildMedia(card.medias);
  const portalId = buildPortalId(card);
  const propertyTypeName = getFinnishPropertyTypeName(card);

  // Plot size from sizeLot (m²) - often present for detached houses
  const sqm_plot = card.data.sizeLot ?? 0;

  // Derive total sqm from size string (100/156 format means living/total)
  const sqm_total = deriveTotalSqm(card.data.size);

  // HOA/maintenance fee - applicable for rivitalo (row houses) in housing companies
  const hoa_fees = card.data.maintenanceFee ?? undefined;

  // Security deposit for rentals
  const deposit = card.data.securityDeposit
    ? parseOikotiePrice(card.data.securityDeposit) || undefined
    : undefined;

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

  const features = buildHouseFeatures(card, propertyTypeName);

  return {
    property_category: 'house' as const,

    // Core
    title: buildTitle(card, propertyTypeName),
    price,
    currency: 'EUR',
    transaction_type,

    // Location
    location,

    // House details
    bedrooms,
    sqm_living,
    sqm_total,
    sqm_plot,
    rooms: card.data.rooms ?? undefined,

    // Amenities - defaults (not available in search card results)
    has_garden: sqm_plot > 0, // if lot size exists, likely has garden
    has_garage: false,
    has_parking: false,
    has_basement: false,

    // Building context
    year_built: card.data.buildYear ?? undefined,
    stories: card.data.buildingFloorCount ?? undefined,
    condition: normalizeCondition(card.data.condition),

    // Financials
    hoa_fees,
    deposit,

    // Dates
    published_date,

    // Country-specific Finnish fields (stored in JSONB)
    country_specific: {
      fi_card_type: card.cardType,
      fi_card_sub_type: card.cardSubType,
      fi_listing_type: card.meta.listingType,
      fi_contract_type: card.meta.contractType,
      fi_property_type_name: propertyTypeName,
      fi_room_configuration: card.data.roomConfiguration ?? undefined,
      fi_price_per_sqm: card.data.pricePerSqm ?? undefined,
      fi_vendor_ad_id: card.meta.vendorAdId,
      fi_vendor_company_id: card.meta.vendorCompanyId,
      fi_sell_status: card.meta.sellStatus ?? undefined,
      fi_new_development: card.data.newDevelopment,
      fi_size_min: card.data.sizeMin ?? undefined,
      fi_size_max: card.data.sizeMax ?? undefined,
      fi_lot_size: card.data.sizeLot ?? undefined,
      fi_is_vacation_property: card.cardType === 104,
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

/**
 * Parse total sqm from size string with slash format.
 * "100/156 m²" → 156 (total), "83 m²" → undefined (same as living)
 */
function deriveTotalSqm(sizeStr: string | null): number | undefined {
  if (!sizeStr) return undefined;

  const slashMatch = sizeStr.match(/^[\d,]+\/([\d,]+)/);
  if (slashMatch) {
    return parseFloat(slashMatch[1].replace(',', '.')) || undefined;
  }

  return undefined;
}

function buildTitle(card: OikotieCard, propertyTypeName: string): string {
  const parts = [
    propertyTypeName,
    card.data.roomConfiguration,
    card.data.size,
    card.location.district || card.location.city,
  ].filter(Boolean);

  return parts.join(', ') || `Oikotie listing ${card.cardId}`;
}

function normalizeCondition(
  condition: string | null
): 'new' | 'excellent' | 'good' | 'after_renovation' | 'requires_renovation' | undefined {
  if (!condition) return undefined;
  const c = condition.toLowerCase();
  if (c.includes('uusi') || c.includes('new')) return 'new';
  if (c.includes('erinomainen') || c.includes('excellent')) return 'excellent';
  if (c.includes('hyvä') || c.includes('good')) return 'good';
  if (c.includes('remontoitu') || c.includes('renovated')) return 'after_renovation';
  if (c.includes('remonttia') || c.includes('requires')) return 'requires_renovation';
  return undefined;
}

function buildHouseFeatures(card: OikotieCard, propertyTypeName: string): string[] {
  const features: string[] = [];

  if (card.data.newDevelopment) features.push('new_development');
  if (card.data.isOnlineOffer) features.push('online_offer');
  if (card.data.nextViewing) features.push('viewing_scheduled');
  if (card.data.sizeLot && card.data.sizeLot > 0) features.push('own_lot');
  if (card.cardType === 104) features.push('vacation_property');
  if (propertyTypeName) features.push(`type_${propertyTypeName.toLowerCase().replace(/\s+/g, '_')}`);

  return features;
}
