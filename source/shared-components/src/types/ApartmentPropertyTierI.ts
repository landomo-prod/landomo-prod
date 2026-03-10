/**
 * Apartment Property Type (Tier I)
 *
 * Category-specific type for apartment properties with relevant fields only.
 * No nullable spam - fields are required or genuinely optional.
 *
 * Benefits over property-agnostic StandardProperty:
 * - Type safety: bedrooms always defined for apartments
 * - No irrelevant fields (area_plot_sqm, zoning, etc.)
 * - Better LLM extraction (focused prompts)
 * - Cleaner transformers
 */

import { PropertyLocation, PropertyMedia, PropertyAgent } from './property';

/**
 * Apartment Property (Tier I)
 *
 * Focused on apartment-specific fields:
 * - Bedrooms, floor, elevator
 * - Building context (year, construction type)
 * - Apartment amenities (balcony, parking)
 */
export interface ApartmentPropertyTierI {
  // ============ Category Classification ============
  property_category: 'apartment';

  // ============ Core Identification (non-nullable) ============
  title: string;
  price: number;
  currency: string;
  transaction_type: 'sale' | 'rent';

  // ============ Location (required) ============
  location: PropertyLocation;

  // ============ Classification ============
  /**
   * Apartment sub-type classification (universal categories)
   * Enables more precise filtering and valuation
   */
  property_subtype?: 'standard' | 'penthouse' | 'loft' | 'atelier' | 'maisonette' | 'studio';

  // ============ Apartment-Specific Details ============
  /**
   * Number of bedrooms (NOT nullable for apartments)
   * Formula: bedrooms = rooms - 1 (Czech: 2+kk = 1 bedroom, 3+kk = 2 bedrooms)
   */
  bedrooms: number;

  /**
   * Number of bathrooms
   */
  bathrooms?: number;

  /**
   * Living area in square meters (required for apartments)
   */
  sqm: number;

  /**
   * Which floor the apartment is on (0 = ground floor)
   */
  floor?: number;

  /**
   * Total number of floors in the building
   */
  total_floors?: number;

  /**
   * Total number of rooms (including living room + bedrooms)
   * Czech: 2+kk has 2 rooms total, 3+kk has 3 rooms total
   */
  rooms?: number;

  // ============ Apartment Amenities (booleans, not nullable) ============
  /**
   * Building has elevator
   */
  has_elevator: boolean;

  /**
   * Apartment has balcony
   */
  has_balcony: boolean;

  /**
   * Balcony area in square meters (when available)
   * Polymorphic: has_balcony=true with optional area measurement
   */
  balcony_area?: number;

  /**
   * Has parking space included
   */
  has_parking: boolean;

  /**
   * Number of parking spaces (when count is known)
   */
  parking_spaces?: number;

  /**
   * Has basement/cellar storage
   */
  has_basement: boolean;

  /**
   * Basement/cellar area in square meters (when available)
   */
  cellar_area?: number;

  /**
   * Has loggia (covered balcony, common in Czech/Slovakia)
   */
  has_loggia?: boolean;

  /**
   * Loggia area in square meters (when available)
   */
  loggia_area?: number;

  /**
   * Has terrace
   */
  has_terrace?: boolean;

  /**
   * Terrace area in square meters (when available)
   */
  terrace_area?: number;

  /**
   * Has garage (separate from parking)
   */
  has_garage?: boolean;

  /**
   * Number of garages (when count is known)
   */
  garage_count?: number;

  // ============ Building Context ============
  /**
   * Year the building was constructed
   */
  year_built?: number;

  /**
   * Construction type
   */
  construction_type?: 'panel' | 'brick' | 'concrete' | 'mixed';

  /**
   * Property condition
   */
  condition?: 'new' | 'excellent' | 'good' | 'after_renovation' | 'requires_renovation';

  /**
   * Heating system type
   */
  heating_type?: string;

  /**
   * Energy efficiency class (EU: A-G)
   */
  energy_class?: string;

  /**
   * Floor location classification
   */
  floor_location?: 'ground_floor' | 'middle_floor' | 'top_floor';

  // ============ Tier 1 Universal Fields ============
  /**
   * Furnished status (Tier 1 universal field)
   * Promoted from country_specific for cross-country querying
   */
  furnished?: 'furnished' | 'partially_furnished' | 'not_furnished';

  /**
   * Year of last renovation (Tier 1 universal field)
   * Distinct from year_built - tracks major upgrades
   */
  renovation_year?: number;

  /**
   * Date when listing was first published on portal (Tier 1 universal field)
   * ISO 8601 timestamp
   */
  published_date?: string;

  // ============ Financials ============
  /**
   * Homeowner association fees (monthly)
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
   * Service charges (monthly, e.g., building maintenance, cleaning)
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
   * Examples: "včetně provize", "provize 1 měsíční nájem", "bez provize"
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
   * Examples: "furnished", "pets_allowed", "air_conditioning"
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
 * Type guard to check if a property is an apartment
 */
export function isApartmentProperty(property: any): property is ApartmentPropertyTierI {
  return (
    typeof property === 'object' &&
    property !== null &&
    typeof property.bedrooms === 'number' &&
    typeof property.sqm === 'number' &&
    typeof property.has_elevator === 'boolean'
  );
}
