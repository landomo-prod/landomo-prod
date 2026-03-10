/**
 * Donpiso.com raw listing data extracted from search result pages (JSON-LD)
 */
export interface DonpisoListingRaw {
  /** Portal ID extracted from URL (e.g., "300813") */
  portalId: string;
  /** Full detail page URL */
  detailUrl: string;
  /** Listing title (e.g., "Piso en venta en Madrid") */
  title: string;
  /** Price in euros */
  price: number | null;
  /** Description snippet */
  description: string | null;
  /** Primary image URL */
  imageUrl: string | null;
  /** Property type slug detected from title (piso, casa, duplex, local, etc.) */
  propertyTypeSlug: string;
  /** Transaction type from URL (sale/rent) */
  transactionType: 'sale' | 'rent';
  /** Province slug (e.g., "madrid", "barcelona") */
  provinceSlug: string;
}

/**
 * Donpiso.com detail page data
 */
export interface DonpisoDetailRaw {
  portalId: string;
  title: string;
  price: number | null;
  pricePerSqm: number | null;
  location: {
    address: string | null;
    neighborhood: string | null;
    city: string | null;
    province: string | null;
    latitude: number | null;
    longitude: number | null;
  };
  bedrooms: number | null;
  bathrooms: number | null;
  sqm: number | null;
  sqmPlot: number | null;
  floor: string | null;
  features: string[];
  description: string | null;
  energyCertificate: string | null;
  constructionYear: number | null;
  images: string[];
  agentName: string | null;
  agentPhone: string | null;
  agentEmail: string | null;
  isNewDevelopment: boolean;
  sourceUrl: string;
}

/**
 * Province configuration for donpiso
 */
export interface ProvinceConfig {
  slug: string;
  name: string;
}
