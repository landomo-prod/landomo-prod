export interface ImmovlanSearchResult {
  properties: ImmovlanListing[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface ImmovlanListing {
  id: number | string;
  title?: string;
  description?: string;
  price?: number;
  propertyType?: string;
  transactionType?: string;
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
    hasLift?: boolean;
    hasBasement?: boolean;
    hasBalcony?: boolean;
    hasPool?: boolean;
  };
  building?: {
    constructionYear?: number;
    condition?: string;
    floors?: number;
    floor?: number;
  };
  energy?: {
    heatingType?: string;
    epcScore?: string;
  };
  images?: Array<{ url: string }>;
  agent?: {
    name?: string;
    phone?: string;
  };
  publicationDate?: string;
  modificationDate?: string;
}
