export interface ZimmoSearchResult {
  items: ZimmoListing[];
  total: number;
  page: number;
  pageCount: number;
}

export interface ZimmoListing {
  id: number | string;
  title?: string;
  description?: string;
  price?: number;
  type?: string; // apartment, house, land, commercial
  transactionType?: string; // sale, rent
  surface?: number;
  landSurface?: number;
  bedrooms?: number;
  bathrooms?: number;
  address?: {
    street?: string;
    number?: string;
    city?: string;
    postalCode?: string;
    province?: string;
    latitude?: number;
    longitude?: number;
  };
  features?: {
    hasGarden?: boolean;
    gardenSurface?: number;
    hasTerrace?: boolean;
    terraceSurface?: number;
    hasParking?: boolean;
    parkingSpaces?: number;
    hasGarage?: boolean;
    garageCount?: number;
    hasLift?: boolean;
    hasBasement?: boolean;
    hasBalcony?: boolean;
    hasPool?: boolean;
    hasFireplace?: boolean;
  };
  building?: {
    constructionYear?: number;
    condition?: string;
    floors?: number;
    floor?: number;
    facadeCount?: number;
  };
  energy?: {
    heatingType?: string;
    epcScore?: string;
    primaryEnergy?: number;
  };
  images?: string[];
  agent?: {
    name?: string;
    phone?: string;
    email?: string;
  };
  publicationDate?: string;
  modificationDate?: string;
}
