// EDC.dk API types based on /api/v1/cases/quick-search response

export interface EdcMeasurement {
  value: number;
  minValue?: number;
  maxValue?: number;
  unitCode: string;
  unitText: string;
  description: string;
}

export interface EdcGeoCoordinates {
  latitude: number;
  longitude: number;
}

export interface EdcImage {
  src: string;
  height: number;
  width: number;
}

/**
 * A single listing item from the EDC quick-search API.
 * Endpoint: GET /api/v1/cases/quick-search
 * Headers: x-division: private (sale) | x-division: Rent (rental)
 */
export interface EdcListingRaw {
  id: number;
  caseGuid: string;
  caseNumber: string;
  caseTypeGroup: string;           // 'Private' | 'Business'
  caseClassification: string;      // 'Sale' | 'Rent'
  tradeClassification: string;     // 'None' | ...
  estateType: string;              // GUID
  estateTypeName: string;          // Danish property type name
  source: string;
  sourceModel: string;
  agencyGuid: string;
  address: string;
  isSold: boolean;
  isRented: boolean;
  zipCode: string;
  city: string;
  statusChangeDate: string;
  isAdvertised: boolean;
  isEdcCase: boolean;
  caseStatus: string;              // 'New' | 'ChangedPrice' | ...
  rooms?: EdcMeasurement;          // number of rooms
  livingArea?: EdcMeasurement;     // m²
  price?: EdcMeasurement;          // DKK (sale price)
  areaLand?: EdcMeasurement;       // plot area m²
  areaFloor?: EdcMeasurement;      // basement/floor area m²
  rent?: EdcMeasurement;           // DKK/month (rental)
  rentYear?: EdcMeasurement;       // DKK/year
  yearBuild?: number;
  cashPriceChange?: EdcMeasurement;
  vignetCustomText?: string;
  isNewCase: boolean;
  hasNewPrice: boolean;
  imagePath?: string;
  dateOpenHouse?: string;
  dateOpenHouseEnd?: string;
  openHouseActivitySubscription?: boolean;
  openHouseActivityId?: string;
  geoCoordinates?: EdcGeoCoordinates;
  isContractSigned: boolean;
  businessReturnPercentage?: EdcMeasurement;
  urlPath?: string;
  images?: EdcImage[];
  viewCount?: number;
  viewCountType?: string;
  showViewCount?: boolean;
  canBeFollowed?: boolean;
  projectId?: number;
  projectTitle?: string;
  activeProjectCases?: number;
  totalProjectCases?: number;
  isProject?: boolean;
}

export interface EdcSearchResponse {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  realResultCount: number;
  resultCount: number;
  itemsPerPage: number;
  items: EdcListingRaw[];
}

/**
 * Division modes for EDC API
 * - 'private' = residential properties for sale (default)
 * - 'Rent'    = residential rental properties
 * - 'erhverv' = commercial properties (x-division: erhverv)
 */
export type EdcDivision = 'private' | 'Rent' | 'erhverv';

export type EdcPropertyCategory = 'apartment' | 'house' | 'land' | 'commercial';

/**
 * Estate type name → property category mapping.
 * Keys are Danish estate type names from the API.
 */
export const ESTATE_TYPE_CATEGORY_MAP: Record<string, EdcPropertyCategory> = {
  // Apartments
  'Ejerlejlighed': 'apartment',
  'Andelsbolig': 'apartment',
  'Lejlighed': 'apartment',
  'Villalejlighed': 'apartment',
  // Houses
  'Villa': 'house',
  'Rækkehus': 'house',
  'Liebhaveri': 'house',
  'Landejendom': 'house',
  'Sommerhus': 'house',
  'Helårsgrund': 'land',
  // Land
  'Grund': 'land',
  'Sommerhusgrund': 'land',
  // Commercial
  'Erhverv': 'commercial',
  'Butik': 'commercial',
  'Kontor': 'commercial',
  'Lager/Produktion': 'commercial',
  'Hotel/Restaurant': 'commercial',
};
