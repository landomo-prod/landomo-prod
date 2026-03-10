/**
 * Type definitions for Immowelt.de portal data
 * Based on __NEXT_DATA__ JSON structure and classified-serp-init-data
 */

export interface ImmoweltListing {
  id: string;
  title: string;
  url: string;
  price?: number;
  priceText?: string;
  location?: {
    city?: string;
    district?: string;
    address?: string;
    zipCode?: string;
    state?: string;
  };
  area?: number;
  plotArea?: number;
  rooms?: number;
  floor?: number;
  propertyType?: string;
  transactionType?: string;
  description?: string;
  images?: string[];
  features?: string[];
  // German-specific fields
  condition?: string; // Zustand
  furnished?: string; // Ausstattung
  energyRating?: string; // Energieeffizienzklasse
  heatingType?: string; // Heizungsart
  constructionYear?: number; // Baujahr
  availableFrom?: string; // Verfügbar ab
  parkingSpaces?: number; // Stellplätze
  balcony?: boolean;
  terrace?: boolean;
  garden?: boolean;
  elevator?: boolean;
  cellar?: boolean; // Keller
  guestToilet?: boolean; // Gäste-WC
  coordinates?: {
    lat: number;
    lng: number;
  };
  realtor?: {
    name?: string;
    phone?: string;
    email?: string;
    company?: string;
  };
  metadata?: {
    views?: number;
    published?: string;
    updated?: string;
    objectNumber?: string; // Objektnummer
  };
  // German-specific indexed fields
  ownershipType?: string;
  hausgeld?: number;
  courtage?: string;
  kfwStandard?: string;
  denkmalschutz?: boolean;

  // Internal field for raw NextData
  _nextData?: any;
  // Internal field for attributes extracted from detail pages
  _attributes?: Record<string, string>;
}

export interface NextDataProperty {
  // Core property data from __NEXT_DATA__
  id?: string;
  estateid?: string;
  EstateId?: string;
  globalObjectKey?: string;
  title?: string;
  headline?: string;
  price?: {
    value?: number;
    marketingType?: string;
    currency?: string;
  };
  generalData?: {
    street?: string;
    city?: string;
    zip?: string;
    district?: string;
    state?: string;
  };
  location?: {
    address?: {
      city?: string;
      street?: string;
      houseNumber?: string;
      postcode?: string;
      quarter?: string;
    };
  };
  geoHierarchy?: {
    city?: { name?: string };
    quarter?: { name?: string };
    region?: { name?: string };
  };
  areas?: {
    livingArea?: number;
    plotArea?: number;
    usableArea?: number;
  };
  mainKeyFacts?: Array<{
    key?: string;
    value?: any;
    label?: string;
  }>;
  equipmentAreas?: {
    livingArea?: { value?: number };
    plotArea?: { value?: number };
    numberOfRooms?: { value?: number };
  };
  equipmentCharacteristics?: any;
  images?: Array<{
    urls?: {
      medium?: string;
      large?: string;
      original?: string;
    };
    url?: string;
  }>;
  galleries?: Array<{
    items?: Array<{
      thumbnail?: string;
      large?: string;
    }>;
  }>;
  onlineId?: string;
  EstateMapData?: {
    LocationCoordinates?: {
      Latitude?: number;
      Longitude?: number;
    };
  };
  distributionData?: {
    publicationDate?: string;
    modificationDate?: string;
  };
}

export interface NextDataStructure {
  props?: {
    pageProps?: {
      searchData?: {
        items?: any[];
        list?: any[];
        results?: any[];
      };
      propertyData?: NextDataProperty;
      estateData?: NextDataProperty;
      initialEstateData?: NextDataProperty;
    };
    initialState?: {
      search?: {
        items?: any[];
      };
    };
  };
  query?: any;
}

export interface ScrapeResult {
  listings: ImmoweltListing[];
  totalFound: number;
  scraped: number;
  errors: string[];
}

export interface ScraperConfig {
  headless: boolean;
  timeout: number;
  maxRetries: number;
  rateLimit: number;
  userAgent?: string;
  // DataDome bypass settings
  stealthMode: boolean;
  randomDelays: boolean;
  minDelay: number;
  maxDelay: number;
}

export interface SearchParams {
  transactionType: 'sale' | 'rent';
  propertyType?: 'wohnung' | 'haus' | 'grundstueck' | 'gewerbe';
  location?: string;
  priceMin?: number;
  priceMax?: number;
  page?: number;
}
