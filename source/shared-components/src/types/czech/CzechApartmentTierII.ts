/**
 * Czech Apartment Property (Tier II)
 *
 * Extends ApartmentPropertyTierI with Czech-specific fields:
 * - Disposition (1+kk, 2+kk, 3+kk, etc.)
 * - Ownership type (personal, cooperative)
 * - Specific area measurements (balcony, cellar)
 */

import { ApartmentPropertyTierI } from '../ApartmentPropertyTierI';

/**
 * Czech-specific apartment fields
 *
 * These fields are specific to the Czech real estate market and are not
 * universally applicable. They capture Czech-specific conventions found
 * in portals like SReality and Bezrealitky.
 *
 * Note: Fields already in Tier I (ApartmentPropertyTierI) are NOT duplicated here:
 * - has_balcony, has_loggia, has_basement (boolean flags in Tier I)
 * - balcony_area, loggia_area, cellar_area (optional area measurements in Tier I)
 * - property_subtype (universal apartment classification in Tier I)
 */
export interface CzechApartmentSpecific {
  /**
   * Czech disposition code (room layout) - REQUIRED
   *
   * Format: X+Y where:
   * - X = number of rooms (living room + bedrooms)
   * - Y = kitchen type (kk = kitchenette, 1 = separate kitchen)
   *
   * This is a CZECH-SPECIFIC field that represents how Czechs describe apartments.
   * It's distinct from Tier I fields:
   * - bedrooms (derived: disposition "2+kk" → 1 bedroom)
   * - rooms (total count: disposition "2+kk" → 2 rooms)
   *
   * Examples:
   * - 1+kk = studio (0 bedrooms, kitchenette)
   * - 2+kk = 1 bedroom + living room + kitchenette
   * - 2+1 = 1 bedroom + living room + separate kitchen
   * - 3+kk = 2 bedrooms + living room + kitchenette
   * - 3+1 = 2 bedrooms + living room + separate kitchen
   * - atypický = non-standard layout
   *
   * Sources: SReality (disposition field), Bezrealitky (disposition field)
   */
  czech_disposition: '1+kk' | '1+1' | '2+kk' | '2+1' | '3+kk' | '3+1' | '4+kk' | '4+1' | '5+kk' | '5+1' | '6+kk' | '6+1' | 'atypický';

  /**
   * Czech ownership type - REQUIRED
   *
   * Czech apartments have distinct ownership structures:
   * - personal = osobní vlastnictví (OV) - full individual ownership
   * - cooperative = družstevní (DB) - cooperative ownership (common in panel buildings)
   * - state = státní - state-owned (rare, legacy from communist era)
   * - municipal = obecní/městský - municipal ownership
   *
   * This is Czech-specific because:
   * - Cooperative ownership is unique to Czech/CEE markets
   * - Affects financing, selling rights, and property value
   *
   * Sources: SReality (ownership field), Bezrealitky (ownership field)
   */
  czech_ownership: 'personal' | 'cooperative' | 'state' | 'municipal';

  /**
   * Building type classification (Czech context)
   *
   * Czech-specific building types reflecting historical construction periods:
   * - panel = panelový dům (prefab concrete, 1960s-1990s, communist era)
   * - brick = cihlový dům (traditional brick construction, pre-1960s or modern)
   * - brick_old = starší cihlová zástavba (historical brick buildings, pre-WWII)
   * - brick_modern = nová cihlová zástavba (modern brick, post-2000)
   * - new_development = novostavba (brand new construction, last 5 years)
   *
   * This extends Tier I's construction_type with Czech-specific historical context.
   * Panel buildings are a significant segment (30-40%) of Czech housing stock.
   *
   * Sources: SReality (building_type), Bezrealitky (construction)
   */
  building_type?: 'panel' | 'brick' | 'brick_old' | 'brick_modern' | 'concrete' | 'new_development' | 'mixed';

  /**
   * Usable area in square meters (Czech: užitná plocha)
   *
   * Czech portals often report multiple area measurements:
   * - Living area (sqm in Tier I) = obytná plocha (living spaces only)
   * - Usable area (this field) = užitná plocha (includes balcony, cellar, etc.)
   * - Built area = zastavěná plocha (including walls, total footprint)
   *
   * Usable area is Czech-specific convention for total functional space.
   *
   * Sources: Bezrealitky (surfaceUsable), SReality (area measurements)
   */
  area_usable?: number;

  /**
   * Built area in square meters (Czech: zastavěná plocha)
   *
   * Total built footprint including walls and structural elements.
   * Used in Czech market for construction value assessment.
   *
   * Sources: Bezrealitky (surfaceBuilt)
   */
  area_built?: number;
}

/**
 * Czech Apartment Property (Tier I + Tier II)
 */
export interface CzechApartmentTierII extends ApartmentPropertyTierI {
  /**
   * Czech-specific fields
   */
  country_specific: CzechApartmentSpecific;
}

/**
 * Type guard for Czech apartments
 */
export function isCzechApartment(property: any): property is CzechApartmentTierII {
  return (
    typeof property === 'object' &&
    property !== null &&
    typeof property.bedrooms === 'number' &&
    typeof property.country_specific === 'object' &&
    property.country_specific !== null &&
    typeof property.country_specific.czech_disposition === 'string' &&
    typeof property.country_specific.czech_ownership === 'string'
  );
}

/**
 * Calculate bedrooms from Czech disposition
 *
 * Formula: bedrooms = rooms - 1 (except 1+kk = 0 bedrooms)
 */
export function bedroomsFromDisposition(disposition: string): number {
  const match = disposition.match(/^(\d+)\+/);
  if (!match) return 0;

  const rooms = parseInt(match[1], 10);
  if (rooms === 1) return 0; // 1+kk is a studio (0 bedrooms)
  return rooms - 1; // 2+kk = 1 bedroom, 3+kk = 2 bedrooms, etc.
}
