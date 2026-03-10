/**
 * Immobiliare.it API types
 * Based on /api-next/search-list/real-estates/ response structure
 */

export interface ImmobiliareLocation {
  address?: string;
  latitude?: number;
  longitude?: number;
  city?: { name?: string; id?: number };
  province?: { name?: string; abbreviation?: string };
  region?: { name?: string };
  nation?: { name?: string };
  macrozone?: { name?: string };
  microzone?: { name?: string };
}

export interface ImmobiliarePrice {
  value?: number;
  formattedValue?: string;
  priceRange?: string;
}

export interface ImmobiliareFloor {
  value?: string;
  abbreviation?: string;
  ga4Value?: string;
}

export interface ImmobiliareEnergy {
  class?: string;
  value?: number;
}

export interface ImmobiliareProperty {
  price?: ImmobiliarePrice;
  surface_value?: string;
  rooms?: string;
  bedRoomsNumber?: string;
  bathrooms?: string;
  floor?: ImmobiliareFloor;
  floors?: string;
  hasElevators?: boolean;
  ga4features?: string[];
  ga4Garage?: string;
  condition?: string;
  ga4Heating?: string;
  energy?: ImmobiliareEnergy;
  location?: ImmobiliareLocation;
  description?: string;
  photo?: { urls?: { small?: string; medium?: string; large?: string } };
  multimedia?: { photos?: Array<{ urls?: { small?: string; medium?: string; large?: string } }> };
  typology?: { name?: string };
  typologyGA4Translation?: string;
  caption?: string;
  contract?: string;
}

export interface ImmobiliareRealEstate {
  id: number;
  title?: string;
  contract?: string;
  isNew?: boolean;
  luxury?: boolean;
  type?: string;
  typology?: { id?: number; name?: string };
  agency?: { displayName?: string; id?: number };
  advertiser?: { agency?: { displayName?: string }; supervisor?: { displayName?: string } };
  uri?: string;
}

export interface ImmobiliareResult {
  realEstate: ImmobiliareRealEstate;
  seo?: { anchor?: string; url?: string };
  properties?: ImmobiliareProperty[];
}

export interface ImmobiliareResponse {
  results?: ImmobiliareResult[];
  count?: number;
  totalAds?: number;
  currentPage?: number;
  maxPages?: number;
  isResultsLimitReached?: boolean;
}

export interface ImmobiliareListingMinimal {
  id: number;
  price?: number;
  surface?: string;
  updatedAt?: string;
}

export type ImmobiliareCategory = 'apartments' | 'houses' | 'land' | 'commercial';
export type ImmobiliareContract = 'sale' | 'rent';

export interface SearchConfig {
  category: ImmobiliareCategory;
  contract: ImmobiliareContract;
  /** immobiliare.it region slug, e.g. 'lazio', 'lombardia' */
  region: string;
}

export interface CategoryContractMapping {
  /** API param: idCategoria */
  idCategoria: number;
  /** API param: idContratto */
  idContratto: number;
  /** HTML page URL slug, e.g. 'vendita-case' */
  urlSlug: string;
}

/**
 * Maps category + contract → API IDs and HTML URL slug.
 *
 * API contract IDs:
 *   1 = vendita (sale)
 *   2 = affitto (rent)
 *
 * API category IDs:
 *   1  = appartamenti
 *   2  = case/ville
 *   5  = commerciale
 *   10 = terreni (land)
 */
export const CATEGORY_ID_MAP: Record<ImmobiliareCategory, Record<ImmobiliareContract, CategoryContractMapping>> = {
  apartments: {
    sale: { idCategoria: 1, idContratto: 1, urlSlug: 'vendita-appartamenti' },
    rent: { idCategoria: 1, idContratto: 2, urlSlug: 'affitto-appartamenti' },
  },
  houses: {
    sale: { idCategoria: 2, idContratto: 1, urlSlug: 'vendita-case' },
    rent: { idCategoria: 2, idContratto: 2, urlSlug: 'affitto-case' },
  },
  land: {
    sale: { idCategoria: 10, idContratto: 1, urlSlug: 'vendita-terreni' },
    rent: { idCategoria: 10, idContratto: 2, urlSlug: 'affitto-terreni' },
  },
  commercial: {
    sale: { idCategoria: 5, idContratto: 1, urlSlug: 'vendita-uffici' },
    rent: { idCategoria: 5, idContratto: 2, urlSlug: 'affitto-uffici' },
  },
};

/**
 * All 20 Italian regions with their immobiliare.it URL slugs.
 */
export const REGIONS: string[] = [
  'lazio',
  'lombardia',
  'campania',
  'piemonte',
  'emilia-romagna',
  'toscana',
  'sicilia',
  'veneto',
  'liguria',
  'puglia',
  'sardegna',
  'calabria',
  'marche',
  'abruzzo',
  'trentino-alto-adige',
  'friuli-venezia-giulia',
  'umbria',
  'basilicata',
  'molise',
  'valle-d-aosta',
];

// Keep CATEGORY_URL_MAP as a legacy alias for any code that still references it.
// New code should use CATEGORY_ID_MAP instead.
export const CATEGORY_URL_MAP: Record<ImmobiliareCategory, Record<ImmobiliareContract, string>> = {
  apartments: {
    sale: 'vendita-appartamenti',
    rent: 'affitto-appartamenti',
  },
  houses: {
    sale: 'vendita-case',
    rent: 'affitto-case',
  },
  land: {
    sale: 'vendita-terreni',
    rent: 'affitto-terreni',
  },
  commercial: {
    sale: 'vendita-uffici',
    rent: 'affitto-uffici',
  },
};
