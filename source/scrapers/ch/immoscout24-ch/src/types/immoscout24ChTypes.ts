/**
 * ImmoScout24.ch API Response Types
 * Based on reverse engineering the REST API at rest-api.immoscout24.ch/v4
 */

export interface ImmoScout24ChSearchResponse {
  from: number;
  size: number;
  total: number;
  properties: ImmoScout24ChSearchProperty[];
}

export interface ImmoScout24ChSearchProperty {
  id: number;
  accountId: number;
  propertyTypeId: number;
  offerTypeId: number;
  title: string;
  street?: string;
  zip?: string;
  cityName?: string;
  countryId?: number;
  cantonId?: number;
  districtId?: number;
  latitude?: number;
  longitude?: number;
  price?: number;
  priceFormatted?: string;
  priceUnit?: string;
  currency?: string;
  numberOfRooms?: number;
  surfaceLiving?: number;
  surfaceUsable?: number;
  surfaceProperty?: number;
  yearBuilt?: number;
  floor?: number;
  numberOfFloors?: number;
  images?: ImmoScout24ChImage[];
  lastModified?: string;
  isOnline?: boolean;
  isPremium?: boolean;
  isFeatured?: boolean;
}

export interface ImmoScout24ChImage {
  id?: number;
  url?: string;
  originalUrl?: string;
  description?: string;
}

export interface ImmoScout24ChDetailResponse {
  id: number;
  accountId: number;
  title: string;
  description?: string;
  propertyTypeId: number;
  offerTypeId: number;
  street?: string;
  zip?: string;
  cityName?: string;
  cantonId?: number;
  districtId?: number;
  latitude?: number;
  longitude?: number;
  price?: number;
  priceFormatted?: string;
  priceUnit?: string;
  currency?: string;
  numberOfRooms?: number;
  numberOfBathrooms?: number;
  surfaceLiving?: number;
  surfaceUsable?: number;
  surfaceProperty?: number;
  yearBuilt?: number;
  yearRenovated?: number;
  floor?: number;
  numberOfFloors?: number;
  condition?: string;
  heatingType?: string;
  images?: ImmoScout24ChImage[];
  characteristics?: ImmoScout24ChCharacteristics;
  contact?: ImmoScout24ChContact;
  agency?: ImmoScout24ChAgency;
  lastModified?: string;
  createdAt?: string;
  isOnline?: boolean;
  isPremium?: boolean;
  isFeatured?: boolean;
  // Additional detail fields
  balcony?: boolean;
  garden?: boolean;
  parking?: boolean;
  garage?: boolean;
  lift?: boolean;
  cellar?: boolean;
  minergie?: string; // Swiss energy standard
  energyLabel?: string;
  availableFrom?: string;
  monthlyCharges?: number; // Nebenkosten
  deposit?: number;
  [key: string]: any;
}

export interface ImmoScout24ChCharacteristics {
  hasBalcony?: boolean;
  hasGarden?: boolean;
  hasParking?: boolean;
  hasGarage?: boolean;
  hasLift?: boolean;
  hasCellar?: boolean;
  hasFireplace?: boolean;
  isWheelchairAccessible?: boolean;
  isFurnished?: boolean;
  hasAirConditioning?: boolean;
  [key: string]: any;
}

export interface ImmoScout24ChContact {
  name?: string;
  phone?: string;
  email?: string;
  company?: string;
}

export interface ImmoScout24ChAgency {
  id?: number;
  name?: string;
  logoUrl?: string;
  address?: string;
}

/**
 * Property type IDs used by ImmoScout24.ch
 * NOTE: These need verification against the actual API
 */
export const PROPERTY_TYPE_IDS: Record<string, number[]> = {
  apartment: [1, 2, 3, 4, 5],   // Wohnung, Studio, Attika, Loft, Maisonette
  house: [6, 7, 8, 9, 10],      // Einfamilienhaus, Reihenhaus, Doppelhaushälfte, Villa, Bauernhaus
  land: [14, 15],                // Bauland, Grundstück
  commercial: [11, 12, 13],     // Büro, Gewerbe, Gastro
};

/**
 * Offer type IDs
 */
export const OFFER_TYPE_IDS = {
  buy: 1,
  rent: 2,
} as const;
