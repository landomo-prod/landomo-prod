/**
 * TopReality.sk Types
 * TopReality.sk has REST APIs - no scraping needed
 */

export interface TopRealityLocation {
  id: string;
  name: string;
  districtName?: string;
  type: 'county' | 'district' | 'state';
  separator: boolean;
}

export interface TopRealityCountResponse {
  count: number;
  time: number;
}

export interface TopRealityListing {
  id: string;
  title: string;
  price: number;
  currency: string;
  location: string;
  propertyType: string;
  transactionType: string;
  url: string;

  // Optional details
  area?: number;         // m²
  rooms?: number;
  floor?: number;
  totalFloors?: number;
  description?: string;
  images?: string[];

  // Detail-enriched fields
  condition?: string;
  constructionType?: string;
  ownership?: string;
  heating?: string;
  energyRating?: string;
  furnished?: string;
  bathrooms?: number;
  yearBuilt?: number;
  hasElevator?: boolean;
  hasBalcony?: boolean;
  hasBasement?: boolean;
  hasParking?: boolean;
  hasGarage?: boolean;
  lat?: number;
  lon?: number;

  // Structured fields extracted from detail page
  sqm_built?: number;
  sqm_plot?: number;
  street?: string;
  updated_at?: string;
  portal_reference_id?: string;
  agency_name?: string;
  agent_name?: string;
  renovation_year?: number;
  bedrooms_count?: number;
  hasGarden?: boolean;
  hasTerrace?: boolean;
  hasLoggia?: boolean;

  // Contact fields from detail page
  agent_profile_url?: string;
  agency_profile_url?: string;
  agency_address?: string;
  phone_partial?: string;
  phone?: string;

  // Raw API data
  rawData?: any;
}

export interface TopRealitySearchParams {
  location?: string;     // e.g., 'c100-Bratislavský kraj'
  offerType?: number;    // 0=all, 1=sale, 2=rent
  propertyType?: number; // 0=all, 1=apartments, 2=houses, etc.
  areaFrom?: number;
  areaTo?: number;
  priceFrom?: number;
  priceTo?: number;
  page?: number;
}
