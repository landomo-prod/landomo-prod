/**
 * Vuokraovi.com API Types
 *
 * Vuokraovi.com is owned by Alma Media and is Finland's largest dedicated
 * rental portal (~500k monthly visitors). It shares backend infrastructure
 * with etuovi.com (via the "Valtti" platform).
 *
 * API Base URL: https://api.vuokraovi.com/distant/swordsman/v3
 * Auth: No authentication required. X-PORTAL-IDENTIFIER: VUOKRAOVI header only.
 *
 * Property Types:
 *   propertyType: "RESIDENTIAL" | "OTHER"
 *
 * Residential Property Subtypes (propertySubtype):
 *   APARTMENT_HOUSE  → apartment  (Kerrostalo / apartment block)
 *   ROW_HOUSE        → house      (Rivitalo / row house)
 *   SEMI_DETACHED    → house      (Paritalo / semi-detached)
 *   DETACHED_HOUSE   → house      (Omakotitalo / detached house)
 *   LOFT_HOUSE       → apartment  (Luhtitalo / corridor-access house)
 *   WOODEN_HOUSE     → apartment  (Puutalo-osake / wooden apartment share)
 *   OTHER            → apartment  (default fallback)
 *
 * Room counts (roomCount):
 *   ONE_ROOM, TWO_ROOMS, THREE_ROOMS, FOUR_ROOMS, FIVE_ROOMS, FIVE_ROOMS_OR_MORE
 *
 * Rental availability types (rentalAvailability.type):
 *   IMMEDIATELY     → available now
 *   VACANCY         → available from vacancyDate
 *   BY_AGREEMENT    → available by agreement
 *
 * Lessor types (lessorType):
 *   ALL, PRIVATE, COMPANY
 */

export interface VuokrauviSearchRequest {
  locationSearchCriteria: VuokrauviLocationCriteria;
  lessorType: 'ALL' | 'PRIVATE' | 'COMPANY';
  publishingTimeSearchCriteria: 'ANY_DAY' | 'LAST_24H' | 'LAST_48H' | 'LAST_7_DAYS' | 'LAST_MONTH';
  officeIds: null;
  rentMin: number | null;
  rentMax: number | null;
  checkIfHasImages: boolean | null;
  checkIfHasPanorama: boolean | null;
  checkIfHasVideo: boolean | null;
  checkIfHasShowingWithinSevenDays: boolean | null;
  pagination: VuokrauviPagination;
  propertyType: 'RESIDENTIAL' | 'OTHER';
  freeTextSearch: string;
  residentialPropertyTypes: VuokrauviPropertySubtype[];
  roomCounts: VuokrauviRoomCount[] | null;
  sizeMin: number | null;
  sizeMax: number | null;
  yearMin: number | null;
  yearMax: number | null;
  overallConditions: string[] | null;
  kitchenTypes: string[] | null;
  livingFormTypes: string[] | null;
  rentalAgreements: string[] | null;
  rentalAvailabilities: string[] | null;
  rightOfOccupancy?: 'ALL' | 'ONLY' | 'EXCLUDED';
  newBuildingSearchCriteria?: 'ALL_PROPERTIES' | 'ONLY_NEW_BUILDINGS' | 'NO_NEW_BUILDINGS';
}

export interface VuokrauviLocationCriteria {
  classifiedLocationTerms?: VuokrauviLocationTerm[];
  unclassifiedLocationTerms?: string[];
}

export interface VuokrauviLocationTerm {
  code: string;
  type: string;
  name?: string;
}

export interface VuokrauviPagination {
  sortingOrder: {
    property: 'PUBLISHED_OR_UPDATED_AT' | 'RENT_ASC' | 'RENT_DESC' | 'SIZE_ASC' | 'SIZE_DESC';
    direction: 'ASC' | 'DESC';
  };
  firstResult: number;
  maxResults: number;
  page: number;
}

export type VuokrauviPropertySubtype =
  | 'APARTMENT_HOUSE'
  | 'ROW_HOUSE'
  | 'SEMI_DETACHED'
  | 'DETACHED_HOUSE'
  | 'LOFT_HOUSE'
  | 'WOODEN_HOUSE'
  | 'OTHER';

export type VuokrauviRoomCount =
  | 'ONE_ROOM'
  | 'TWO_ROOMS'
  | 'THREE_ROOMS'
  | 'FOUR_ROOMS'
  | 'FIVE_ROOMS'
  | 'FIVE_ROOMS_OR_MORE';

export interface VuokrauviSearchResponse {
  countOfAllResults: number;
  announcements: VuokrauviAnnouncement[];
}

export interface VuokrauviAnnouncement {
  /** Internal numeric ID */
  id: number;
  /** Human-readable ID used in listing URLs, e.g. "ef2262" or "55922818" */
  friendlyId: string;
  propertyType: 'RESIDENTIAL' | 'OTHER';
  /** Monthly rent in EUR */
  searchRent: number;
  notifyRentChanged: boolean;
  rentalAvailability: VuokrauviRentalAvailability;
  /** Street address, e.g. "Äijälätie 25" */
  addressLine1: string;
  /** District + city, e.g. "Väinölä Jyväskylä" */
  addressLine2: string;
  /** Full location string */
  location: string;
  latitude: number;
  longitude: number;
  constructionFinishedYear: number | null;
  published: boolean;
  publishingTime: string;
  publishedOrUpdatedAt: string;
  nextShowings: VuokrauviShowing[];
  /** CloudFront image URL template. Replace {imageParameters} with e.g. "w_400,h_300,c_fill" */
  mainImageUri: string | null;
  mainImageHidden: boolean;
  office: VuokrauviOffice | null;
  newBuilding: boolean;
  /** Room structure string e.g. "2H + K + S", "1h, tupak, kph" */
  roomStructure: string | null;
  roomCount: VuokrauviRoomCount | null;
  /** Living area in m² */
  area: number | null;
  /** Total area in m² (may differ from area for houses) */
  totalArea: number | null;
  topOfListActivatedInLast2Weeks: boolean;
  hasAlmaPremiumVisibility: boolean;
  isCompanyAnnouncement: boolean;
  propertySubtype: VuokrauviPropertySubtype;
  rightOfOccupancy: boolean;
}

export interface VuokrauviRentalAvailability {
  type: 'IMMEDIATELY' | 'VACANCY' | 'BY_AGREEMENT';
  /** ISO date string, present when type is 'VACANCY' */
  vacancyDate?: string;
}

export interface VuokrauviShowing {
  startTime: string;
  endTime: string;
}

export interface VuokrauviOffice {
  id: number;
  name: string;
  logoUri?: string;
  webPageUrl?: string;
  customerGroupId?: number;
  officeNumber?: number;
}

export interface VuokrauviCountResponse {
  count: {
    OTHER?: number;
    RESIDENTIAL?: number;
  };
}

/** Apartment subtypes - mapped to property_category: 'apartment' */
export const APARTMENT_SUBTYPES: VuokrauviPropertySubtype[] = [
  'APARTMENT_HOUSE',
  'LOFT_HOUSE',
  'WOODEN_HOUSE',
  'OTHER',
];

/** House subtypes - mapped to property_category: 'house' */
export const HOUSE_SUBTYPES: VuokrauviPropertySubtype[] = [
  'ROW_HOUSE',
  'SEMI_DETACHED',
  'DETACHED_HOUSE',
];

/** Map roomCount enum to numeric bedroom count (rooms - 1 for kitchen) */
export const ROOM_COUNT_MAP: Record<VuokrauviRoomCount, number> = {
  ONE_ROOM: 0,         // 1 room = studio / 0 bedrooms
  TWO_ROOMS: 1,        // 2 rooms = 1 bedroom + kitchen
  THREE_ROOMS: 2,      // 3 rooms = 2 bedrooms + kitchen
  FOUR_ROOMS: 3,       // 4 rooms = 3 bedrooms + kitchen
  FIVE_ROOMS: 4,       // 5 rooms = 4 bedrooms + kitchen
  FIVE_ROOMS_OR_MORE: 5, // 5+ rooms = 5+ bedrooms
};
