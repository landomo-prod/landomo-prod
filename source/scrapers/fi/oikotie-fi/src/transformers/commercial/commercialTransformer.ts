import { CommercialPropertyTierI, PropertyAgent } from '@landomo/core';
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
 * Transform Oikotie card (commercial/liiketila) to CommercialPropertyTierI.
 *
 * Covers cardType 103 (liiketilat = commercial spaces).
 *
 * Finnish commercial space types:
 * - Liiketila (retail/commercial space)
 * - Toimisto (office)
 * - Varasto (warehouse/storage)
 * - Teollisuustila (industrial space)
 *
 * Field mapping:
 *   data.size          → sqm_total
 *   data.price         → price (sale price or monthly rent)
 *   data.maintenanceFee → hoa_fees
 */
export function transformOikotieCommercial(card: OikotieCard): CommercialPropertyTierI {
  const transaction_type = detectTransactionType(card);
  const price = parseOikotiePrice(card.data.price);
  const sqm_total = parseOikotieSqm(card.data.size);
  const location = buildLocation(card.location);
  const media = buildMedia(card.medias);
  const portalId = buildPortalId(card);

  // Monthly rent for rental commercial spaces (CommercialPropertyTierI has monthly_rent)
  const monthly_rent = transaction_type === 'rent' ? price : undefined;

  // HOA/maintenance fee
  const hoa_fees = card.data.maintenanceFee ?? undefined;

  // Security deposit
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

  const features = buildCommercialFeatures(card);

  return {
    property_category: 'commercial' as const,

    // Core
    title: buildTitle(card),
    price,
    currency: 'EUR',
    transaction_type,
    monthly_rent,

    // Location
    location,

    // Commercial details
    sqm_total,

    // Amenities - Oikotie commercial search results don't expose these in listing cards
    has_elevator: false,
    has_parking: false,
    has_bathrooms: false,

    // Building context
    year_built: card.data.buildYear ?? undefined,
    condition: normalizeCondition(card.data.condition),

    // Financials
    deposit,

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
      fi_room_configuration: card.data.roomConfiguration ?? undefined,
      fi_size_min: card.data.sizeMin ?? undefined,
      fi_size_max: card.data.sizeMax ?? undefined,
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
    'Liiketila',
    card.data.size,
    card.location.district || card.location.city,
  ].filter(Boolean);

  return parts.join(', ') || `Oikotie liiketila ${card.cardId}`;
}

/**
 * CommercialPropertyTierI condition uses 'fair' instead of 'after_renovation'
 */
function normalizeCondition(
  condition: string | null
): 'new' | 'excellent' | 'good' | 'fair' | 'requires_renovation' | undefined {
  if (!condition) return undefined;
  const c = condition.toLowerCase();
  if (c.includes('uusi') || c.includes('new')) return 'new';
  if (c.includes('erinomainen') || c.includes('excellent')) return 'excellent';
  if (c.includes('hyvä') || c.includes('good')) return 'good';
  if (c.includes('remontoitu') || c.includes('renovated') || c.includes('tyydyttävä')) return 'fair';
  if (c.includes('remonttia') || c.includes('requires')) return 'requires_renovation';
  return undefined;
}

function buildCommercialFeatures(card: OikotieCard): string[] {
  const features: string[] = ['commercial'];

  if (card.data.newDevelopment) features.push('new_development');
  if (card.data.isOnlineOffer) features.push('online_offer');
  if (card.data.nextViewing) features.push('viewing_scheduled');

  return features;
}
