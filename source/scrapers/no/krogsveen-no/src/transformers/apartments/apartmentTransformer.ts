import { ApartmentPropertyTierI, PropertyLocation } from '@landomo/core';
import { KrogsveenEstate } from '../../types/krogsveenTypes';
import { buildSourceUrl, extractSqm, buildLocation } from '../shared';

/**
 * Transform a Krogsveen estate to ApartmentPropertyTierI.
 *
 * Krogsveen apartment types: leilighet (and sometimes annet)
 *
 * Area priority (Norwegian BRA standard):
 *   braI (BRA-i indoor) → bra (total BRA) → boa → brua → areaSize
 */
export function transformKrogsveenApartment(estate: KrogsveenEstate): ApartmentPropertyTierI {
  const title = estate.head || `${estate.typeName || 'Leilighet'} – ${estate.vadr || ''}`.trim();
  const location = buildLocation(estate);
  const sqm = extractSqm(estate);

  const bedrooms: number = estate.bedrooms ?? 0;

  // Krogsveen provides explicit boolean flags for these amenities
  const has_elevator = estate.lift ?? false;
  const has_balcony = estate.veranda ?? false;
  const has_parking = estate.garage ?? false;
  // Basement: not a direct field — infer from braB (below-grade usable area) or heading
  const has_basement = (estate.braB != null && estate.braB > 0) ||
    (estate.head || '').toLowerCase().includes('kjeller');

  const source_url = buildSourceUrl(estate);
  const portal_id = `krogsveen-no-${estate.id}`;

  const published_date = estate.publishedAt
    ? new Date(estate.publishedAt).toISOString()
    : undefined;

  // Ownership type: Selveiet / Andel / Aksje
  const ownershipType = estate.ownershipType || estate.ownershipName || undefined;

  return {
    property_category: 'apartment' as const,

    title,
    price: estate.price ?? 0,
    currency: 'NOK',
    transaction_type: 'sale',

    location,

    property_subtype: detectApartmentSubtype(estate),

    country_specific: {
      no_ownership_type: ownershipType,
      no_total_price: estate.totalPrice ?? undefined,
      no_commission_type: estate.commissionType ?? undefined,
      no_property_type_name: estate.typeName ?? undefined,
      no_rooms: estate.rooms ?? undefined,
      no_built_year: estate.built ?? undefined,
      no_floors: estate.floors ?? undefined,
      no_bra_total: estate.bra ?? undefined,
      no_bra_i: estate.braI ?? undefined,
    },

    // Apartment-specific required fields
    bedrooms,
    sqm,
    has_elevator,
    has_balcony,
    has_parking,
    has_basement,

    published_date,
    renovation_year: undefined,

    source_url,
    source_platform: 'krogsveen-no',
    portal_id,
    status: 'active' as const,
  };
}

function detectApartmentSubtype(
  estate: KrogsveenEstate
): 'standard' | 'studio' | 'penthouse' | 'loft' | undefined {
  const heading = (estate.head || '').toLowerCase();
  const typeLower = (estate.typeName || '').toLowerCase();

  if (estate.bedrooms === 0 || typeLower.includes('hybel') || typeLower.includes('studio')) {
    return 'studio';
  }
  if (heading.includes('penthouse')) return 'penthouse';
  if (heading.includes('loft') || typeLower.includes('loft')) return 'loft';

  return 'standard';
}
