import { CommercialPropertyTierI } from '@landomo/core';
import { KrogsveenEstate } from '../../types/krogsveenTypes';
import { buildSourceUrl, extractSqm, buildLocation } from '../shared';

/**
 * Transform a Krogsveen estate to CommercialPropertyTierI.
 *
 * Krogsveen commercial listing type: commissionType = "COMMERCIAL_FOR_SALE"
 * Occurs rarely in the bsrPropertyType="annet" bucket.
 */
export function transformKrogsveenCommercial(estate: KrogsveenEstate): CommercialPropertyTierI {
  const title = estate.head || `${estate.typeName || 'Næring'} – ${estate.vadr || ''}`.trim();
  const location = buildLocation(estate);

  // Total usable area for commercial
  const sqm_total = extractSqm(estate);

  const has_elevator = estate.lift ?? false;
  const has_parking = estate.garage ?? false;
  const has_bathrooms = false; // not exposed in Krogsveen search API

  const source_url = buildSourceUrl(estate);
  const portal_id = `krogsveen-no-${estate.id}`;

  const published_date = estate.publishedAt
    ? new Date(estate.publishedAt).toISOString()
    : undefined;

  const ownershipType = estate.ownershipType || estate.ownershipName || undefined;

  return {
    property_category: 'commercial' as const,

    title,
    price: estate.price ?? 0,
    currency: 'NOK',
    transaction_type: 'sale',

    location,

    country_specific: {
      no_ownership_type: ownershipType,
      no_total_price: estate.totalPrice ?? undefined,
      no_commission_type: estate.commissionType ?? undefined,
      no_property_type_name: estate.typeName ?? undefined,
    },

    // Commercial-specific required fields
    sqm_total,
    has_elevator,
    has_parking,
    has_bathrooms,

    published_date,

    source_url,
    source_platform: 'krogsveen-no',
    portal_id,
    status: 'active' as const,
  };
}
