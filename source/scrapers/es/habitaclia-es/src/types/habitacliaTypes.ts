export interface HabitacliaListingRaw {
  id: string;
  url: string;
  title: string;
  price: number | null;
  currency: string;
  transactionType: 'venta' | 'alquiler';
  propertyType: string;
  sqm: number | null;
  rooms: number | null;
  bathrooms: number | null;
  floor: string | null;
  description: string | null;
  location: {
    address: string | null;
    city: string | null;
    province: string | null;
    district: string | null;
    lat: number | null;
    lng: number | null;
  };
  images: string[];
  features: string[];
  agencyName: string | null;
  agencyPhone: string | null;
  energyCertificate: string | null;
  yearBuilt: number | null;
  condition: string | null;
  hasElevator: boolean | null;
  hasParking: boolean | null;
  hasGarden: boolean | null;
  hasPool: boolean | null;
  hasTerrace: boolean | null;
  hasBalcony: boolean | null;
  hasBasement: boolean | null;
  hasGarage: boolean | null;
  hasAirConditioning: boolean | null;
  plotSize: number | null;
  communityFees: number | null;
}

export interface HabitacliaSearchConfig {
  propertyType: 'pisos' | 'casas' | 'terrenos' | 'locales' | 'oficinas' | 'naves' | 'garajes';
  transactionType: 'comprar' | 'alquiler';
  province: string;
}

export interface HabitacliaSearchResult {
  totalListings: number;
  totalPages: number;
  listings: HabitacliaListingRaw[];
}

export type PropertyCategory = 'apartment' | 'house' | 'land' | 'commercial';
