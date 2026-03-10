/**
 * Krogsveen.no GraphQL API Types
 *
 * Endpoint: POST https://www.krogsveen.no/bsr-api (GraphQL)
 *
 * Query: estatesSearch(args: SearchEstateInput) → SearchEstateResponse
 *   - hits: SearchEstateObject[]  (contains the estate data)
 *   - total: Int
 *
 * Each SearchEstateObject has an `estate: RealEstate` field with full listing data.
 *
 * bsrPropertyType values (used for category routing):
 *   "leilighet"         → apartment
 *   "rekkehus"          → house
 *   "tomannsbolig"      → house
 *   "enebolig"          → house
 *   "hytter/fritid"     → house (cabin)
 *   "gårdsbruk/småbruk" → house (farm)
 *   "annet"             → house (fallback)
 *   "tomt"              → land
 *
 * CommissionStateEnum: ACTIVE | SOLD | UPCOMING
 * CommissionTypeEnum:  RESIDENTIAL_FOR_SALE | PROJECT_FOR_SALE | COMMERCIAL_FOR_SALE |
 *                      RESIDENTIAL_FOR_RENT | UNKNOWN
 */

export interface KrogsveenEstate {
  id: string;
  projectId: string | null;
  nextEstateId: string | null;

  // Address
  vadr: string | null;       // Street address
  zip: string | null;        // Postal code
  city: string | null;       // City name
  localAreaName: string | null;

  // Location
  lat: number | null;
  lon: number | null;

  // Area fields (Norwegian BRA standard)
  bra: number | null;        // Bruksareal total (total usable area)
  braI: number | null;       // BRA-i (indoor usable area)
  braE: number | null;       // BRA-e (external usable area)
  braB: number | null;       // BRA-b (below-grade usable area)
  braS: number | null;       // BRA-s (shared usable area)
  tba: number | null;        // Tilleggsdel boenhet
  bta: number | null;        // Bruttoareal
  boa: number | null;        // Boareal (older measure)
  brua: number | null;       // Bruksareal (older measure)
  areaSize: number | null;   // General area
  parea: number | null;      // Primary room area (P-ROM)
  plotSize: number | null;   // Plot/land size (tomtestørrelse)
  landarea: number | null;   // Land area

  // Property details
  bedrooms: number | null;
  rooms: number | null;      // Total number of rooms
  floors: number | null;
  built: number | null;      // Year built
  typeName: string | null;   // Verbose type name e.g. "Enebolig - Frittliggende"
  bsrPropertyType: string;   // Normalised type e.g. "enebolig", "leilighet"
  ownershipType: string | null;  // e.g. "Selveiet", "Andel", "Aksje"
  ownershipName: string | null;
  commissionType: string | null;
  commissionState: string | null;

  // Headline / title
  head: string | null;

  // Pricing
  price: number | null;       // Asking price (prisantydning)
  totalPrice: number | null;  // Total price incl. shared debt (totalpris)
  soldPrice: number | null;   // Sold price (if sold)

  // Dates
  publishedAt: string | null;   // ISO datetime
  soldAt: string | null;        // ISO datetime
  upcomingFrom: string | null;  // ISO datetime

  // Amenities (Boolean flags — may be null if unknown)
  lift: boolean | null;      // Elevator (heis)
  garage: boolean | null;    // Garage
  veranda: boolean | null;   // Veranda/balcony/terrace

  // Facilities (array of integer codes — portal-internal)
  facilities: number[] | null;

  // Status
  status: 'ACTIVE' | 'SOLD' | 'UPCOMING' | string;

  // Broker info
  broker: KrogsveenBroker | null;
  coBroker: KrogsveenBroker | null;

  // Internal
  radius: number;
  projectAggregation?: KrogsveenProjectAggregation | null;
}

export interface KrogsveenBroker {
  id: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  department: KrogsveenDepartment | null;
}

export interface KrogsveenDepartment {
  id: string | null;
  name: string | null;
}

export interface KrogsveenProjectAggregation {
  projectId: string;
  minPrice: number | null;
  maxPrice: number | null;
  minArea: number | null;
  maxArea: number | null;
  minBedrooms: number | null;
  maxBedrooms: number | null;
}

export interface KrogsveenSearchHit {
  id: string;
  status: string;
  lat: number | null;
  lng: number | null;
  price: number | null;
  area: number | null;
  score: number | null;
  projectId: string | null;
  estate: KrogsveenEstate;
  projectAggregation: KrogsveenProjectAggregation | null;
}

export interface KrogsveenSearchResponse {
  data: {
    estatesSearch: {
      total: number;
      hits: KrogsveenSearchHit[];
    };
  };
  errors?: Array<{ message: string; extensions?: any }>;
}

// The full GraphQL query fields we request
export const ESTATE_FRAGMENT = `
  id
  projectId
  nextEstateId
  vadr
  zip
  city
  localAreaName
  lat
  lon
  bra
  braI
  braE
  braB
  braS
  tba
  bta
  boa
  brua
  areaSize
  parea
  plotSize
  landarea
  bedrooms
  rooms
  floors
  built
  typeName
  bsrPropertyType
  ownershipType
  ownershipName
  commissionType
  commissionState
  head
  price
  totalPrice
  soldPrice
  publishedAt
  soldAt
  upcomingFrom
  lift
  garage
  veranda
  facilities
  status
  broker {
    id
    name
    email
    phone
    department { id name }
  }
`;

export const ESTATES_SEARCH_QUERY = `
  query KrogsveenSearch($commissionStates: [CommissionStateEnum], $commissionTypes: [CommissionTypeEnum]) {
    estatesSearch(args: {
      commissionStates: $commissionStates
      commissionTypes: $commissionTypes
    }) {
      total
      hits {
        id
        status
        lat
        lng
        price
        area
        score
        projectId
        estate {
          ${ESTATE_FRAGMENT}
        }
      }
    }
  }
`;
