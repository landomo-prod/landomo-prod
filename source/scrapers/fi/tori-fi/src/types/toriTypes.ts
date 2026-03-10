/**
 * Raw types from the Oikotie API (asunnot.oikotie.fi)
 *
 * Tori.fi redirects all real estate to Oikotie (Schibsted's dedicated Finnish
 * real estate portal). The API lives at asunnot.oikotie.fi/api/search and
 * requires three meta-tag-derived headers: OTA-token, OTA-loaded, OTA-cuid.
 *
 * cardType values:
 *   100 = residential for sale  (~54k listings)
 *   101 = residential for rent  (~29k listings)
 *   105 = commercial for sale   (~2.7k listings)
 *   106 = commercial for rent   (~41k listings)
 *
 * cardSubType values (residential):
 *   1  = apartment / kerrostalo
 *   2  = rowhouse / rivitalo / paritalo
 *   4  = detached house / omakotitalo
 *   64 = semi-detached / paritalo (own title)
 *
 * Authentication flow:
 *   1. GET https://asunnot.oikotie.fi/myytavat-asunnot  (HTML page)
 *   2. Parse meta[name="api-token"], meta[name="loaded"], meta[name="cuid"]
 *   3. Pass these as OTA-token / OTA-loaded / OTA-cuid request headers
 */

export interface OikotieApiResponse {
  found: number;
  start: number;
  cards: OikotieCard[];
}

export interface OikotieCard {
  cardId: number;
  cardType: number;
  cardSubType: number;
  url: string;
  status: number;
  data: OikotieCardData;
  location: OikotieLocation;
  meta: OikotieCardMeta;
  medias: OikotieMedia[];
}

export interface OikotieCardData {
  description: string | null;
  rooms: number | null;
  roomConfiguration: string | null;
  /** Raw price string, e.g. "198 000 €" or "872 € / kk" */
  price: string | null;
  /** Size string, e.g. "125/162 m²" or "38 m²" */
  size: string | null;
  buildYear: number | null;
  /** Lot size in m² (for houses/land) */
  sizeLot: number | null;
  /** Living area in m² */
  sizeMin: number | null;
  sizeMax: number | null;
  nextViewing: OikotieViewing | null;
  newDevelopment: boolean;
  isOnlineOffer: boolean;
  extraVisibility: boolean;
  visits: number;
  visitsWeekly: number;
  securityDeposit: number | null;
  /** Monthly maintenance fee (vastike) in EUR */
  maintenanceFee: number | null;
  floor: number | null;
  buildingFloorCount: number | null;
  pricePerSqm: number | null;
  condition: string | null;
  sourceType: number;
}

export interface OikotieViewing {
  date: string;
  start: string;
  end: string;
  live: boolean;
  first: boolean;
}

export interface OikotieLocation {
  address: string;
  district: string;
  city: string;
  zipCode: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
}

export interface OikotieCardMeta {
  published: string;
  contractType: number;
  listingType: number;
  cardViewType: number;
  sellStatus: number | null;
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

export interface OikotieAuthHeaders {
  'OTA-token': string;
  'OTA-loaded': string;
  'OTA-cuid': string;
}

/** cardType → description mapping */
export const CARD_TYPE_LABELS: Record<number, string> = {
  100: 'residential-sale',
  101: 'residential-rent',
  103: 'holiday-rent',
  105: 'commercial-sale',
  106: 'commercial-rent',
};

/** cardSubType → property category */
export const CARD_SUBTYPE_CATEGORY: Record<number, 'apartment' | 'house' | 'land'> = {
  1: 'apartment',   // kerrostalo
  2: 'house',       // rivitalo
  4: 'house',       // omakotitalo
  64: 'house',      // paritalo (own title)
};
