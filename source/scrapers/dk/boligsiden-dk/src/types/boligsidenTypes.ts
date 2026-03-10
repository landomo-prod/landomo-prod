/**
 * Boligsiden.dk API Types
 *
 * Based on the public REST API at https://api.boligsiden.dk/search/cases
 *
 * API Key facts:
 * - No authentication required (public API)
 * - Endpoint: GET /search/cases
 * - Parameters: pageSize, pageNumber, addressTypes (comma-separated)
 * - Returns: { cases: BoligsidenCase[], totalHits: number }
 *
 * Address types found in API:
 * - villa          → house
 * - condo          → apartment
 * - terraced house → house (townhouse)
 * - holiday house  → house (recreational)
 * - full year plot → land
 * - holiday plot   → land
 * - cattle farm    → house (farm)
 * - farm           → house
 * - hobby farm     → house
 */

export interface BoligsidenCoordinates {
  lat: number;
  lon: number;
  type: string;
}

export interface BoligsidenCity {
  name: string;
  slug: string;
}

export interface BoligsidenZip {
  name: string;
  slug: string;
  zipCode: number;
}

export interface BoligsidenRoad {
  municipalityCode: number;
  name: string;
  roadCode: number;
  roadID: string;
  slug: string;
}

export interface BoligsidenMunicipality {
  churchTaxPercentage: number;
  councilTaxPercentage: number;
  landValueTaxLevelPerThousand: number;
  municipalityCode: number;
  name: string;
  numberOfSchools: number;
  population: number;
  slug: string;
}

export interface BoligsidenProvince {
  name: string;
  provinceCode: string;
  regionCode: number;
  slug: string;
}

export interface BoligsidenPlace {
  bbox: number[];
  coordinates: BoligsidenCoordinates;
  id: number;
  name: string;
  slug: string;
}

export interface BoligsidenBuilding {
  bathroomCondition?: string;
  buildingName?: string;
  buildingNumber: string;
  externalWallMaterial?: string;
  heatingInstallation?: string;
  housingArea?: number;
  kitchenCondition?: string;
  numberOfBathrooms?: number;
  numberOfFloors?: number;
  numberOfRooms?: number;
  numberOfToilets?: number;
  roofingMaterial?: string;
  supplementaryHeating?: string;
  toiletCondition?: string;
  totalArea?: number;
  yearBuilt?: number;
  yearRenovated?: number;
}

export interface BoligsidenRegistration {
  amount: number;
  area: number;
  date: string;
  livingArea?: number;
  municipalityCode: number;
  perAreaPrice?: number;
  propertyNumber: number;
  registrationID: string;
  type: string;
}

export interface BoligsidenAddress {
  addressID: string;
  addressType: string;
  allowNewValuationInfo: boolean;
  bfeNumbers: number[];
  buildings: BoligsidenBuilding[];
  casePrice?: number;
  city: BoligsidenCity;
  cityName: string;
  coordinates: BoligsidenCoordinates;
  energyLabel?: string;
  entryAddressID: string;
  gstkvhx: string;
  hasMultipleCases: boolean;
  houseNumber: string;
  isOnMarket: boolean;
  isPublic: boolean;
  latestValuation?: number;
  livingArea?: number;
  municipality: BoligsidenMunicipality;
  place?: BoligsidenPlace;
  placeName?: string;
  propertyNumber: number;
  province: BoligsidenProvince;
  registrations: BoligsidenRegistration[];
  road: BoligsidenRoad;
  roadName: string;
  slug: string;
  slugAddress: string;
  weightedArea?: number;
  zip: BoligsidenZip;
  zipCode: number;
}

export interface BoligsidenImageSource {
  alt?: string;
  size?: string;
  url?: string;
}

export interface BoligsidenImage {
  imageSources: BoligsidenImageSource[];
}

export interface BoligsidenRealtor {
  name?: string;
  slug?: string;
}

export interface BoligsidenCase {
  _links: {
    self: { href: string };
  };
  address: BoligsidenAddress;
  addressType: string;
  caseID: string;
  caseUrl?: string;
  coordinates: BoligsidenCoordinates;
  daysListed?: { days: number };
  daysOnMarket?: number;
  defaultImage?: BoligsidenImage;
  descriptionBody?: string;
  descriptionTitle?: string;
  distinction?: string;
  energyLabel?: string;
  hasBalcony?: boolean;
  hasElevator?: boolean;
  hasTerrace?: boolean;
  highlighted?: boolean;
  housingArea?: number;
  images?: BoligsidenImage[];
  lotArea?: number;
  monthlyExpense?: number;
  numberOfBathrooms?: number;
  numberOfFloors?: number;
  numberOfRooms?: number;
  numberOfToilets?: number;
  perAreaPrice?: number;
  priceCash?: number;
  priceChangePercentage?: number;
  providerCaseID?: string;
  realEstate?: string;
  realtor?: BoligsidenRealtor;
  slug: string;
  slugAddress?: string;
  status?: string;
  timeOnMarket?: string;
  utilitiesConnectionFee?: number;
  weightedArea?: number;
  yearBuilt?: number;
}

export interface BoligsidenSearchResponse {
  _links: {
    self: { href: string };
  };
  cases: BoligsidenCase[];
  totalHits: number;
}

/**
 * Boligsiden address types and their category mappings
 */
export const ADDRESS_TYPE_CATEGORIES: Record<string, string> = {
  'villa': 'house',
  'condo': 'apartment',
  'terraced house': 'house',
  'holiday house': 'house',
  'full year plot': 'land',
  'holiday plot': 'land',
  'cattle farm': 'house',
  'farm': 'house',
  'hobby farm': 'house',
};

/**
 * All scrape-able address types grouped by property category
 */
export const ADDRESS_TYPES_BY_CATEGORY = {
  apartment: ['condo'],
  house: ['villa', 'terraced house', 'holiday house', 'cattle farm', 'farm', 'hobby farm'],
  land: ['full year plot', 'holiday plot'],
  commercial: [] as string[], // Boligsiden doesn't surface commercial listings in this API
};

/**
 * All address types to scrape
 */
export const ALL_ADDRESS_TYPES = [
  'villa',
  'condo',
  'terraced house',
  'holiday house',
  'full year plot',
  'holiday plot',
  'cattle farm',
  'farm',
  'hobby farm',
];
