/**
 * Raw API response types from nybolig.dk /api/search/cases/find
 *
 * API: POST https://www.nybolig.dk/api/search/cases/find
 * Body: { siteName: 'nybolig', top: number, scrollToken: string, isRental?: boolean, propertyTypes?: string[] }
 * Response: { results: number, total: number, scrollToken: string, cases: NyboligCase[] }
 */

export interface NyboligSearchRequest {
  siteName: 'nybolig';
  top: number;
  scrollToken: string;
  isRental?: boolean;
  propertyTypes?: string[];
}

export interface NyboligSearchResponse {
  results: number;
  total: number;
  scrollToken: string;
  cases: NyboligCase[];
}

export interface NyboligCase {
  id: string;
  siteName: string;
  caseNumber: string;

  // Address
  addressDisplayName: string;
  addressFirstLine: string;
  addressSecondLine: string;
  addressLongitude: number;
  addressLatitude: number;
  addressWktPoint: string;
  addressCity: string;

  streetAddress: string;
  houseNumber: string;
  floorSide: string;
  floor: number;

  // URL and media
  url: string;
  imageUrl: string;
  imageAlt: string;
  primaryImages: string[];

  // Status flags
  isSharedAgriculturalCase: boolean;
  hasBeenSold: boolean;
  isSaleInProgress: boolean;
  isRental: boolean;
  isPortfolioCase: boolean;
  isNew: boolean;
  hasNewPrice: boolean;
  showOffersLabel: boolean;
  isActive: boolean;
  projectCaseReserved: boolean;

  // Labels
  generalLabelText: string;
  openHouseText: string;
  openHouseIntro: string;
  newLabelEventEnd: string;
  newPriceLabelEventEnd: string;

  // Property details
  type: string;
  totalNumberOfRooms: number;
  propertySize: number;      // total property size in m² (bbl)
  plotSizeHa: number;        // plot size in hectares
  livingSpace: number;       // living space in m²
  farmbuildingsSize: number; // farm building size in m²
  basementSize: number;      // basement in m²
  energyClassification: string;

  // Price
  cashPrice: number;
  price: string;
  rent: number;
  rentMonthly: string;
}

/**
 * Nybolig property type codes from the search filter config
 * Source: extracted from page HTML of /soegeresultat-boliger
 */
export const NYBOLIG_PROPERTY_TYPES = {
  Villa: 'Villa',
  TerracedHouse: 'TerracedHouse',      // Rækkehus
  Condo: 'Condo',                       // Ejerlejlighed
  VacationHousing: 'VacationHousing',  // Fritidsbolig (Sommerhus/Fritidshus)
  HousingCooperative: 'HousingCooperative', // Andelsbolig
  VillaApartment: 'VillaApartment',    // Villalejlighed
  FarmHouse: 'FarmHouse',              // Landejendom
  AllYearRoundPlot: 'AllYearRoundPlot', // Helårsgrund
  VacationPlot: 'VacationPlot',        // Fritidsgrund
} as const;

export type NyboligPropertyType = typeof NYBOLIG_PROPERTY_TYPES[keyof typeof NYBOLIG_PROPERTY_TYPES];

/** Maps nybolig type -> Landomo category */
export type LandomoCategory = 'apartment' | 'house' | 'land' | 'commercial';

export const TYPE_TO_CATEGORY: Record<string, LandomoCategory> = {
  // Apartments
  'Condo': 'apartment',
  'Ejerlejlighed': 'apartment',
  'HousingCooperative': 'apartment',
  'Andelsbolig': 'apartment',
  'VillaApartment': 'apartment',
  'Villalejlighed': 'apartment',
  'Lejlighed': 'apartment',

  // Houses
  'Villa': 'house',
  'TerracedHouse': 'house',
  'Rækkehus': 'house',
  'VacationHousing': 'house',
  'Fritidshus': 'house',
  'Sommerhus': 'house',
  'FarmHouse': 'house',
  'Landejendom': 'house',
  'Liebhaveri': 'house',

  // Land
  'AllYearRoundPlot': 'land',
  'Helårsgrund': 'land',
  'VacationPlot': 'land',
  'Fritidsgrund': 'land',
  'Grund': 'land',

  // Commercial
  'Erhverv': 'commercial',
};
