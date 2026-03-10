import { LandPropertyTierI } from '@landomo/core';
import { KrogsveenEstate } from '../../types/krogsveenTypes';
import { buildSourceUrl, buildLocation } from '../shared';

/**
 * Transform a Krogsveen estate to LandPropertyTierI.
 *
 * Krogsveen land type: "tomt" (plot/land)
 * Area: plotSize is the primary field; landarea as fallback.
 */
export function transformKrogsveenLand(estate: KrogsveenEstate): LandPropertyTierI {
  const title = estate.head || `${estate.typeName || 'Tomt'} – ${estate.vadr || ''}`.trim();
  const location = buildLocation(estate);

  // Plot area — the defining required field for land
  const area_plot_sqm =
    estate.plotSize ??
    estate.landarea ??
    estate.areaSize ??
    estate.bra ??
    0;

  const source_url = buildSourceUrl(estate);
  const portal_id = `krogsveen-no-${estate.id}`;

  const published_date = estate.publishedAt
    ? new Date(estate.publishedAt).toISOString()
    : undefined;

  const ownershipType = estate.ownershipType || estate.ownershipName || undefined;

  return {
    property_category: 'land' as const,

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

    // Land-specific required field
    area_plot_sqm,

    published_date,

    source_url,
    source_platform: 'krogsveen-no',
    portal_id,
    status: 'active' as const,
  };
}
