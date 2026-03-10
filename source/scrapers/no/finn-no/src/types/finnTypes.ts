/**
 * Finn.no API Types
 *
 * Based on the finn.no search API:
 * GET https://www.finn.no/api/search-qf?searchkey={SEARCH_KEY}&vertical=realestate&page={PAGE}
 *
 * Search keys:
 * - SEARCH_ID_REALESTATE_HOMES       → for-sale residential (apartments, houses, etc.)
 * - SEARCH_ID_REALESTATE_LETTINGS    → for-rent residential
 * - SEARCH_ID_REALESTATE_PLOTS       → land/plots for sale
 * - SEARCH_ID_REALESTATE_LEISURE_SALE → cabins/leisure properties for sale
 *
 * Response: { docs: FinnListing[], metadata: FinnSearchMetadata }
 */

export interface FinnListing {
  type: string;
  id: string;
  ad_id: number;
  main_search_key: string;
  heading: string;
  location: string;
  canonical_url: string;
  timestamp: number;

  // Price fields
  price_suggestion?: FinnPrice;       // Asking price (sale) or monthly rent
  price_total?: FinnPrice;            // Total price including shared debt
  price_shared_cost?: FinnPrice;      // Monthly shared costs (fellesutgifter)

  // Area fields
  area?: FinnArea;                    // Living area (BRA/P-ROM) - sometimes present as `area`
  area_range?: FinnAreaRange;         // Living area as a range (when size_from === size_to it's exact)
  area_plot?: FinnArea;               // Plot/land area (tomtestørrelse)

  // Property details
  number_of_bedrooms?: number;
  property_type_description?: string; // Norwegian: "Leilighet", "Enebolig", "Rekkehus", etc.
  owner_type_description?: string;    // Norwegian: "Eier (Selveier)", "Andel", "Aksje"
  organisation_name?: string;         // Real estate agency name
  local_area_name?: string;           // Neighborhood name

  // Media
  image?: FinnImage;
  image_urls?: string[];
  logo?: FinnLogo;

  // Rental-specific
  furnished_state?: string;           // "Møblert", "Delvis møblert", "Umøblert"

  // Flags and labels
  flags?: string[];
  labels?: FinnLabel[];
  styling?: string[];
  extras?: string[];

  // Location
  coordinates?: FinnCoordinates;

  // Internal
  ad_type?: number;
  viewing_times?: string[];
}

export interface FinnPrice {
  amount: number;
  currency_code: string;  // "NOK"
  price_unit: string;     // "kr"
}

export interface FinnArea {
  size: number;
  unit: string;           // "m²"
  description: string;    // "p-rom", "tomtestørrelse"
}

export interface FinnAreaRange {
  size_from: number;
  size_to: number;
  unit: string;           // "m²"
  description: string;    // "size"
}

export interface FinnImage {
  url: string;
  path: string;
  height: number;
  width: number;
  aspect_ratio: number;
}

export interface FinnLogo {
  url: string;
  path: string;
}

export interface FinnLabel {
  id: string;
  text: string;
  type: string;           // "PRIMARY", "SECONDARY"
}

export interface FinnCoordinates {
  lat: number;
  lon: number;
  accuracy: number;
}

export interface FinnSearchMetadata {
  params: Record<string, any>;
  search_key: string;
  num_results: number;
  result_size: {
    match_count: number;
    group_count?: number;
  };
  paging: {
    param: string;
    current: number;
    last: number;
  };
  title: string;
  vertical: string;
  is_end_of_paging?: boolean;
}

export interface FinnSearchResponse {
  docs: FinnListing[];
  metadata: FinnSearchMetadata;
}

/**
 * Search key configurations for the different finn.no realestate sections
 */
export interface FinnSearchConfig {
  searchKey: string;
  label: string;
  offerType: 'sale' | 'rent';
}

export const FINN_SEARCH_CONFIGS: FinnSearchConfig[] = [
  {
    searchKey: 'SEARCH_ID_REALESTATE_HOMES',
    label: 'homes-sale',
    offerType: 'sale',
  },
  {
    searchKey: 'SEARCH_ID_REALESTATE_LETTINGS',
    label: 'lettings',
    offerType: 'rent',
  },
  {
    searchKey: 'SEARCH_ID_REALESTATE_PLOTS',
    label: 'plots-sale',
    offerType: 'sale',
  },
  {
    searchKey: 'SEARCH_ID_REALESTATE_LEISURE_SALE',
    label: 'leisure-sale',
    offerType: 'sale',
  },
];
