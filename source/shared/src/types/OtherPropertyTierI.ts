/**
 * Other Property Type (Tier I)
 *
 * Category-specific type for 'other' properties: garages, parking spaces,
 * mobile homes, storage units, and miscellaneous property types.
 *
 * Benefits over property-agnostic StandardProperty:
 * - Type safety: Other-specific fields always defined
 * - No irrelevant fields (bedrooms, bathrooms, etc.)
 * - Better LLM extraction (focused prompts)
 * - Cleaner transformers
 */

import { PropertyLocation, PropertyMedia, PropertyAgent } from './property';

/**
 * Other Property (Tier I)
 *
 * Focused on miscellaneous property fields:
 * - Garages, parking spaces, mobile homes, storage units
 * - Area, electricity, water connections
 * - Access and security features
 */
export interface OtherPropertyTierI {
  // ============ Category Classification ============
  property_category: 'other';

  // ============ Core Identification (non-nullable) ============
  title: string;
  price: number;
  currency: string;
  transaction_type: 'sale' | 'rent' | 'auction';

  // ============ Location (required) ============
  location: PropertyLocation;

  // ============ Classification ============
  /**
   * Other sub-type classification (universal categories)
   * Enables more precise filtering and valuation
   */
  property_subtype?: 'garage' | 'parking_space' | 'mobile_home' | 'storage' | 'other';

  // ============ Other-Specific Details ============
  /**
   * Total area in square meters (required)
   * Main metric for garages, parking spaces, storage units
   */
  sqm_total: number;

  /**
   * Has parking space (always true for this category)
   */
  has_parking: boolean;

  /**
   * Has electricity connection
   */
  has_electricity: boolean;

  /**
   * Number of parking spaces (for multi-space garages)
   */
  parking_spaces?: number;

  /**
   * Has water connection
   */
  has_water_connection?: boolean;

  /**
   * Has heating system
   */
  has_heating?: boolean;

  /**
   * Security system type
   * Examples: "alarm", "camera", "guard", "gated"
   */
  security_type?: string;

  /**
   * Access type for the property
   */
  access_type?: 'direct' | 'remote' | 'keycard';

  // ============ Building Context ============
  /**
   * Year the structure was constructed
   */
  year_built?: number;

  /**
   * Construction type/material
   */
  construction_type?: 'brick' | 'concrete' | 'steel' | 'prefab' | 'wood';

  /**
   * Property condition
   */
  condition?: 'new' | 'excellent' | 'good' | 'fair' | 'requires_renovation';

  // ============ Financials ============
  /**
   * Security deposit (for rentals)
   */
  deposit?: number;

  /**
   * Service charges (monthly)
   */
  service_charges?: number;

  /**
   * ISO date when property becomes available (for rentals)
   * Example: "2026-03-01"
   */
  available_from?: string;

  // ============ Media & Agent (shared) ============
  media?: PropertyMedia;
  agent?: PropertyAgent;

  /**
   * Additional features (array of strings)
   * Examples: "automatic_door", "pit", "electric_charging"
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
 * Type guard to check if a property is an 'other' category property
 */
export function isOtherProperty(property: any): property is OtherPropertyTierI {
  return (
    typeof property === 'object' &&
    property !== null &&
    property.property_category === 'other' &&
    typeof property.sqm_total === 'number' &&
    typeof property.has_parking === 'boolean' &&
    typeof property.has_electricity === 'boolean'
  );
}
