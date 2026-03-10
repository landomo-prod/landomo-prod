/**
 * Czech Land Property (Tier II)
 *
 * Extends LandPropertyTierI with Czech-specific fields:
 * - Cadastral number (land registry)
 * - Land type classifications
 * - Ownership type
 */

import { LandPropertyTierI } from '../LandPropertyTierI';

/**
 * Czech-specific land fields
 *
 * These fields are specific to the Czech real estate market and capture
 * Czech land registry conventions, administrative classifications, and
 * agricultural land types found in portals like SReality and Bezrealitky.
 *
 * Note: Fields already in Tier I (LandPropertyTierI) are NOT duplicated here:
 * - area_plot_sqm (main metric in Tier I)
 * - property_subtype (universal land classification in Tier I)
 * - zoning (universal planning designation in Tier I)
 * - land_type (universal land type in Tier I)
 * - cadastral_number (universal land registry ID in Tier I)
 * - water_supply, sewage, electricity, gas (utility status in Tier I)
 */
export interface CzechLandSpecific {
  /**
   * Czech ownership type - REQUIRED
   *
   * Czech land has distinct ownership structures:
   * - personal = osobní vlastnictví (individual ownership) - most common
   * - state = státní (state-owned) - forests, nature reserves
   * - municipal = obecní/městský (municipal ownership) - public land
   * - cooperative = družstevní (cooperative ownership) - rare for land
   *
   * Land ownership type affects:
   * - Transferability and selling rights
   * - Development restrictions
   * - Agricultural subsidies eligibility
   * - Tax treatment
   *
   * Sources: SReality (ownership field), Bezrealitky (ownership field)
   */
  czech_ownership: 'personal' | 'state' | 'municipal' | 'cooperative';

  /**
   * Czech land type classification (more granular than Tier I)
   *
   * Czech-specific land classifications from cadastre (katastr nemovitostí):
   * - arable = orná půda (farmland for crops) - agricultural use
   * - grassland = trvalý travní porost (meadow/pasture) - grazing
   * - forest = lesní pozemek (forested land) - timber/conservation
   * - orchard = sad (fruit tree orchards) - specialized agriculture
   * - vineyard = vinice (grape vineyards) - wine production
   * - building_plot = stavební pozemek (designated for construction)
   * - garden = zahrada (residential garden) - attached to residence
   * - pond = vodní plocha (water bodies, ponds) - aquaculture
   * - recreational = rekreační pozemek (recreational plot) - weekend houses
   *
   * This extends Tier I's generic land_type with Czech-specific cadastral categories.
   * Czech land classification is more granular than universal categories.
   *
   * Legal significance:
   * - Determines agricultural subsidies eligibility
   * - Affects zoning and development potential
   * - Different tax rates for each category
   *
   * Sources: SReality (land_type), Bezrealitky (landType)
   */
  czech_land_type?: 'arable' | 'grassland' | 'forest' | 'orchard' | 'vineyard' | 'building_plot' | 'garden' | 'pond' | 'recreational';

  /**
   * Cadastral number (číslo parcely) - Czech land registry ID
   *
   * Unique identifier in Czech land registry (katastr nemovitostí).
   * Format: Usually numeric (e.g., "123/4" or "567")
   *
   * This is a SPECIFIC IMPLEMENTATION of Tier I's cadastral_number,
   * but kept here for Czech-specific documentation and validation rules.
   *
   * Required for:
   * - Legal property transfers
   * - Land registry queries
   * - Official documentation
   *
   * Sources: SReality (cadastral info), Bezrealitky (cadastralNumber)
   */
  cadastral_number?: string;

  /**
   * Cadastral district name (katastrální území)
   *
   * Administrative unit in Czech land registry system.
   * Examples: "Praha", "Brno-střed", "Líšeň"
   *
   * Cadastral districts are independent of municipal boundaries:
   * - One city can have multiple cadastral districts
   * - Cadastral district can span multiple municipalities
   *
   * Used for:
   * - Official land registry lookups
   * - Property tax calculations
   * - Legal property descriptions
   *
   * Sources: SReality (cadastral info), Bezrealitky (cadastralDistrict)
   */
  cadastral_district?: string;

  /**
   * Road access type (Czech: přístup po komunikaci)
   *
   * Czech-specific road access classifications:
   * - asphalt = asfaltová komunikace (paved road, best access)
   * - gravel = štěrková cesta (gravel road, good access)
   * - dirt = polní cesta (dirt road, fair access)
   * - field = pouze přes pole (field access only, poor access)
   * - none = bez přístupu (no direct access)
   *
   * This extends Tier I's road_access with Czech-specific granularity.
   * Road access significantly affects land value in Czech market.
   *
   * Sources: SReality (situation/road access), Bezrealitky (situation)
   */
  road_access_type?: 'asphalt' | 'gravel' | 'dirt' | 'field' | 'none';

  /**
   * Building permit status (Czech: stavební povolení)
   *
   * Czech-specific building permit classifications:
   * - valid = platné stavební povolení (valid permit, ready to build)
   * - pending = probíhající řízení (permit application in progress)
   * - not_required = není potřeba (permit not required for this land)
   * - required = vyžaduje povolení (permit required but not obtained)
   * - none = bez povolení (no permit)
   *
   * This extends Tier I's building_permit boolean with Czech-specific states.
   *
   * Sources: SReality (permit info), Bezrealitky (building permit status)
   */
  building_permit_status?: 'valid' | 'pending' | 'not_required' | 'required' | 'none';

  /**
   * Distance to utilities in meters (Czech: vzdálenost k sítím)
   *
   * Distance from plot boundary to nearest utility connection point.
   * Important for cost estimation of utility hookups.
   *
   * Common in Czech land listings for undeveloped plots.
   *
   * Sources: SReality (utility info), Bezrealitky (infrastructure distances)
   */
  distance_to_utilities?: number;
}

/**
 * Czech Land Property (Tier I + Tier II)
 */
export interface CzechLandTierII extends LandPropertyTierI {
  /**
   * Czech-specific fields
   */
  country_specific: CzechLandSpecific;
}

/**
 * Type guard for Czech land
 */
export function isCzechLand(property: any): property is CzechLandTierII {
  return (
    typeof property === 'object' &&
    property !== null &&
    typeof property.area_plot_sqm === 'number' &&
    typeof property.country_specific === 'object' &&
    property.country_specific !== null &&
    typeof property.country_specific.czech_ownership === 'string'
  );
}
