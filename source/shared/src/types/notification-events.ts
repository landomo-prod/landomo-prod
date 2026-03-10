/**
 * Notification Event Types
 *
 * Shared types for property change events published by the ingest service
 * and consumed by the notification service for watchdog evaluation.
 */

export type PropertyEventType =
  | 'new_listing'
  | 'price_drop'
  | 'price_increase'
  | 'status_removed'
  | 'reactivated';

export type PropertyCategory = 'apartment' | 'house' | 'land' | 'commercial' | 'other';

/**
 * Snapshot of filterable fields for a property, used by the watchdog evaluator
 * to match against user-defined watchdog filters without querying the database.
 *
 * Field names mirror SearchFilters from the search service.
 */
export interface PropertyFilterSnapshot {
  property_category: PropertyCategory;
  transaction_type?: string;
  city?: string;
  region?: string;
  district?: string;
  neighbourhood?: string;
  municipality?: string;
  price?: number;
  currency?: string;

  // Apartment / House
  bedrooms?: number;
  bathrooms?: number;
  sqm?: number;
  floor?: number;

  // House-specific
  sqm_living?: number;
  sqm_plot?: number;

  // Land-specific
  area_plot_sqm?: number;

  // Commercial-specific
  sqm_total?: number;

  // Universal property attributes
  furnished?: string;
  construction_type?: string;
  energy_class?: string;
  year_built?: number;

  // Czech-specific
  disposition?: string;
  ownership?: string;
  building_type?: string;
  condition?: string;

  // Amenities
  has_parking?: boolean;
  has_garden?: boolean;
  has_pool?: boolean;
  has_balcony?: boolean;
  has_terrace?: boolean;
  has_elevator?: boolean;
  has_garage?: boolean;
  has_basement?: boolean;
}

/**
 * A single property change event emitted during batch ingestion.
 */
export interface PropertyChangeEvent {
  property_id: string;
  portal_id: string;
  event_type: PropertyEventType;
  property_category: PropertyCategory;
  city: string;
  region?: string;
  price: number;
  old_price?: number;
  title?: string;
  source_url?: string;
  images?: string[];
  filter_snapshot: PropertyFilterSnapshot;
}

/**
 * Batch event published to Redis `property:changes:{country}` channel
 * after each ingest batch is processed.
 */
export interface PropertyBatchEvent {
  country: string;
  portal: string;
  timestamp: number;
  batch_size: number;
  changes: PropertyChangeEvent[];
}

/**
 * Watchdog trigger events that users can subscribe to.
 */
export const WATCHDOG_TRIGGER_EVENTS: PropertyEventType[] = [
  'new_listing',
  'price_drop',
  'price_increase',
  'status_removed',
  'reactivated',
];

/**
 * Watchdog filter definition — mirrors SearchFilters from the search service
 * so users can set watchdog alerts with the same filtering power as search.
 * All fields are evaluated in-memory against PropertyFilterSnapshot.
 */
export interface WatchdogFilters {
  property_category?: PropertyCategory;
  transaction_type?: string;

  // Location
  city?: string;
  region?: string;
  district?: string;
  neighbourhood?: string;
  municipality?: string;

  // Price
  price_min?: number;
  price_max?: number;

  // Bedrooms / Bathrooms
  bedrooms_min?: number;
  bedrooms_max?: number;
  bathrooms_min?: number;

  // Size
  sqm_min?: number;
  sqm_max?: number;
  sqm_plot_min?: number;
  sqm_plot_max?: number;

  // Floor
  floor_min?: number;
  floor_max?: number;

  // Universal property attributes
  furnished?: string;                  // 'furnished', 'not_furnished', 'partially_furnished'
  construction_type?: string;          // 'brick', 'panel', 'wood', 'concrete', 'mixed', 'stone', 'prefab', 'other'
  energy_class?: string;
  year_built_min?: number;
  year_built_max?: number;

  // Portal
  portal?: string;

  // Czech-specific
  disposition?: string;
  ownership?: string;
  building_type?: string;
  condition?: string;

  // Amenities (if true, property must have it)
  has_parking?: boolean;
  has_garden?: boolean;
  has_pool?: boolean;
  has_balcony?: boolean;
  has_terrace?: boolean;
  has_elevator?: boolean;
  has_garage?: boolean;
  has_basement?: boolean;
}
