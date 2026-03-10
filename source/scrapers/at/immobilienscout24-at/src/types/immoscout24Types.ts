/**
 * ImmoScout24 Austria API Response Types
 * Based on reverse engineering of Android app v5.0
 * Discovered via APK decompilation - February 7, 2026
 */

/**
 * Search response from /api/psa/is24/properties/search
 */
export interface ImmoScout24SearchResponse {
  items: ImmoScout24Property[];
  pageNumber?: number;
  pageSize?: number;
  numberOfHits?: number;
  maxItems?: number;
  _links?: any;
}

/**
 * Property expose object (listing)
 */
export interface ImmoScout24Property {
  id: string; // exposeId
  objectData?: PropertyObjectData;
  advertisementData?: AdvertisementData;
  contactData?: ContactData;

  // Additional metadata
  creationDate?: string;
  lastModificationDate?: string;
  publishedDate?: string;

  // Legacy fields (might be present)
  [key: string]: any;
}

/**
 * Core property data
 */
export interface PropertyObjectData {
  description?: string;
  title?: string;

  // Price information
  priceInformation?: {
    price?: number;
    priceType?: string; // "PURCHASE_PRICE", "RENT_PER_MONTH"
    currency?: string; // "EUR"
    priceIntervalType?: string;

    // Additional costs
    additionalCosts?: number;
    heatingCosts?: number;
    operatingCosts?: number;
    deposit?: number;

    // Price history
    originalPrice?: number;
    priceReduction?: boolean;
  };

  // Location data
  localization?: {
    address?: string;
    street?: string;
    houseNumber?: string;
    postalCode?: string;
    city?: string;
    district?: string;
    region?: string;
    country?: string;

    // Coordinates
    latitude?: number;
    longitude?: number;

    // Location quality
    preciseLocation?: boolean;
  };

  // Area information
  area?: {
    livingArea?: number; // Square meters
    usableArea?: number;
    plotArea?: number;

    // Room counts
    numberOfRooms?: number;
    numberOfBedrooms?: number;
    numberOfBathrooms?: number;

    // Floor information
    floor?: number;
    totalFloors?: number;
  };

  // Property characteristics
  characteristics?: {
    propertyType?: string; // "APARTMENT", "HOUSE", "LAND"
    propertySubType?: string;
    transactionType?: string; // "SALE", "RENT"

    // Condition
    condition?: string; // "NEW", "REFURBISHED", "RENOVATED", "NEEDS_RENOVATION"

    // Construction
    constructionYear?: number;
    renovationYear?: number;

    // Features
    furnished?: boolean;
    balcony?: boolean;
    terrace?: boolean;
    garden?: boolean;
    elevator?: boolean;
    parking?: boolean;
    garage?: boolean;
    basement?: boolean;

    // Energy
    energyRating?: string; // "A", "B", "C", "D", "E", "F", "G"
    heatingType?: string;

    // Building details
    buildingType?: string; // "APARTMENT_BUILDING", "SINGLE_FAMILY_HOUSE"

    // Ownership
    ownershipType?: string;
    furnishedType?: string;

    // Additional features
    accessible?: boolean;
    petsAllowed?: boolean;
  };

  // Media
  pictures?: PropertyPicture[];
  documents?: PropertyDocument[];
  virtualTours?: VirtualTour[];
  floorPlans?: FloorPlan[];
}

/**
 * Image/picture data
 */
export interface PropertyPicture {
  id?: string;
  url?: string;
  urlSmall?: string;
  urlMedium?: string;
  urlLarge?: string;
  caption?: string;
  order?: number;
  isMainPicture?: boolean;
  width?: number;
  height?: number;
}

/**
 * Document attachments
 */
export interface PropertyDocument {
  id?: string;
  url?: string;
  title?: string;
  type?: string;
}

/**
 * Virtual tour data
 */
export interface VirtualTour {
  url?: string;
  type?: string; // "360", "VIDEO", "MATTERPORT"
}

/**
 * Floor plan data
 */
export interface FloorPlan {
  url?: string;
  title?: string;
}

/**
 * Advertisement specific data
 */
export interface AdvertisementData {
  advertisementType?: string;
  advertisementStatus?: string;
  externalId?: string;
  provisionFree?: boolean; // Commission-free
}

/**
 * Contact/agent data
 */
export interface ContactData {
  name?: string;
  company?: string;
  phone?: string;
  mobile?: string;
  email?: string;
  website?: string;

  // Agency info
  agencyName?: string;
  agencyLogo?: string;

  // Contact preferences
  contactAllowed?: boolean;
  showEmail?: boolean;
  showPhone?: boolean;
}

/**
 * Search query parameters for API requests
 */
export interface ImmoScout24SearchParams {
  // Required
  profile: 'android';
  size?: number; // Page size (default: 20, max: 100)
  from?: number; // Offset for pagination (0-based)

  // Sorting
  sort?: 'relevance' | 'dateDesc' | 'dateAsc' | 'priceAsc' | 'priceDesc' | 'sizeAsc' | 'sizeDesc';

  // Filters
  country?: string; // "AT" for Austria
  propertyType?: string; // "APARTMENT", "HOUSE", "LAND", "COMMERCIAL"
  transactionType?: string; // "SALE", "RENT"

  // Price range
  priceMin?: number;
  priceMax?: number;

  // Area range (square meters)
  areaMin?: number;
  areaMax?: number;

  // Room count
  roomsMin?: number;
  roomsMax?: number;

  // Location
  locationId?: string;
  postalCode?: string;
  city?: string;
  region?: string;

  // Features
  balcony?: boolean;
  terrace?: boolean;
  garden?: boolean;
  elevator?: boolean;
  parking?: boolean;
  garage?: boolean;

  // Date filters
  createdSince?: string; // ISO 8601 date

  // Other
  onlyNewBuilding?: boolean;
  energyRating?: string;

  // Additional filters (discovered through testing)
  [key: string]: any;
}

/**
 * Detail response from /api/psa/is24/property/{exposeId}
 */
export interface ImmoScout24DetailResponse extends ImmoScout24Property {
  // Detail view includes all property fields plus additional data
  fullDescription?: string;
  equipmentDescription?: string;
  locationDescription?: string;
  otherInformation?: string;
}
