/**
 * House Property Type (Tier I)
 *
 * Category-specific type for house properties with relevant fields only.
 * Focused on house-specific features: plot size, garden, garage, stories.
 */

import { PropertyLocation, PropertyMedia, PropertyAgent } from './property';

/**
 * House Property (Tier I)
 *
 * Focused on house-specific fields:
 * - Plot size (critical for houses)
 * - Garden, garage, pool
 * - Stories, roof type
 */
export interface HousePropertyTierI {
  // ============ Category Classification ============
  property_category: 'house';

  // ============ Core Identification (non-nullable) ============
  title: string;
  price: number;
  currency: string;
  transaction_type: 'sale' | 'rent' | 'auction';

  // ============ Location (required) ============
  location: PropertyLocation;

  // ============ Classification ============
  /**
   * House sub-type classification (universal categories)
   * Enables more precise filtering and valuation
   */
  property_subtype?: 'detached' | 'semi_detached' | 'terraced' | 'villa' | 'cottage' | 'farmhouse' | 'townhouse' | 'bungalow';

  // ============ House-Specific Details ============
  /**
   * Number of bedrooms
   */
  bedrooms: number;

  /**
   * Number of bathrooms
   */
  bathrooms?: number;

  /**
   * Living area in square meters (interior usable space)
   */
  sqm_living: number;

  /**
   * Total built area in square meters (including walls, garage, structures)
   * Distinct from living area - used for construction value assessment
   */
  sqm_total?: number;

  /**
   * Plot/land area in square meters (CRITICAL for houses)
   */
  sqm_plot: number;

  /**
   * Number of stories/floors in the house
   */
  stories?: number;

  /**
   * Total number of rooms
   */
  rooms?: number;

  // ============ House Amenities (booleans, not nullable) ============
  /**
   * Has garden/yard
   */
  has_garden: boolean;

  /**
   * Garden area in square meters (when available)
   */
  garden_area?: number;

  /**
   * Has garage
   */
  has_garage: boolean;

  /**
   * Number of garages (when count is known)
   */
  garage_count?: number;

  /**
   * Has parking space
   */
  has_parking: boolean;

  /**
   * Number of parking spaces (when count is known)
   */
  parking_spaces?: number;

  /**
   * Has basement/cellar
   */
  has_basement: boolean;

  /**
   * Basement/cellar area in square meters (when available)
   */
  cellar_area?: number;

  /**
   * Has swimming pool
   */
  has_pool?: boolean;

  /**
   * Has fireplace
   */
  has_fireplace?: boolean;

  /**
   * Has terrace/patio
   */
  has_terrace?: boolean;

  /**
   * Terrace area in square meters (when available)
   */
  terrace_area?: number;

  /**
   * Has attic (usable space)
   */
  has_attic?: boolean;

  /**
   * Has balcony (less common for houses but possible)
   */
  has_balcony?: boolean;

  /**
   * Balcony area in square meters (when available)
   */
  balcony_area?: number;

  // ============ Building Context ============
  /**
   * Year the house was built (usually known for houses)
   */
  year_built?: number;

  /**
   * Year of last major renovation
   */
  renovation_year?: number;

  /**
   * Construction type
   */
  construction_type?: 'brick' | 'wood' | 'stone' | 'concrete' | 'mixed';

  /**
   * Property condition
   */
  condition?: 'new' | 'excellent' | 'good' | 'after_renovation' | 'requires_renovation';

  /**
   * Heating system type
   */
  heating_type?: string;

  /**
   * Roof type (houses have roofs, apartments don't)
   */
  roof_type?: 'flat' | 'gable' | 'hip' | 'mansard' | 'gambrel';

  /**
   * Energy efficiency class (EU: A-G)
   */
  energy_class?: string;

  // ============ Tier 1 Universal Fields ============
  /**
   * Furnished status (Tier 1 universal field)
   * Promoted from country_specific for cross-country querying
   */
  furnished?: 'furnished' | 'partially_furnished' | 'not_furnished';

  /**
   * Date when listing was first published on portal (Tier 1 universal field)
   * ISO 8601 timestamp
   */
  published_date?: string;

  // ============ Financials ============
  /**
   * Annual property tax
   */
  property_tax?: number;

  /**
   * Annual HOA fees (for semi-detached/terraced houses)
   */
  hoa_fees?: number;

  /**
   * Security deposit (for rentals)
   */
  deposit?: number;

  /**
   * Utility charges (monthly, e.g., water, heating)
   */
  utility_charges?: number;

  /**
   * Service charges (monthly, e.g., property maintenance)
   * Distinct from utility charges
   */
  service_charges?: number;

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
   * ISO date when property becomes available (for rentals)
   * Example: "2026-03-01"
   */
  available_from?: string;

  /**
   * Minimum rental period in days (for short-term rentals)
   * Example: 7 (minimum 1 week)
   */
  min_rent_days?: number;

  /**
   * Maximum rental period in days (for short-term rentals)
   * Example: 90 (maximum 3 months)
   */
  max_rent_days?: number;

  // ============ Media & Agent (shared) ============
  media?: PropertyMedia;
  agent?: PropertyAgent;

  /**
   * Additional features (array of strings)
   * Examples: "furnished", "solar_panels", "security_system"
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
 * Type guard to check if a property is a house
 */
export function isHouseProperty(property: any): property is HousePropertyTierI {
  return (
    typeof property === 'object' &&
    property !== null &&
    typeof property.bedrooms === 'number' &&
    typeof property.sqm_living === 'number' &&
    typeof property.sqm_plot === 'number' &&
    typeof property.has_garden === 'boolean'
  );
}
