/**
 * Reality.sk Types
 * Reality.sk uses server-side rendering - no API, must parse HTML
 */

export interface RealityListing {
  id: string;
  title: string;
  price: number;
  currency: string;
  location: string;
  propertyType: string;
  transactionType: string;
  url: string;
  imageUrl?: string;

  // Optional details
  rooms?: number;
  sqm?: number;
  description?: string;

  // Detail page enrichment fields
  floor?: number;
  totalFloors?: number;
  ownership?: string;
  condition?: string;
  heating?: string;
  energyRating?: string;
  constructionType?: string;
  furnished?: string;
  bathrooms?: number;
  yearBuilt?: number;
  hasElevator?: boolean;
  hasBalcony?: boolean;
  hasBasement?: boolean;
  hasParking?: boolean;
  hasGarage?: boolean;
  hasLoggia?: boolean;
  hasTerrace?: boolean;
  hasGarden?: boolean;
  images?: string[];

  // Additional structured fields from detail page (JSON-LD / HTML)
  sqm_plot?: number;
  sqm_built?: number;
  bedrooms_count?: number;
  terrain?: string;
  building_permit?: string;
  outdoor_parking_spaces?: number;
  orientation?: string;
  heat_source?: string;
  agent_name?: string;
  agency_profile_url?: string;
  agency_address?: string;
  phone_partial?: string;
  updated_date?: string;
  published_date?: string;
  // Utility strings (for land transformer enum mapping)
  utility_electricity?: string;
  utility_water?: string;
  utility_gas?: string;
  utility_sewage?: string;

  // New fields from deep audit (amenityFeature + HTML)
  year_approved?: number;
  renovation_year?: number;
  balcony_count?: number;
  balcony_area?: number;
  terrace_area?: number;
  loggia_area?: number;
  cellar_count?: number;
  plot_width?: number;
  plot_length?: number;
  land_zone?: string;
  road_access?: string;
  floor_position?: string;
  room_count?: number;
  property_subtype?: string;
  lat?: number;
  lon?: number;

  // Raw HTML data
  rawHtml?: string;
}

export interface RealitySearchParams {
  category: string; // 'byty', 'domy', 'pozemky'
  type: string;     // 'predaj', 'prenajom'
  location?: string;
  page?: number;
}
