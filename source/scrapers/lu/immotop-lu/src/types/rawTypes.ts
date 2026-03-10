export interface ImmotopListingRaw {
  id: string;
  title?: string;
  price?: number;
  currency?: string;
  propertyType?: string;
  transactionType?: string;
  url?: string;
  address?: {
    street?: string;
    zip?: string;
    city?: string;
    country?: string;
    region?: string;
  };
  latitude?: number;
  longitude?: number;
  surface?: number;
  bedrooms?: number;
  bathrooms?: number;
  rooms?: number;
  floor?: number;
  totalFloors?: number;
  plotSize?: number;
  yearBuilt?: number;
  energyClass?: string;
  condition?: string;
  heatingType?: string;
  description?: string;
  features?: string[];
  images?: string[];
  agencyName?: string;
  agencyPhone?: string;
  hasElevator?: boolean;
  hasBalcony?: boolean;
  hasParking?: boolean;
  hasBasement?: boolean;
  hasGarden?: boolean;
  hasGarage?: boolean;
  hasTerrace?: boolean;
  hasPool?: boolean;
  parkingSpaces?: number;
}

export interface ImmotopDetailRaw extends ImmotopListingRaw {
  detailedDescription?: string;
  detailedFeatures?: string[];
}
