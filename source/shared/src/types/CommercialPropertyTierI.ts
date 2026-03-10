/**
 * Commercial Property Type (Tier I)
 *
 * Category-specific type for commercial properties with relevant fields only.
 * Focused on commercial-specific features: office space, retail, industrial facilities.
 *
 * Benefits over property-agnostic StandardProperty:
 * - Type safety: Commercial-specific fields always defined
 * - No irrelevant fields (bedrooms, bathrooms, etc.)
 * - Better LLM extraction (focused prompts)
 * - Cleaner transformers
 */

import { PropertyLocation, PropertyMedia, PropertyAgent } from './property';

/**
 * Commercial Property (Tier I)
 *
 * Focused on commercial-specific fields:
 * - Office, retail, industrial, warehouse classifications
 * - Floor area, office space, loading docks
 * - Commercial amenities (parking, HVAC, security)
 * - Lease terms and operating costs
 */
export interface CommercialPropertyTierI {
  // ============ Category Classification ============
  property_category: 'commercial';

  // ============ Core Identification (non-nullable) ============
  title: string;
  price: number;
  currency: string;
  transaction_type: 'sale' | 'rent' | 'auction';

  // ============ Location (required) ============
  location: PropertyLocation;

  // ============ Classification ============
  /**
   * Commercial sub-type classification (universal categories)
   * Enables more precise filtering and valuation
   */
  property_subtype?: 'office' | 'retail' | 'industrial' | 'warehouse' | 'mixed_use' | 'hotel' | 'restaurant' | 'medical' | 'showroom';

  // ============ Commercial-Specific Details ============
  /**
   * Total floor area in square meters (CRITICAL for commercial)
   * This is the main metric for commercial properties
   */
  sqm_total: number;

  /**
   * Usable/leasable floor area in square meters
   * The actual space available for business operations
   */
  sqm_usable?: number;

  /**
   * Office space area in square meters (for office/mixed-use properties)
   */
  sqm_office?: number;

  /**
   * Retail space area in square meters (for retail/mixed-use properties)
   */
  sqm_retail?: number;

  /**
   * Storage/warehouse area in square meters
   */
  sqm_storage?: number;

  /**
   * Plot/land area in square meters (for standalone buildings)
   */
  sqm_plot?: number;

  /**
   * Number of floors in the building
   */
  total_floors?: number;

  /**
   * Which floor(s) the commercial space occupies
   * Can be a single floor or range (e.g., "3-5")
   */
  floor?: number;

  /**
   * Floor location classification (for multi-story buildings)
   */
  floor_location?: 'ground_floor' | 'middle_floor' | 'top_floor' | 'basement' | 'multiple_floors';

  /**
   * Number of office rooms/units
   */
  office_rooms?: number;

  /**
   * Number of meeting rooms/conference rooms
   */
  meeting_rooms?: number;

  /**
   * Ceiling height in meters (important for warehouses/industrial)
   */
  ceiling_height?: number;

  // ============ Commercial Amenities (booleans, not nullable) ============
  /**
   * Building has elevator/lift
   */
  has_elevator: boolean;

  /**
   * Number of elevators (when count is known)
   */
  elevator_count?: number;

  /**
   * Has parking spaces available
   */
  has_parking: boolean;

  /**
   * Number of parking spaces
   */
  parking_spaces?: number;

  /**
   * Has loading dock/bay (for warehouses/industrial)
   */
  has_loading_dock?: boolean;

  /**
   * Number of loading docks (when count is known)
   */
  loading_dock_count?: number;

  /**
   * Has HVAC (heating, ventilation, air conditioning) system
   */
  has_hvac?: boolean;

  /**
   * Has air conditioning system
   */
  has_air_conditioning?: boolean;

  /**
   * Has security system (cameras, access control, alarm)
   */
  has_security_system?: boolean;

  /**
   * Has 24/7 security personnel
   */
  has_security_staff?: boolean;

  /**
   * Has reception/front desk
   */
  has_reception?: boolean;

  /**
   * Has kitchen/kitchenette facilities
   */
  has_kitchen?: boolean;

  /**
   * Has bathroom/restroom facilities
   */
  has_bathrooms: boolean;

  /**
   * Number of bathrooms/restrooms
   */
  bathroom_count?: number;

  /**
   * Has disabled/wheelchair access
   */
  has_disabled_access?: boolean;

  /**
   * Has server room/IT infrastructure
   */
  has_server_room?: boolean;

  /**
   * Has backup power generator
   */
  has_backup_generator?: boolean;

  /**
   * Has fiber optic internet connection
   */
  has_fiber_internet?: boolean;

  /**
   * Has sprinkler/fire suppression system
   */
  has_sprinklers?: boolean;

  /**
   * Has warehouse racking/shelving systems
   */
  has_racking_system?: boolean;

  /**
   * Has showroom/display area
   */
  has_showroom?: boolean;

  /**
   * Has outdoor space/yard
   */
  has_outdoor_space?: boolean;

  /**
   * Outdoor space area in square meters (when available)
   */
  outdoor_area?: number;

  // ============ Building Context ============
  /**
   * Year the building was constructed
   */
  year_built?: number;

  /**
   * Year of last major renovation
   */
  renovation_year?: number;

  /**
   * Construction type/material
   */
  construction_type?: 'brick' | 'concrete' | 'steel' | 'mixed' | 'prefab';

  /**
   * Property condition
   */
  condition?: 'new' | 'excellent' | 'good' | 'fair' | 'requires_renovation';

  /**
   * Heating system type
   */
  heating_type?: string;

  /**
   * Energy efficiency class (EU: A-G)
   */
  energy_class?: string;

  /**
   * Building class/grade (A, B, C)
   * A = Premium/Class A office space
   * B = Standard office space
   * C = Older/basic office space
   */
  building_class?: 'a' | 'b' | 'c';

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

  // ============ Commercial Financials ============
  /**
   * Monthly rent price (for rentals)
   */
  monthly_rent?: number;

  /**
   * Annual rent price (for rentals)
   */
  annual_rent?: number;

  /**
   * Price per square meter (sale or rent)
   */
  price_per_sqm?: number;

  /**
   * Operating costs (monthly)
   * Includes maintenance, utilities, common area costs
   */
  operating_costs?: number;

  /**
   * Service charges (monthly)
   * Building services, cleaning, security
   */
  service_charges?: number;

  /**
   * Utility costs (monthly, if not included in rent)
   */
  utility_costs?: number;

  /**
   * Property tax (annual)
   */
  property_tax?: number;

  /**
   * Security deposit (for rentals)
   */
  deposit?: number;

  /**
   * Minimum lease term in months
   */
  min_lease_months?: number;

  /**
   * Maximum lease term in months
   */
  max_lease_months?: number;

  /**
   * Commission/broker fee (numeric amount)
   */
  commission?: number;

  /**
   * Whether a real estate agency commission applies
   * true = commission required, false = no commission, undefined = unknown
   */
  is_commission?: boolean;

  /**
   * Free-text note about commission/agency fees
   */
  commission_note?: string;

  /**
   * CAM charges (Common Area Maintenance) - monthly
   * Common in retail/shopping center leases
   */
  cam_charges?: number;

  /**
   * Business rates (annual, UK-specific)
   */
  business_rates?: number;

  // ============ Lease & Availability ============
  /**
   * ISO date when property becomes available
   * Example: "2026-03-01"
   */
  available_from?: string;

  /**
   * Lease type
   */
  lease_type?: 'triple_net' | 'double_net' | 'single_net' | 'gross' | 'modified_gross' | 'percentage';

  /**
   * Current occupancy status
   */
  occupancy_status?: 'vacant' | 'partially_occupied' | 'fully_occupied' | 'owner_occupied';

  /**
   * Number of current tenants (for multi-tenant buildings)
   */
  tenant_count?: number;

  // ============ Zoning & Permits ============
  /**
   * Zoning classification
   */
  zoning?: 'commercial' | 'industrial' | 'mixed_use' | 'retail' | 'office';

  /**
   * Has valid business license/permit
   */
  has_business_license?: boolean;

  /**
   * Has certificate of occupancy
   */
  has_occupancy_certificate?: boolean;

  /**
   * Permitted uses (array of allowed business types)
   * Examples: ["retail", "office", "restaurant", "medical"]
   */
  permitted_uses?: string[];

  // ============ Media & Agent (shared) ============
  media?: PropertyMedia;
  agent?: PropertyAgent;

  /**
   * Additional features (array of strings)
   * Examples: "corner_unit", "high_visibility", "drive_through"
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
 * Type guard to check if a property is commercial
 */
export function isCommercialProperty(property: any): property is CommercialPropertyTierI {
  return (
    typeof property === 'object' &&
    property !== null &&
    property.property_category === 'commercial' &&
    typeof property.sqm_total === 'number' &&
    typeof property.has_elevator === 'boolean' &&
    typeof property.has_parking === 'boolean' &&
    typeof property.has_bathrooms === 'boolean'
  );
}
