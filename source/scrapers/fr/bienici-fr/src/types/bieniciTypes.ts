/**
 * Bienici.com raw listing data from JSON API
 */
export interface BieniciListingRaw {
  id: string;
  reference?: string;
  propertyType: string;
  adType: string;
  transactionType?: string;
  title?: string;
  description?: string;
  price: number;
  pricePerSquareMeter?: number;
  surfaceArea?: number;
  roomsQuantity?: number;
  bedroomsQuantity?: number;
  bathroomsQuantity?: number;
  city: string;
  postalCode?: string;
  district?: string;
  departmentCode?: string;
  latitude?: number;
  longitude?: number;
  photos?: Array<{ url: string; url_photo?: string }>;
  publicationDate?: string;
  modificationDate?: string;
  accountType?: string;
  agency?: {
    id?: string;
    name?: string;
    phone?: string;
  };
  newProperty?: boolean;
  floor?: number;
  floorQuantity?: number;
  hasElevator?: boolean;
  hasBalcony?: boolean;
  hasParking?: boolean;
  hasTerrace?: boolean;
  hasGarden?: boolean;
  hasPool?: boolean;
  hasCellar?: boolean;
  hasFireplace?: boolean;
  hasIntercom?: boolean;
  hasDoorCode?: boolean;
  hasCaretaker?: boolean;
  parkingQuantity?: number;
  energyClassification?: string;
  greenhouseGasClassification?: string;
  energyValue?: number;
  greenhouseGasValue?: number;
  heatingType?: string;
  isFurnished?: boolean;
  yearOfConstruction?: number;
  surfaceAreaLand?: number;
  /** Computed portal ID */
  portalId?: string;
}

/**
 * API response from bienici.com
 */
export interface BieniciApiResponse {
  realEstateAds: BieniciListingRaw[];
  total: number;
}

/**
 * Search configuration for department x transaction x property type (legacy)
 */
export interface BieniciSearchConfig {
  departmentCode: string;
  filterType: 'buy' | 'rent';
  propertyType: string;
  category: 'apartment' | 'house' | 'land' | 'commercial';
  label: string;
}

/**
 * French department
 */
export interface DepartmentConfig {
  code: string;
  name: string;
}

/**
 * Price band search configuration
 */
export interface PriceBandConfig {
  minPrice?: number;
  maxPrice?: number;
  filterType: 'buy' | 'rent';
  label: string;
}
