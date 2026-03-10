/**
 * danbolig.dk API types
 *
 * API: POST https://danbolig.dk/api/v1/properties/list
 * Body: { filters: DanboligFilter[], orderBy: string, page: number }
 * Returns: DanboligListResponse
 *
 * The list API returns 30 properties per page.
 * Fields come from factsDesktop array with name/value pairs.
 *
 * Danish property types:
 *   Lejlighed        → apartment
 *   Andelsbolig      → apartment (cooperative ownership)
 *   Villa            → house
 *   Rækkehus         → house (terraced house)
 *   Fritidsbolig     → house (holiday/summer house)
 *   Liebhaveri       → house (luxury/premium)
 *   Landejendom      → house (rural property)
 *   Villa / Fritidsbolig   → house
 *   Villa / Helårsgrund    → house
 *   Helårsgrund      → land
 *   Sommerhusgrund   → land (holiday plot)
 *   Erhverv          → commercial
 */

export interface DanboligFilter {
  key: string;
  value: string;
}

export interface DanboligFactItem {
  label: string;
  name: string;   // e.g. "Price", "LivingAreaM2", "Rooms", "EnergyLabel", "MonthlyPayment"
  value: string;
}

export interface DanboligPropertyRaw {
  address: string;
  addressId: string | null;
  city: string;
  factsDesktop: DanboligFactItem[];
  factsMobile: DanboligFactItem[];
  images: string[];
  isDanbolig: boolean;
  isNew: boolean;
  hasNewPrice: boolean;
  isSold: boolean;
  isUnderSale: boolean;
  soldDate: string | null;
  openHouse: string | null;
  openHouseShort: string | null;
  openHouseSignupRequired: boolean;
  price: number;
  propertyId: string;
  brokerId: string;
  propertySize: number;   // living area sqm
  type: string;           // Danish property type string
  url: string;            // relative URL e.g. /bolig/koebenhavn/2200/lejlighed/0870001262-087/
  zipCode: number;
  fallbackImageUrl: string;
  spotText: string | null;
  luxurious: boolean;
  displayAddToFavorites: boolean;
}

export interface DanboligResponseItem {
  responseType: 'property' | 'ad' | string;
  data: DanboligPropertyRaw;
}

export interface DanboligListResponse {
  fallbackImage: string;
  totalCount: number;
  url: string | null;
  redirect: boolean;
  data: DanboligResponseItem[];
}

export interface DanboligListRequest {
  filters: DanboligFilter[];
  orderBy: 'relevant' | 'price_asc' | 'price_desc' | 'date_desc';
  page: number;
}

/**
 * Parsed facts extracted from factsDesktop array
 */
export interface DanboligParsedFacts {
  price?: number;
  livingAreaM2?: number;
  rooms?: number;
  energyLabel?: string;
  monthlyPayment?: number;
}
