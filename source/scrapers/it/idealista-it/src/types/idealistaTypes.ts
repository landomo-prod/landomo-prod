export interface IdealistaListing {
  id: string;
  url: string;
  title: string;
  price: number;
  currency: string;
  size: number;
  rooms: number;
  bathrooms?: number;
  floor?: string;
  description?: string;
  location: {
    city: string;
    address?: string;
    neighborhood?: string;
    province?: string;
  };
  thumbnails: string[];
  propertyType: string;
  operation: 'sale' | 'rent';
  features: string[];
  hasElevator?: boolean;
  hasParking?: boolean;
  hasGarden?: boolean;
  hasSwimmingPool?: boolean;
  hasTerrace?: boolean;
  isNewDevelopment?: boolean;
}

export interface IdealistaDetail {
  description?: string;
  energyClass?: string;
  yearBuilt?: number;
  floor?: number;
  totalFloors?: number;
  bathrooms?: number;
  condition?: string;
  heatingType?: string;
  furnished?: string;
  parkingIncluded?: boolean;
  parkingSpaces?: number;
  plotSize?: number;
  builtArea?: number;
  usableArea?: number;
  features: string[];
  images: string[];
  agencyName?: string;
  agencyPhone?: string;
}

export interface IdealistaSearchConfig {
  city: string;
  operation: 'sale' | 'rent';
  propertyType: 'apartments' | 'houses' | 'land' | 'commercial';
  urlPath: string;
}

export type PropertyCategory = 'apartment' | 'house' | 'land' | 'commercial';
