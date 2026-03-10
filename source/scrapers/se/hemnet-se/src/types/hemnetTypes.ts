/**
 * Hemnet.se GraphQL Types
 *
 * Discovered via API probing at https://www.hemnet.se/graphql
 *
 * Key facts:
 * - Endpoint: POST https://www.hemnet.se/graphql
 * - Auth: None required (public endpoint)
 * - Pagination: offset + limit (max limit: 1000, max offset+limit: 3000)
 * - Total listings: ~50,000 (split by housingFormGroups to stay under limit)
 * - Housing form groups: APARTMENTS, HOUSES, ROW_HOUSES, PLOTS, VACATION_HOMES, OTHERS, HOMESTEADS
 */

export interface HemnetMoney {
  amount: number;
}

export interface HemnetHousingForm {
  /** Human-readable Swedish name: "Lägenhet", "Villa", "Radhus", "Tomt", etc. */
  name: string;
  /** Group membership: ['APARTMENTS'], ['HOUSES'], ['ROW_HOUSES'], ['PLOTS'], ['VACATION_HOMES'], ['OTHERS'], ['HOMESTEADS'] */
  groups: string[];
}

/**
 * Base PropertyListing interface (common fields across all __typename variants)
 */
export interface HemnetPropertyListing {
  __typename: 'ActivePropertyListing' | 'DeactivatedBeforeOpenHousePropertyListing' | 'Project' | 'ProjectUnit';
  id: string;
  title: string;
  /** Monthly HOA/association fee (avgift) - present for Lägenhet, null for houses */
  fee: HemnetMoney | null;
  /** Price per square meter */
  squareMeterPrice: HemnetMoney | null;
  /** Asking price */
  askingPrice: HemnetMoney | null;
  /** Living area in sqm */
  livingArea: number | null;
  /** Land/plot area in sqm */
  landArea: number | null;
  /** Neighbourhood/area name within municipality */
  area: string | null;
  /** Number of rooms (includes living room, so bedrooms = numberOfRooms - 1 for apartments) */
  numberOfRooms: number | null;
  /** Full location name: "Område, Kommun" */
  locationName: string;
  /** Street address */
  streetAddress: string;
  /** Swedish postal code (5 digits, no space) */
  postCode: string;
  /** Postal area name */
  postalArea: string;
  /** Housing form details */
  housingForm: HemnetHousingForm;
}

/**
 * ActivePropertyListing - currently on market
 */
export interface HemnetActivePropertyListing extends HemnetPropertyListing {
  __typename: 'ActivePropertyListing';
  /** Days since published on Hemnet */
  daysOnHemnet: number;
  /** Unix timestamp (as string with decimals) of when listing was published */
  publishedAt: string;
}

export type HemnetListing = HemnetActivePropertyListing | HemnetPropertyListing;

export interface HemnetSearchResult {
  total: number;
  listings: HemnetListing[];
}

export interface HemnetGraphQLResponse {
  data?: {
    searchListings: HemnetSearchResult;
  };
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    extensions?: { code: string };
  }>;
}

/**
 * Housing form group enum values (confirmed working via API)
 */
export type HousingFormGroup =
  | 'APARTMENTS'
  | 'HOUSES'
  | 'ROW_HOUSES'
  | 'PLOTS'
  | 'VACATION_HOMES'
  | 'OTHERS'
  | 'HOMESTEADS';

/**
 * Swedish housing form names mapped to Landomo categories
 *
 * APARTMENTS group:
 *   Lägenhet → apartment
 *
 * HOUSES group:
 *   Villa → house
 *   Fritidshus → house (recreational cottage)
 *   Vinterbonat fritidshus → house (winterized recreational)
 *   Gård/skog → house (farm/forest property)
 *
 * ROW_HOUSES group:
 *   Radhus → house (row house / townhouse)
 *   Kedjehus → house (chain house)
 *   Parhus → house (semi-detached / duplex)
 *
 * PLOTS group:
 *   Tomt → land
 *
 * VACATION_HOMES group:
 *   Fritidshus → house
 *
 * OTHERS group:
 *   Övrig → house (other residential)
 *
 * HOMESTEADS group:
 *   Gård/skog → house (farm)
 */
export const HOUSING_FORM_GROUP_TO_CATEGORY = {
  APARTMENTS: 'apartment',
  HOUSES: 'house',
  ROW_HOUSES: 'house',
  PLOTS: 'land',
  VACATION_HOMES: 'house',
  OTHERS: 'house',
  HOMESTEADS: 'house',
} as const;

/**
 * Scrape configuration: groups to scrape with their approximate listing counts
 * (as of 2026-02-24)
 * - APARTMENTS: ~28,000 → must paginate with multiple offsets (max 3000/query)
 * - HOUSES: ~11,750 → paginate
 * - ROW_HOUSES: ~3,304 → single pass possible
 * - PLOTS: ~3,472 → single pass possible
 * - VACATION_HOMES: ~2,252 → single pass
 * - OTHERS: ~1,064 → single pass
 * - HOMESTEADS: ~781 → single pass
 */
export const HOUSING_FORM_GROUPS: HousingFormGroup[] = [
  'APARTMENTS',
  'HOUSES',
  'ROW_HOUSES',
  'PLOTS',
  'VACATION_HOMES',
  'OTHERS',
  'HOMESTEADS',
];
