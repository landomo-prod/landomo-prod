/**
 * Types for Kiinteistömaailma.fi API responses.
 *
 * API endpoint: GET https://www.kiinteistomaailma.fi/api/km/KM/
 *
 * Query parameters:
 *   areaType      - 'living' (always)
 *   limit         - page size (up to 100)
 *   offset        - pagination offset
 *   rental        - 'true' | 'false'
 *   sort          - 'latestPublishTimestamp' | 'price' | 'livingArea'
 *   sortOrder     - 'asc' | 'desc'
 *   type          - 'property' (all), or specific filters
 *   maxArea       - max living area (empty = no limit)
 *   minArea       - min living area (empty = no limit)
 *   maxYearBuilt  - max year built (empty = no limit)
 *   minYearBuilt  - min year built (empty = no limit)
 *
 * Property type codes (type field):
 *   KT = Kerrostalo (apartment block)          → apartment
 *   RT = Rivitalo (row house)                  → house
 *   PT = Paritalo (semi-detached)              → house
 *   OT = Omakotitalo (detached/single-family)  → house
 *   ET = Erillistalo (detached variant)        → house
 *   MO = Mökki/Huvila (cottage/villa)          → house
 *   TO = Tontti (land plot)                    → land
 *
 * Group codes:
 *   As = Asunto (apartment/house)
 *   To = Tontti (land)
 *   Va = Vapaa-ajan asunto (vacation property)
 *
 * Total listings (Feb 2026):
 *   For sale: ~6,278
 *   Rental:   ~418
 *   Total:    ~6,696
 */

export interface KMImage {
  type: 'MAIN' | 'NORMAL' | 'GROUND_PLAN';
  description: string | null;
  /** Path prefix, e.g. "/property/1409481" */
  path: string;
  /** Image filename, e.g. "abc123.jpg" */
  name: string;
}

export interface KMOpenHouseAgent {
  name: string;
  email: string;
  phone: string;
  agency: string;
}

export interface KMOpenHouse {
  agent: string;
  agentInfo: KMOpenHouseAgent;
  start: { sec: number; usec: number };
  end: { sec: number; usec: number };
  type: 'NORMAL' | string;
  liveDemonstration: boolean;
  remoteUrl: string;
  description: string;
}

export interface KMLandOwnership {
  landArea_m2: number | null;
  landArea_ha: number | null;
}

export interface KMHousingCompany {
  area: number | null;
}

export interface KMLocation {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

export interface KMRentInfo {
  rentPerMonth: number;
  deposit: number | null;
  contractEndDate: string | null;
  specialConditions: string;
  contractTime: string;
  contractFixedStartDate: string | null;
  contractFixedEndDate: string | null;
  contractTypeDescription: string;
}

/**
 * A single property listing from the Kiinteistömaailma API.
 */
export interface KMListing {
  contentLanguage: string;
  /** Unique listing ID, e.g. "1409481" */
  key: string;
  isApartment: boolean;
  newConstruction: boolean;
  rental: boolean;
  rentInfo: KMRentInfo | null;
  onlineOffer: boolean;
  /** Sales price in euros (may be lower than unencumbered price due to debt) */
  salesPrice: number | null;
  /** Sales price including housing company debt (debt-free price) */
  salesPriceUnencumbered: number | null;
  address: string;
  postcode: string;
  city: string;
  county: string;
  municipality: string;
  district: string;
  /** Living area in m² */
  livingArea: number | null;
  /** Total area in m² */
  totalArea: number | null;
  /**
   * Property type code:
   * KT=Kerrostalo, RT=Rivitalo, PT=Paritalo, OT=Omakotitalo,
   * ET=Erillistalo, MO=Mökki/Huvila, TO=Tontti
   */
  type: string;
  /**
   * Property group:
   * As=Asunto, To=Tontti, Va=Vapaa-ajan asunto
   */
  group: string;
  /** Room configuration description, e.g. "3h + k + s" */
  roomTypes: string | null;
  /** Total number of rooms */
  roomAmount: number | null;
  images: KMImage[];
  videoPresentationUrl: string | null;
  housingCompany: KMHousingCompany | undefined;
  openHouses: KMOpenHouse[];
  landOwnership: KMLandOwnership;
  valueListing: boolean;
  location: KMLocation;
  /** URL path parts for constructing listing URL */
  urlParts: string[];
  /** Full canonical URL */
  canonicalUrl: string;
  canonicalPath: string;
  /** HTML-encoded area string */
  showArea: string;
}

export interface KMSearchResponse {
  success: boolean;
  data: {
    matches: number;
    minPrice: number;
    maxPrice: number;
    results: KMListing[];
  };
}

/**
 * A scrape target combining sale/rental modes.
 */
export interface KMScrapeTarget {
  rental: boolean;
  name: string;
}
