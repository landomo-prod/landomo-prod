/** Raw Pararius listing from search page */
export interface ParariusSearchResult {
  id: string;
  url: string;
  address: string;
  city: string;
  postalCode: string;
  price: number;
  area?: number;
  rooms?: number;
  propertyType: string; // 'apartment' | 'house'
  imageUrl?: string;
}

/** Raw Pararius detail page data */
export interface ParariusDetailData {
  id: string;
  url: string;
  address: string;
  city: string;
  postalCode: string;
  price: number;
  currency: string;
  propertyType: string;
  livingArea?: number;
  plotArea?: number;
  rooms?: number;
  bedrooms?: number;
  bathrooms?: number;
  floor?: number;
  totalFloors?: number;
  hasGarden: boolean;
  hasGarage: boolean;
  hasBasement: boolean;
  hasBalcony: boolean;
  hasElevator: boolean;
  hasParking: boolean;
  energyLabel?: string;
  yearBuilt?: number;
  furnished?: string;
  description?: string;
  images: string[];
  agentName?: string;
  latitude?: number;
  longitude?: number;
  features: string[];
  availableFrom?: string;
  deposit?: number;
}
