/**
 * ImmobilienScout24 API Response Types
 * Based on reverse engineering from Android APK and API testing
 */

/**
 * Main search response structure
 */
export interface ImmoScout24SearchResponse {
  items?: ImmoScout24Property[];
  pageNumber?: number;
  pageSize?: number;
  numberOfHits?: number;
  maxItems?: number;
  totalPages?: number;
  _embedded?: {
    results?: ImmoScout24Property[];
  };
}

/**
 * Property/Expose object from search results
 */
export interface ImmoScout24Property {
  id: string;
  exposeId?: string;
  objectData?: ImmoScout24ObjectData;
  title?: string;
  titleWithMarkup?: string;
  address?: ImmoScout24Address;
  price?: ImmoScout24Price;
  mainPrice?: number;
  priceInformation?: ImmoScout24PriceInfo;
  livingSpace?: number;
  numberOfRooms?: number;
  pictures?: ImmoScout24Picture[];
  galleryAttachments?: ImmoScout24GalleryAttachment[];
  type?: string;
  realEstateType?: string;
  estateType?: string;
  publicationDate?: string;
  creationDate?: string;
  modificationDate?: string;
  isNew?: boolean;
  isPremium?: boolean;
  isHighlighted?: boolean;
  builtInKitchen?: boolean;
  balcony?: boolean;
  garden?: boolean;
  cellar?: boolean;
  lift?: boolean;
  guestToilet?: boolean;
  privateOffer?: boolean;
  grouped?: boolean;
  contactDetails?: ImmoScout24Contact;
  attributes?: ImmoScout24Attribute[];
  tags?: string[];
  [key: string]: any; // Allow additional fields
}

/**
 * Detailed object data structure
 */
export interface ImmoScout24ObjectData {
  description?: string;
  descriptionNote?: string;
  furnishingNote?: string;
  locationNote?: string;
  otherNote?: string;
  priceInformation?: ImmoScout24PriceInfo;
  localization?: ImmoScout24Address;
  address?: ImmoScout24Address;
  pictures?: ImmoScout24Picture[];
  area?: ImmoScout24AreaInfo;
  type?: string;
  condition?: string;
  constructionYear?: number;
  lastRefurbishment?: number;
  numberOfFloors?: number;
  interiorQuality?: string;
  energyCertificate?: ImmoScout24EnergyCertificate;
  heatingType?: string;
  firingTypes?: string[];
  numberOfBedRooms?: number;
  numberOfBathRooms?: number;
  numberOfParkingSpaces?: number;
  parkingSpaceType?: string;
  cellar?: boolean;
  balcony?: boolean;
  garden?: boolean;
  lift?: boolean;
  builtInKitchen?: boolean;
  assistedLiving?: boolean;
  guestToilet?: boolean;
  handicappedAccessible?: boolean;
  floor?: number;
  [key: string]: any;
}

/**
 * Address/Location information
 */
export interface ImmoScout24Address {
  address?: string;
  street?: string;
  houseNumber?: string;
  postcode?: string;
  city?: string;
  quarter?: string;
  district?: string;
  state?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  preciseHouseNumber?: boolean;
  geoHierarchy?: {
    city?: { name?: string };
    quarter?: { name?: string };
    neighbourhood?: { name?: string };
  };
  [key: string]: any;
}

/**
 * Price information
 */
export interface ImmoScout24Price {
  value?: number;
  currency?: string;
  marketingType?: string;
  priceIntervalType?: string;
}

export interface ImmoScout24PriceInfo {
  price?: number;
  currency?: string;
  marketingType?: 'PURCHASE' | 'RENT';
  priceIntervalType?: string;
  pricePerSqm?: number;
  additionalCosts?: number;
  heatingCosts?: number;
  heatingCostsInServiceCharge?: boolean;
  deposit?: number;
  courtage?: string;
  courtagePriceWording?: string;
  [key: string]: any;
}

/**
 * Area/Size information
 */
export interface ImmoScout24AreaInfo {
  livingArea?: number;
  livingSpace?: number;
  usableFloorSpace?: number;
  plotArea?: number;
  numberOfRooms?: number;
  [key: string]: any;
}

/**
 * Picture/Image information
 */
export interface ImmoScout24Picture {
  id?: string;
  url?: string;
  urls?: {
    [size: string]: string;
  };
  title?: string;
  titleWithMarkup?: string;
  floorplan?: boolean;
  [key: string]: any;
}

export interface ImmoScout24GalleryAttachment {
  id?: string;
  title?: string;
  type?: string;
  urls?: {
    ORIGINAL?: string;
    SCALE_1600x1200?: string;
    SCALE_800x600?: string;
    SCALE_640x480?: string;
    [key: string]: string | undefined;
  };
  floorplan?: boolean;
  titlePicture?: boolean;
  [key: string]: any;
}

/**
 * Energy certificate information
 */
export interface ImmoScout24EnergyCertificate {
  energyEfficiencyClass?: string;
  energyConsumption?: number;
  thermalCharacteristic?: number;
  energyCertificateAvailability?: string;
  energyCertificateCreationDate?: string;
  buildingEnergyRatingType?: string;
  [key: string]: any;
}

/**
 * Contact information
 */
export interface ImmoScout24Contact {
  salutation?: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  address?: ImmoScout24Address;
  phoneNumber?: string;
  cellPhoneNumber?: string;
  email?: string;
  homepageUrl?: string;
  logoUrl?: string;
  [key: string]: any;
}

/**
 * Attribute key-value pairs
 */
export interface ImmoScout24Attribute {
  key?: string;
  value?: string;
  label?: string;
  [key: string]: any;
}

/**
 * Detail response for single property
 */
export interface ImmoScout24DetailResponse {
  id: string;
  exposeId: string;
  objectData: ImmoScout24ObjectData;
  realEstate?: any;
  realEstateType?: string;
  title?: string;
  creationDate?: string;
  lastModificationDate?: string;
  publicationDate?: string;
  virtualTourUrl?: string;
  galleryAttachments?: ImmoScout24GalleryAttachment[];
  [key: string]: any;
}
