/**
 * Newhome.ch listing data types
 *
 * TODO: Verify field names against actual Newhome API response after deployment.
 * Newhome.ch is a Swiss real estate portal focusing on new constructions and resale.
 * These types are based on common Swiss portal patterns.
 */

export interface NewhomeListing {
  id: string | number;
  objectId?: string;
  title?: string;
  description?: string;

  // Pricing
  price?: number;
  priceFrom?: number;
  priceTo?: number;
  priceUnit?: string;
  currency?: string;
  rentNet?: number;
  rentGross?: number;
  charges?: number;

  // Property details
  propertyType?: string;
  objectType?: string;
  numberOfRooms?: number;
  rooms?: number;
  livingSpace?: number;
  usableSpace?: number;
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
  offerType?: string; // 'buy' | 'rent'
  transactionType?: string;

  // Features
  hasBalcony?: boolean;
  hasParking?: boolean;
  hasGarage?: boolean;
  hasElevator?: boolean;
  hasGarden?: boolean;
  isFurnished?: boolean;
  isNewConstruction?: boolean;
  features?: string[];
  amenities?: string[];

  // Media
  images?: Array<{ url: string; caption?: string } | string>;
  mainImage?: string;

  // Source
  url?: string;
  detailUrl?: string;
  externalId?: string;
  provider?: string;
}

export interface NewhomeSearchResponse {
  items?: NewhomeListing[];
  results?: NewhomeListing[];
  objects?: NewhomeListing[];
  totalCount?: number;
  total?: number;
  page?: number;
  pageSize?: number;
  hasMore?: boolean;
}

// Newhome property type mappings
// TODO: Verify actual property type codes used by Newhome API
export const NEWHOME_PROPERTY_TYPES: Record<string, string> = {
  apartment: 'apartment',
  house: 'house',
  land: 'land',
  commercial: 'commercial',
};

export const NEWHOME_OFFER_TYPES = {
  buy: 'buy',
  rent: 'rent',
} as const;
