import { HousePropertyTierI } from '@landomo/core';
import { KrogsveenEstate } from '../../types/krogsveenTypes';
import { buildSourceUrl, extractSqm, buildLocation } from '../shared';

/**
 * Transform a Krogsveen estate to HousePropertyTierI.
 *
 * Krogsveen house types:
 *   enebolig     → detached house
 *   rekkehus     → townhouse / terraced house
 *   tomannsbolig → semi-detached / duplex
 *   hytter/fritid → cabin / leisure property
 *   gårdsbruk/småbruk → farm / smallholding
 *   annet        → other (fallback)
 */
export function transformKrogsveenHouse(estate: KrogsveenEstate): HousePropertyTierI {
  const title = estate.head || `${estate.typeName || 'Bolig'} – ${estate.vadr || ''}`.trim();
  const location = buildLocation(estate);

  // For houses: BRA is the living area; plot size maps to sqm_plot
  const sqm_living = extractSqm(estate);
  const sqm_plot: number = estate.plotSize ?? estate.landarea ?? 0;

  const bedrooms = estate.bedrooms ?? 0;

  // Krogsveen provides explicit flags
  const has_garage = estate.garage ?? false;
  const has_parking = estate.garage ?? false; // garage implies parking
  // Garden: infer from plot size presence (common for detached/semi-detached)
  const has_garden = (estate.plotSize != null && estate.plotSize > 0) ||
    (estate.head || '').toLowerCase().includes('hage');
  // Basement: braB (below-grade) or heading mention
  const has_basement = (estate.braB != null && estate.braB > 0) ||
    (estate.head || '').toLowerCase().includes('kjeller');

  const source_url = buildSourceUrl(estate);
  const portal_id = `krogsveen-no-${estate.id}`;

  const published_date = estate.publishedAt
    ? new Date(estate.publishedAt).toISOString()
    : undefined;

  const ownershipType = estate.ownershipType || estate.ownershipName || undefined;

  return {
    property_category: 'house' as const,

    title,
    price: estate.price ?? 0,
    currency: 'NOK',
    transaction_type: 'sale',

    location,

    property_subtype: detectHouseSubtype(estate),

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

    // House-specific required fields
    bedrooms,
    sqm_living,
    sqm_plot,
    has_garden,
    has_garage,
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

function detectHouseSubtype(
  estate: KrogsveenEstate
): 'detached' | 'semi_detached' | 'terraced' | 'villa' | 'cottage' | 'farmhouse' | 'townhouse' | 'bungalow' | undefined {
  const propType = (estate.bsrPropertyType || '').toLowerCase();
  const typeLower = (estate.typeName || '').toLowerCase();

  if (propType === 'hytter/fritid' || typeLower.includes('hytte') || typeLower.includes('fritid')) {
    return 'cottage'; // Norwegian hytte/cabin maps to cottage
  }
  if (propType === 'gårdsbruk/småbruk' || typeLower.includes('gårdsbruk') || typeLower.includes('småbruk')) {
    return 'farmhouse';
  }
  if (propType === 'rekkehus' || typeLower.includes('rekkehus') || typeLower.includes('rekke')) {
    return 'terraced';
  }
  if (propType === 'tomannsbolig' || typeLower.includes('tomanns') || typeLower.includes('halvpart')) {
    return 'semi_detached';
  }
  if (typeLower.includes('villa')) {
    return 'villa';
  }
  if (propType === 'enebolig' || typeLower.includes('enebolig')) {
    return 'detached';
  }

  return undefined;
}
