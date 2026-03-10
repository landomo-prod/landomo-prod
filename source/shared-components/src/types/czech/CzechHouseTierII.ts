/**
 * Czech House Property (Tier II)
 *
 * Extends HousePropertyTierI with Czech-specific fields:
 * - House type (detached, semi-detached, terraced)
 * - Sewage and water supply systems
 * - Ownership type
 */

import { HousePropertyTierI } from '../HousePropertyTierI';

/**
 * Czech-specific house fields
 *
 * These fields are specific to the Czech real estate market and capture
 * Czech infrastructure conventions, ownership structures, and property
 * classifications found in portals like SReality and Bezrealitky.
 *
 * Note: Fields already in Tier I (HousePropertyTierI) are NOT duplicated here:
 * - has_garden, has_garage (boolean flags in Tier I)
 * - garden_area, garage_count (measurements in Tier I)
 * - property_subtype (universal house classification in Tier I)
 * - heating_type (universal field in Tier I)
 */
export interface CzechHouseSpecific {
  /**
   * Czech ownership type - REQUIRED
   *
   * Czech houses have distinct ownership structures:
   * - personal = osobní vlastnictví (OV) - full individual ownership (most common)
   * - cooperative = družstevní (DB) - cooperative ownership (rare for houses)
   * - state = státní - state-owned (legacy properties)
   * - municipal = obecní/městský - municipal ownership
   *
   * Same ownership types as apartments, but distribution differs.
   *
   * Sources: SReality (ownership field), Bezrealitky (ownership field)
   */
  czech_ownership: 'personal' | 'cooperative' | 'state' | 'municipal';

  /**
   * Sewage/waste water system type (Czech infrastructure variants)
   *
   * Czech houses have three distinct sewage options:
   * - mains = kanalizace (municipal sewage connection) - urban areas
   * - septic = septik (septic tank on property) - suburban/rural
   * - treatment_plant = čistička odpadních vod (on-site treatment) - rural, modern
   * - none = bez kanalizace (no sewage system) - very remote properties
   *
   * This is MORE GRANULAR than Tier I's generic sewage field:
   * - Tier I: 'mains' | 'septic' | 'connection_available' | 'none'
   * - Czech: Adds 'treatment_plant' specific to Czech market
   *
   * Sewage type significantly affects property value and usability.
   * Treatment plants (čističky) are common in Czech countryside.
   *
   * Sources: SReality (sewage field), Bezrealitky (sewage field)
   */
  sewage_type?: 'mains' | 'septic' | 'treatment_plant' | 'none';

  /**
   * Water supply source (Czech infrastructure variants)
   *
   * Czech houses have distinct water supply options:
   * - mains = vodovod (municipal water) - urban areas
   * - well = studna (well/borehole on property) - suburban/rural
   * - spring = pramen (natural spring on property) - rural, valuable
   * - none = bez vody (no water supply) - very rare
   *
   * This is MORE GRANULAR than Tier I's generic water_supply field:
   * - Tier I: 'mains' | 'well' | 'connection_available' | 'none'
   * - Czech: Adds 'spring' specific to Czech market
   *
   * Springs (prameny) are valued in Czech countryside for natural water.
   *
   * Sources: SReality (water field), Bezrealitky (water field)
   */
  water_supply_type?: 'mains' | 'well' | 'spring' | 'none';

  /**
   * Gas supply type (Czech infrastructure options)
   *
   * Czech houses have three gas supply options:
   * - mains = plynovod (natural gas from public network) - urban/suburban
   * - tank = zásobník (propane/LPG tank on property) - rural areas
   * - none = bez plynu (no gas supply) - electric heating only
   *
   * This extends Tier I's generic gas field with Czech-specific variants.
   * Propane tanks are common in Czech countryside where gas mains don't reach.
   *
   * Sources: Bezrealitky (gas_supply)
   */
  gas_supply_type?: 'mains' | 'tank' | 'none';

  /**
   * Heating source (Czech heating types)
   *
   * Czech-specific heating system classifications:
   * - central = ústřední (central heating from municipal system) - cities
   * - local_gas = lokální plynové (local gas boiler) - most common
   * - local_electric = lokální elektrické (electric heating) - modern/rural
   * - solid_fuel = tuhá paliva (coal/wood stove) - rural, older properties
   * - heat_pump = tepelné čerpadlo (heat pump) - modern, energy-efficient
   * - district = dálkové vytápění (district heating) - panel estates
   *
   * This is Czech-specific extension of Tier I's heating_type.
   * District heating is unique to Czech/CEE (legacy of communist era).
   *
   * Sources: SReality (heating), Bezrealitky (heating)
   */
  heating_source?: 'central' | 'local_gas' | 'local_electric' | 'solid_fuel' | 'heat_pump' | 'district' | 'solar';

  /**
   * Building material (Czech construction classifications)
   *
   * Czech-specific construction material types:
   * - brick = cihla (traditional brick, most valued)
   * - wood = dřevo (wooden construction, cottages/chalets)
   * - stone = kámen (stone construction, historical)
   * - concrete = beton (concrete construction, modern)
   * - panel = panel (prefab concrete, rare for houses)
   * - mixed = smíšená (combination of materials)
   *
   * Brick construction is highly valued in Czech market (quality indicator).
   *
   * Sources: SReality (construction), Bezrealitky (construction)
   */
  construction_material?: 'brick' | 'wood' | 'stone' | 'concrete' | 'panel' | 'mixed';

  /**
   * Usable area in square meters (Czech: užitná plocha)
   *
   * Czech portals report multiple area measurements for houses:
   * - Living area (sqm_living in Tier I) = obytná plocha (interior living spaces)
   * - Usable area (this field) = užitná plocha (includes garage, cellar, attic)
   * - Built area = zastavěná plocha (footprint including walls)
   *
   * Usable area is Czech-specific convention for total functional space.
   *
   * Sources: Bezrealitky (surfaceUsable), SReality (area measurements)
   */
  area_usable?: number;

  /**
   * Built area in square meters (Czech: zastavěná plocha)
   *
   * Total built footprint of the house including walls and structural elements.
   * Used in Czech market for construction permits and value assessment.
   *
   * Sources: Bezrealitky (surfaceBuilt)
   */
  area_built?: number;
}

/**
 * Czech House Property (Tier I + Tier II)
 */
export interface CzechHouseTierII extends HousePropertyTierI {
  /**
   * Czech-specific fields
   */
  country_specific: CzechHouseSpecific;
}

/**
 * Type guard for Czech houses
 */
export function isCzechHouse(property: any): property is CzechHouseTierII {
  return (
    typeof property === 'object' &&
    property !== null &&
    typeof property.sqm_living === 'number' &&
    typeof property.sqm_plot === 'number' &&
    typeof property.country_specific === 'object' &&
    property.country_specific !== null &&
    typeof property.country_specific.czech_ownership === 'string'
  );
}
