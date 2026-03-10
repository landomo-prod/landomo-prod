/**
 * Oikotie.fi API Type Definitions
 *
 * Based on API investigation of asunnot.oikotie.fi:
 * - Endpoint: GET /api/search?cardType={n}&limit={n}&offset={n}&sortBy=published_sort_desc
 * - Auth: OTA-token, OTA-loaded, OTA-cuid headers (scraped from HTML meta tags)
 *
 * Card Types:
 *   100 = myytavat-asunnot (for sale - all residential)
 *   101 = vuokra-asunnot (rental - all residential)
 *   102 = tontit (land/plots)
 *   103 = liiketilat (commercial spaces)
 *   104 = loma-asunnot (vacation properties)
 *
 * cardSubType within cardType 100/101:
 *   1   = Kerrostalo (apartment block)
 *   2   = Rivitalo (row house)
 *   4   = Omakotitalo (detached house)
 *   32  = Multi-floor/villa
 *   64  = Paritalo (semi-detached house)
 *   256 = Other house type
 *
 * listingType in meta:
 *   1 = Freehold (omistusasunto)
 *   3 = Housing company share (asunto-osake / kerrostalo)
 *   4 = Rental
 */

export interface OikotieSearchResponse {
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
  meta: OikotieMeta;
  medias: OikotieMedia[];
  company: OikotieCompany | null;
  recommendationId: string | null;
}

export interface OikotieCardData {
  description: string | null;
  rooms: number | null;
  roomConfiguration: string | null;
  price: string | null;
  size: string | null;
  buildYear: number | null;
  sizeLot: number | null;
  sizeMin: number | null;
  sizeMax: number | null;
  nextViewing: OikotieViewing | null;
  newDevelopment: boolean;
  isOnlineOffer: boolean;
  extraVisibility: boolean;
  visits: number;
  visitsWeekly: number;
  securityDeposit: string | null;
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
  district: string | null;
  city: string;
  zipCode: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
}

export interface OikotieMeta {
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
  imageMobileSmallWebP?: string;
  imageMobileSmallWebPx2?: string;
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

/** Token headers fetched from HTML meta tags */
export interface OikotieAuthTokens {
  'OTA-token': string;
  'OTA-loaded': string;
  'OTA-cuid': string;
}

/** Search configuration for one scrape combination */
export interface OikotieScrapeTarget {
  cardType: number;
  name: string;
  category: 'apartment' | 'house' | 'land' | 'commercial';
}
