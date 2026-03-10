/**
 * LuxuryEstate.com Type Definitions
 *
 * Models the schema.org JSON-LD structured data found on detail pages,
 * plus the minimal listing data extracted from search/listing pages.
 */

// ─── Schema.org JSON-LD structures ───────────────────────────────────────────

export interface SchemaOrgOffer {
  '@type'?: string;
  price?: number | string;
  priceCurrency?: string;
  priceSpecification?: {
    price?: number | string;
    priceCurrency?: string;
  };
  availability?: string;
  /** Signals rental if present */
  priceValidUntil?: string;
}

export interface SchemaOrgGeoCoordinates {
  '@type'?: string;
  latitude?: number | string;
  longitude?: number | string;
}

export interface SchemaOrgPostalAddress {
  '@type'?: string;
  streetAddress?: string;
  addressLocality?: string;
  addressRegion?: string;
  postalCode?: string;
  addressCountry?: string;
}

export interface SchemaOrgQuantitativeValue {
  '@type'?: string;
  value?: number | string;
  unitCode?: string; // MTK = m², FTK = ft²
}

export interface SchemaOrgPerson {
  '@type'?: string;
  name?: string;
  telephone?: string;
  email?: string;
  worksFor?: {
    name?: string;
    logo?: string;
  };
}

/**
 * The primary schema.org JSON-LD object found on LuxuryEstate detail pages.
 * @type can be: "RealEstateListing", "Product", "Apartment",
 *   "SingleFamilyResidence", "House", "LandmarksOrHistoricalBuildings"
 */
export interface LuxuryEstateJsonLd {
  '@context'?: string;
  '@type'?: string | string[];
  name?: string;
  description?: string;
  url?: string;
  offers?: SchemaOrgOffer | SchemaOrgOffer[];
  geo?: SchemaOrgGeoCoordinates;
  address?: SchemaOrgPostalAddress;
  /** Total number of rooms */
  numberOfRooms?: number | string;
  /** Number of bedrooms */
  numberOfBedrooms?: number | string;
  /** Number of bathrooms */
  numberOfBathroomsTotal?: number | string;
  /** Floor area (living area) */
  floorSize?: SchemaOrgQuantitativeValue;
  /** Land area (plot size) */
  lotSize?: SchemaOrgQuantitativeValue;
  /** Number of floors in building */
  numberOfFloors?: number | string;
  /** Floor the unit is on */
  floorLevel?: number | string;
  /** Images - can be string[], object[], or a single string */
  image?: string | string[] | Array<{ url?: string; '@type'?: string }>;
  /** Year built */
  yearBuilt?: number | string;
  /** Property agent/contact */
  author?: SchemaOrgPerson;
  contactPoint?: SchemaOrgPerson;
  /** Array of amenity strings */
  amenityFeature?: Array<{ '@type'?: string; name?: string; value?: boolean | string }>;
  /** Date published on portal */
  datePublished?: string;
  /** Date modified */
  dateModified?: string;
  /** Keywords can hint at category */
  keywords?: string;
  /** Property ID from portal (sometimes present) */
  identifier?: string | { value?: string };
}

// ─── Internal working types ───────────────────────────────────────────────────

/** Transaction type derived from context (URL path / JSON-LD) */
export type TransactionType = 'sale' | 'rent';

/** Property category used for routing to the correct transformer */
export type PropertyCategory = 'apartment' | 'house';

/** Minimal listing info extracted from search result pages (Phase 1) */
export interface LuxuryEstateMinimalListing {
  /** LuxuryEstate numeric ID (from URL: /p{ID}-...) */
  id: string;
  /** Full URL of the detail page */
  url: string;
  /** Price as extracted from card (may be missing/approximation) */
  price?: number;
  /** Currency string from card */
  currency?: string;
  /** Title from card */
  title?: string;
  /** Thumbnail image from card */
  thumbnail?: string;
  /** City name from card */
  city?: string;
  /** Region from card */
  region?: string;
  /** Quick category hint from URL path (apartments / villas / etc.) */
  categoryHint?: string;
  /** Transaction type hint from URL path */
  transactionHint?: TransactionType;
}

/** Full listing data after detail page fetch + JSON-LD extraction */
export interface LuxuryEstateListing {
  id: string;
  url: string;
  jsonLd: LuxuryEstateJsonLd;
  /** Detected transaction type */
  transactionType: TransactionType;
  /** Detected property category */
  propertyCategory: PropertyCategory;
  /** Raw HTML for fallback parsing if needed */
  rawHtml?: string;
}

/** Configuration for a search endpoint to scrape */
export interface SearchConfig {
  /** Base URL to fetch */
  url: string;
  /** Category label for logging */
  category: string;
  /** Transaction type */
  transactionType: TransactionType;
  /** Category hint for transformer routing */
  categoryHint: PropertyCategory;
}
