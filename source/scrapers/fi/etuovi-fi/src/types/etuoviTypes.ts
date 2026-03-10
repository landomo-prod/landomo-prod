/**
 * Etuovi.com / Oikotie API Types
 *
 * Etuovi.com is owned by Alma Media and shares its listing infrastructure
 * with asunnot.oikotie.fi. The underlying API is the Oikotie search API.
 *
 * Auth: Session cookies + OTA-token meta tag from page HTML.
 *
 * Card Types:
 *   100 = For-sale properties (apartments, row houses, detached houses)
 *   101 = Rental properties
 *   102 = Holiday/cottage properties for sale
 *   103 = Rental other
 *   104 = Land/plots for sale (myytavat-tontit)
 *   105 = Commercial properties
 *
 * Card Sub Types (building types) for cardType=100/101:
 *   1   = Kerrostalo (apartment block) → apartment
 *   2   = Rivitalo (row house) → house
 *   4   = Omakotitalo (detached house) → house
 *   8   = Paritalo (semi-detached) → house
 *   16  = Luhtitalo (loft house / corridor house) → apartment
 *   32  = Erillistalo (detached block) → house
 *   64  = Puutalo-osake (wooden apartment building share) → apartment
 *   256 = Other / Muu → apartment (default)
 */

export interface OikotieSessionAuth {
  /** Value from <meta name="api-token"> in page HTML */
  token: string;
  /** Value from <meta name="loaded"> in page HTML */
  loaded: string;
  /** Value from <meta name="cuid"> in page HTML */
  cuid: string;
  /** Session cookies (PHPSESSID, user_id, AWSALB, AWSALBCORS) */
  cookies: string;
}

export interface OikotieSearchResponse {
  found: number;
  start: number;
  cards: OikotieCard[];
  /** Present on error responses */
  code?: number;
  message?: string;
}

export interface OikotieCard {
  cardId: number;
  cardType: number;
  /** Building type bitmask - see enum above */
  cardSubType: number;
  url: string;
  status: number;
  data: OikotieCardData;
  location: OikotieCardLocation;
  meta: OikotieCardMeta;
  medias: OikotieMedia[];
  company: OikotieCompany | null;
  recommendationId: string | null;
}

export interface OikotieCardData {
  description: string | null;
  rooms: number | null;
  roomConfiguration: string | null;
  /** Price string, e.g. "297 000 €" */
  price: string | null;
  /** Area string, e.g. "83 m²" */
  size: string | null;
  buildYear: number | null;
  /** Lot size in m² */
  sizeLot: number | null;
  /** Living area in m² (numeric) */
  sizeMin: number | null;
  sizeMax: number | null;
  nextViewing: string | null;
  newDevelopment: boolean;
  isOnlineOffer: boolean;
  extraVisibility: boolean;
  visits: number;
  visitsWeekly: number;
  securityDeposit: number | null;
  /** Monthly maintenance fee in € */
  maintenanceFee: number | null;
  floor: number | null;
  buildingFloorCount: number | null;
  pricePerSqm: number | null;
  condition: string | null;
  sourceType: number;
}

export interface OikotieCardLocation {
  address: string;
  district: string | null;
  city: string;
  zipCode: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
}

export interface OikotieCardMeta {
  published: string;
  /** 1 = sale, 2 = rent */
  contractType: number;
  listingType: number;
  cardViewType: number;
  sellStatus: number;
  priceChanged: string | null;
  vendorAdId: string;
  vendorCompanyId: string;
  senderNode: string;
  publishedSort: string;
}

export interface OikotieMedia {
  imageSmallJPEG: string;
  imageLargeJPEG: string;
  imageDesktopWebP: string;
  imageDesktopWebPx2: string;
  imageTabletWebP: string;
  imageTabletWebPx2: string;
  imageMobileWebP: string;
  imageMobileWebPx2: string;
  imageMobileSmallWebP: string;
  imageMobileSmallWebPx2: string;
}

export interface OikotieCompany {
  companyId: number;
  companyName: string;
  companyBrandHighlightBackgroundColor: string | null;
  companyBrandHighlightFontColor: string | null;
  searchLogo: string | null;
  logo: string | null;
  realtorImage: string | null;
  realtorName: string | null;
}

/**
 * Card type constants
 */
export const CARD_TYPES = {
  SALE: 100,
  RENT: 101,
  HOLIDAY_SALE: 102,
  RENT_OTHER: 103,
  LAND_SALE: 104,
  COMMERCIAL: 105,
} as const;

/**
 * Building sub-type constants (cardSubType / buildingType)
 * Values can appear as bitmask combinations
 */
export const BUILDING_TYPES = {
  KERROSTALO: 1,       // Apartment block
  RIVITALO: 2,         // Row house
  OMAKOTITALO: 4,      // Detached house
  PARITALO: 8,         // Semi-detached
  LUHTITALO: 16,       // Corridor-access house (like apartment)
  ERILLISTALO: 32,     // Separate block of flats
  PUUTALO_OSAKE: 64,   // Wooden apartment building share
  OTHER: 256,          // Other
} as const;
