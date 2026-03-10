import { ApartmentPropertyTierI, PropertyAgent } from '@landomo/core';
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
 * Transform Oikotie card (kerrostalo/apartment) to ApartmentPropertyTierI.
 *
 * Covers:
 * - cardType 100, cardSubType 1 (kerrostalo, for sale)
 * - cardType 101, cardSubType 1 (kerrostalo, rental)
 *
 * Field mapping:
 *   data.rooms         → bedrooms (Finnish rooms = bedrooms in kerrostalo context)
 *   data.size          → sqm ("57 m²")
 *   data.floor         → floor
 *   data.buildYear     → year_built
 *   data.maintenanceFee → hoa_fees (vastike, monthly maintenance fee)
 *   meta.listingType   → fi_listing_type (1=freehold, 3=housing company share)
 */
export function transformOikotieApartment(card: OikotieCard): ApartmentPropertyTierI {
  const transaction_type = detectTransactionType(card);
  const price = parseOikotiePrice(card.data.price);
  const sqm = parseOikotieSqm(card.data.size);
  const bedrooms = parseRooms(card.data.rooms);
  const location = buildLocation(card.location);
  const media = buildMedia(card.medias);
  const portalId = buildPortalId(card);
  const propertyTypeName = getFinnishPropertyTypeName(card);

  const floor = card.data.floor ?? undefined;
  const total_floors = card.data.buildingFloorCount ?? undefined;
  const floor_location = deriveFloorLocation(floor, total_floors);

  // HOA/maintenance fee (vastike) - monthly in euros
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

  const features = buildApartmentFeatures(card, propertyTypeName);

  return {
    property_category: 'apartment' as const,

    // Core
    title: buildTitle(card),
    price,
    currency: 'EUR',
    transaction_type,

    // Location
    location,

    // Apartment details
    bedrooms,
    sqm,
    floor,
    total_floors,
    floor_location,
    rooms: card.data.rooms ?? undefined,

    // Amenities - Oikotie search results don't expose these in listing cards
    has_elevator: false,
    has_balcony: false,
    has_parking: false,
    has_basement: false,

    // Building context
    year_built: card.data.buildYear ?? undefined,
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
  const propertyTypeName = getFinnishPropertyTypeName(card);
  const parts = [
    propertyTypeName,
    card.data.roomConfiguration,
    card.data.size ? `${card.data.size}` : null,
    card.location.district || card.location.city,
  ].filter(Boolean);

  return parts.join(', ') || `Oikotie listing ${card.cardId}`;
}

function deriveFloorLocation(
  floor: number | undefined,
  totalFloors: number | undefined
): 'ground_floor' | 'middle_floor' | 'top_floor' | undefined {
  if (floor === undefined || totalFloors === undefined || totalFloors === 0) return undefined;
  if (floor <= 1) return 'ground_floor';
  if (floor >= totalFloors) return 'top_floor';
  return 'middle_floor';
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

function buildApartmentFeatures(card: OikotieCard, propertyTypeName: string): string[] {
  const features: string[] = [];

  if (card.data.newDevelopment) features.push('new_development');
  if (card.data.isOnlineOffer) features.push('online_offer');
  if (card.data.nextViewing) features.push('viewing_scheduled');
  if (propertyTypeName) features.push(`type_${propertyTypeName.toLowerCase().replace(/\s+/g, '_')}`);

  return features;
}
