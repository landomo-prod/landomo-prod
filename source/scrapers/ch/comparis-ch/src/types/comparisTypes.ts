/**
 * Comparis listing data types
 *
 * TODO: Verify field names against actual Comparis API response after deployment.
 * These types are based on common Swiss portal patterns and Comparis's known data structure.
 */

export interface ComparisListing {
  id: string | number;
  adId?: string;
  title?: string;
  description?: string;

  // Pricing
  price?: number;
  priceValue?: number;
  priceUnit?: string;
  currency?: string;
  rentNet?: number;
  rentGross?: number;
  charges?: number;

  // Property details
  propertyType?: string;
  numberOfRooms?: number;
  rooms?: number;
  livingSpace?: number;
  surfaceLiving?: number;
  plotArea?: number;
  floor?: number;
  numberOfFloors?: number;
  yearBuilt?: number;

  // Location
  address?: string;
  street?: string;
  zipCode?: string | number;
  city?: string;
  canton?: string;
  latitude?: number;
  longitude?: number;

  // Transaction
  dealType?: string | number;

  // Features
  hasBalcony?: boolean;
  hasParking?: boolean;
  hasGarage?: boolean;
  hasElevator?: boolean;
  hasGarden?: boolean;
  isFurnished?: boolean;
  features?: string[];

  // Media
  images?: Array<{ url: string; caption?: string }>;
  imageUrl?: string;

  // Source
  url?: string;
  portalName?: string;
  externalId?: string;
}

export interface ComparisSearchResponse {
  items?: ComparisListing[];
  results?: ComparisListing[];
  totalCount?: number;
  total?: number;
  page?: number;
  pageSize?: number;
}

// Comparis property type codes
// TODO: Verify actual codes used by Comparis API
export const COMPARIS_PROPERTY_TYPES: Record<string, string> = {
  apartment: 'apartment',
  house: 'house',
  land: 'land',
  commercial: 'commercial',
  parking: 'parking',
};

export const COMPARIS_DEAL_TYPES = {
  buy: 10,
  rent: 20,
} as const;
