/**
 * Realingo.cz GraphQL API types
 * Verified against live API (2026-02-16)
 */

/**
 * Detail data returned by offer(id) query — NOT available in searchOffer list.
 * Fetched separately in Phase 2.5 using alias-batched GraphQL queries.
 */
export interface RealingoDetail {
  description?: string | null;
  externalUrl?: string | null;
  buildingType?: string | null;       // BRICK | PANEL | WOOD | PREFAB | STONE | MIXED | OTHER
  buildingStatus?: string | null;     // NEW | VERY_GOOD | GOOD | POOR | UNDER_CONSTRUCTION | ...
  buildingPosition?: string | null;   // DETACHED | SEMI_DETACHED | TERRACED | ...
  houseType?: string | null;          // FAMILY | VILLA | FARMHOUSE | BUNGALOW | ...
  ownership?: string | null;          // PRIVATE | COOPERATIVE | STATE | OTHER
  furniture?: string | null;          // FURNISHED | PARTIALLY_FURNISHED | UNFURNISHED
  floor?: number | null;              // floor number (not sqm)
  floorTotal?: number | null;         // total floors in building
  yearBuild?: number | null;
  yearReconstructed?: number | null;
  parking?: string | null;            // GARAGE | GARAGE_PLACE | OUTDOOR | ...
  parkingPlaces?: number | null;
  garages?: number | null;
  energyPerformance?: string | null;  // A | B_VERY_EFFICIENT | C | D | E | F | G
  energyPerformanceValue?: number | null;
  heating?: string | null;            // GAS | ELECTRIC | HEAT_PUMP | DISTRICT | SOLID | ...
  electricity?: string | null;
  waterSupply?: string | null;
  gas?: string | null;
  balcony?: boolean | null;
  loggia?: boolean | null;
  terrace?: boolean | null;
  lift?: boolean | null;
  cellar?: boolean | null;
  isBarrierFree?: boolean | null;
  isAuction?: boolean | null;
  roomCount?: number | null;
  flatCount?: number | null;
  flatClass?: string | null;
  availableFromDate?: string | null;
  ceilingHeight?: number | null;
  basin?: string | null;
  energyPerformanceLawRequirement?: string | null;
  floodActiveZone?: boolean | null;
  floodRisk?: string | null;
  floorUnderground?: number | null;
  garret?: boolean | null;
  gully?: string | null;
  telecommunication?: string | null;
  contact?: {
    type?: string;  // AGENCY | OWNER | ...
    person?: {
      id?: string;
      name?: string;
      phone?: string;
      photo?: string;
    };
    company?: {
      id?: string;
      name?: string;
      address?: string;
      phone?: string | null;
    };
  } | null;
}

export interface RealingoOffer {
  id: string;
  adId?: string;
  category?: string;
  url?: string;
  property?: 'FLAT' | 'HOUSE' | 'LAND' | 'COMMERCIAL' | 'OTHERS';
  purpose?: 'SELL' | 'RENT';
  location?: {
    address?: string;
    latitude?: number;
    longitude?: number;
  };
  price?: {
    total?: number | null;
    currency?: string;
    vat?: number | null;
  };
  area?: {
    main?: number | null;
    floor?: number | null;
    plot?: number | null;
    garden?: number | null;
    built?: number | null;
    cellar?: number | null;
    balcony?: number | null;
    terrace?: number | null;
    loggia?: number | null;
  };
  photos?: {
    main?: string;
    list?: string[];
  };
  updatedAt?: string;
  createdAt?: string;
  /** Populated in Phase 2.5 — detail fetch */
  detail?: RealingoDetail;
}

export interface RealingoSearchResponse {
  data: {
    searchOffer: {
      total: number;
      items: RealingoOffer[];
    };
  };
}

export interface RealingoSearchVariables {
  purpose?: 'SELL' | 'RENT';
  property?: 'FLAT' | 'HOUSE' | 'LAND' | 'COMMERCIAL' | 'OTHERS';
  saved?: boolean;
  categories?: string[];
  area?: {
    min?: number;
    max?: number;
  };
  plotArea?: {
    min?: number;
    max?: number;
  };
  price?: {
    min?: number;
    max?: number;
  };
  first?: number;
  skip?: number;
}

export interface RealingoLocationSuggestion {
  location: {
    name: string;
    type: string;
    url: string;
    id: string;
    center?: {
      type: string;
      coordinates: number[];
    };
  };
}

export interface RealingoLocationResponse {
  data: {
    suggestLocations: RealingoLocationSuggestion[];
  };
}
