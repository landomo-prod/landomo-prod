/**
 * Pisos.com raw listing data from search result pages
 */
export interface PisosListingRaw {
  /** Portal ID (e.g., "61697778385.528715") */
  portalId: string;
  /** Detail page URL path (e.g., "/comprar/piso-universidad_malasana28004-61697778385_528715/") */
  detailUrl: string;
  /** Listing title */
  title: string;
  /** Location subtitle */
  subtitle: string;
  /** Price in euros (parsed from "250.000 €") */
  price: number | null;
  /** Number of bedrooms (parsed from "3 habs.") */
  bedrooms: number | null;
  /** Number of bathrooms (parsed from "2 baños") */
  bathrooms: number | null;
  /** Area in sqm (parsed from "106 m²") */
  sqm: number | null;
  /** Floor (parsed from "2ª planta") */
  floor: string | null;
  /** Description snippet */
  description: string | null;
  /** Image URL */
  imageUrl: string | null;
  /** Property type slug from URL (piso, casa, atico, etc.) */
  propertyTypeSlug: string;
}

/**
 * Pisos.com detail page data
 */
export interface PisosDetailRaw {
  portalId: string;
  title: string;
  price: number | null;
  pricePerSqm: number | null;
  location: {
    address: string;
    neighborhood: string | null;
    city: string | null;
    latitude: number | null;
    longitude: number | null;
  };
  features: string[];
  featuresSummary: string[];
  description: string | null;
  energyCertificate: string | null;
  lastUpdated: string | null;
  images: string[];
  agentName: string | null;
  agentPhone: string | null;
  isNewDevelopment: boolean;
  sourceUrl: string;
}

/**
 * Search page configuration for a category+transaction type combination
 */
export interface SearchConfig {
  /** URL path segment for property type (e.g., "pisos", "casas", "terrenos") */
  typeSlug: string;
  /** URL path segment for transaction (e.g., "venta", "alquiler") */
  transactionSlug: string;
  /** Our category classification */
  category: 'apartment' | 'house' | 'land' | 'commercial';
  /** Transaction type */
  transactionType: 'sale' | 'rent';
  /** Label for logging */
  label: string;
}

/**
 * Spanish provinces for crawling
 */
export interface ProvinceConfig {
  slug: string;
  name: string;
}
