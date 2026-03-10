export interface EnalquilerListingRaw {
  id: string;
  url: string;
  title: string;
  price: number | null;
  currency: string;
  propertyType: string;
  estateTypeId: number;
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
  isFurnished: boolean | null;
}

export interface EnalquilerSearchConfig {
  propertyType: string;        // 'pisos', 'casas', 'aticos'
  estateTypeId: number;        // 2=piso, 3=atico, 4=duplex, 5=loft, 6=estudio, 7=casa
  province: string;            // URL slug e.g. 'madrid'
  provinceDisplay: string;     // Display name e.g. 'Madrid'
}

export interface EnalquilerSearchResult {
  totalListings: number;
  totalPages: number;
  listings: EnalquilerListingRaw[];
}

export type PropertyCategory = 'apartment' | 'house' | 'land' | 'commercial';

// Estate type ID → property category mapping
// 2=Piso, 3=Atico, 4=Duplex, 5=Loft, 6=Estudio → apartment
// 7=Casa/Chalet → house
export function getPropertyCategory(estateTypeId: number, propertyType: string): PropertyCategory {
  if (estateTypeId === 7 || propertyType === 'casas') return 'house';
  return 'apartment';
}
