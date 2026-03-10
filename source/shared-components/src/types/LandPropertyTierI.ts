/**
 * Land Property Type (Tier I)
 *
 * Category-specific type for land/plot properties with relevant fields only.
 * Focused on land-specific features: area, zoning, utilities, development potential.
 */

import { PropertyLocation, PropertyMedia, PropertyAgent } from './property';

/**
 * Land Property (Tier I)
 *
 * Focused on land-specific fields:
 * - Plot area (main metric)
 * - Zoning and land type
 * - Utilities (water, electricity, sewage)
 * - Development potential
 */
export interface LandPropertyTierI {
  // ============ Category Classification ============
  property_category: 'land';

  // ============ Core Identification (non-nullable) ============
  title: string;
  price: number;
  currency: string;

  /**
   * Land is rarely rented (mostly sales), but rental is possible
   */
  transaction_type: 'sale' | 'rent';

  // ============ Location (required) ============
  location: PropertyLocation;

  // ============ Classification ============
  /**
   * Land sub-type classification (universal categories)
   * Enables more precise filtering and valuation
   */
  property_subtype?: 'building_plot' | 'agricultural' | 'forest' | 'vineyard' | 'orchard' | 'recreational' | 'industrial';

  // ============ Land-Specific Details ============
  /**
   * Plot area in square meters (MAIN METRIC for land)
   */
  area_plot_sqm: number;

  /**
   * Zoning classification
   */
  zoning?: 'residential' | 'commercial' | 'agricultural' | 'mixed' | 'industrial' | 'recreational';

  /**
   * Type of land (more granular than zoning)
   */
  land_type?: 'arable' | 'grassland' | 'forest' | 'vineyard' | 'orchard' | 'building_plot' | 'meadow' | 'pasture';

  // ============ Utilities (CRITICAL for land) ============
  /**
   * Water supply status
   * - 'mains': Connected to public water supply
   * - 'well': Has well/borehole on property
   * - 'connection_available': Can be connected (not yet connected)
   * - 'none': No water supply available
   */
  water_supply?: 'mains' | 'well' | 'connection_available' | 'none';

  /**
   * Sewage system status
   * - 'mains': Connected to public sewage system
   * - 'septic': Has septic tank on property
   * - 'connection_available': Can be connected (not yet connected)
   * - 'none': No sewage system available
   */
  sewage?: 'mains' | 'septic' | 'connection_available' | 'none';

  /**
   * Electricity connection status
   * - 'connected': Has electricity connection
   * - 'connection_available': Can be connected (not yet connected)
   * - 'none': No electricity available
   */
  electricity?: 'connected' | 'connection_available' | 'none';

  /**
   * Gas connection status
   * - 'connected': Has gas connection
   * - 'connection_available': Can be connected (not yet connected)
   * - 'none': No gas available
   */
  gas?: 'connected' | 'connection_available' | 'none';

  /**
   * Road access quality
   */
  road_access?: 'paved' | 'gravel' | 'dirt' | 'none';

  // ============ Backward Compatibility (Deprecated) ============
  /**
   * @deprecated Use water_supply field instead
   */
  has_water_connection?: boolean;

  /**
   * @deprecated Use electricity field instead
   */
  has_electricity_connection?: boolean;

  /**
   * @deprecated Use sewage field instead
   */
  has_sewage_connection?: boolean;

  /**
   * @deprecated Use gas field instead
   */
  has_gas_connection?: boolean;

  // ============ Development Potential ============
  /**
   * Has valid building permit
   */
  building_permit?: boolean;

  /**
   * Maximum building coverage percentage (e.g., 30 = 30% of plot can be built on)
   */
  max_building_coverage?: number;

  /**
   * Maximum allowed building height in meters
   */
  max_building_height?: number;

  /**
   * Terrain type
   */
  terrain?: 'flat' | 'sloped' | 'hilly' | 'mountainous';

  /**
   * Soil quality (for agricultural land)
   */
  soil_quality?: 'excellent' | 'good' | 'fair' | 'poor';

  // ============ Legal & Administrative ============
  /**
   * Cadastral number (land registry ID)
   */
  cadastral_number?: string;

  /**
   * Ownership type
   */
  ownership_type?: 'personal' | 'state' | 'municipal' | 'cooperative';

  // ============ Financials ============
  /**
   * Whether a real estate agency commission applies
   * true = commission required, false = no commission, undefined = unknown
   */
  is_commission?: boolean;

  /**
   * Free-text note about commission/agency fees
   */
  commission_note?: string;

  // ============ Rental-Specific Fields ============
  /**
   * ISO date when property becomes available (rare for land, but possible)
   * Example: "2026-03-01"
   */
  available_from?: string;

  // ============ Tier 1 Universal Fields ============
  /**
   * Furnished status (Tier 1 universal field)
   * Rarely applicable to land, but included for schema consistency
   */
  furnished?: 'furnished' | 'partially_furnished' | 'not_furnished';

  /**
   * Year of last renovation (Tier 1 universal field)
   * May apply if land has existing structures
   */
  renovation_year?: number;

  /**
   * Date when listing was first published on portal (Tier 1 universal field)
   * ISO 8601 timestamp
   */
  published_date?: string;

  // ============ Media & Agent (shared) ============
  media?: PropertyMedia;
  agent?: PropertyAgent;

  /**
   * Additional features (array of strings)
   * Examples: "fenced", "irrigation_system", "fruit_trees"
   */
  features?: string[];

  /**
   * Full property description
   */
  description?: string;

  // ============ Tier II: Legacy Media Fields ============
  /**
   * @deprecated Use media.images instead
   * Legacy flat array of image URLs for backward compatibility
   */
  images?: string[];

  /**
   * @deprecated Use media.videos instead
   * Legacy flat array of video URLs for backward compatibility
   */
  videos?: string[];

  // ============ Tier III: Portal & Country Metadata ============
  /**
   * Portal-specific metadata (JSONB)
   * Examples: portal UI config, internal IDs, raw portal fields
   */
  portal_metadata?: any;

  /**
   * Country-specific fields (JSONB)
   * Examples: Czech disposition, UK tenure, French DPE ratings
   */
  country_specific?: any;

  // ============ Portal & Lifecycle ============
  source_url: string;
  source_platform: string;
  portal_id?: string;

  status: 'active' | 'removed' | 'sold' | 'rented';

  // ============ Timestamps ============
  first_seen_at?: Date;
  last_seen_at?: Date;
  created_at?: Date;
  updated_at?: Date;
}

/**
 * Type guard to check if a property is land
 */
export function isLandProperty(property: any): property is LandPropertyTierI {
  return (
    typeof property === 'object' &&
    property !== null &&
    typeof property.area_plot_sqm === 'number' &&
    typeof property.has_water_connection === 'boolean' &&
    typeof property.has_electricity_connection === 'boolean'
  );
}
