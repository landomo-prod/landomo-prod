/**
 * Type-safe constants and interfaces for SReality API
 * Based on reverse-engineered API documentation from SReality Android app v1.5.2
 *
 * Reference: /Users/samuelseidel/Development/sreality/SREALITY_API_RESPONSE_MAPPINGS.md
 */

/**
 * Czech field names used in items array
 * These are the exact field names as they appear in the SReality API responses
 */
export const FIELD_NAMES = {
  // Area fields
  LIVING_AREA: 'Užitná plocha',
  LIVING_AREA_TRUNCATED: 'Užitná ploch',  // API often truncates the trailing 'a'
  TOTAL_AREA: 'Celková plocha',
  AREA: 'Plocha',
  PLOT_AREA: 'Plocha pozemku',
  BUILT_UP_AREA: 'Zastavěná plocha',
  BUILT_UP_AREA_ALT: 'Plocha zastavěná',  // API sometimes uses reversed word order

  // Outdoor spaces
  BALCONY: 'Balkón',
  BALCONY_ALT: 'Balkon',
  LOGGIA: 'Lodžie',
  TERRACE: 'Terasa',
  GARDEN: 'Zahrada',
  GARDEN_AREA: 'Plocha zahrady',  // API sometimes uses this instead of 'Zahrada'

  // Storage
  CELLAR: 'Sklep',
  BASEMENT: 'Suterén',

  // Building characteristics
  BUILDING_TYPE: 'Typ budovy',
  CONSTRUCTION: 'Stavba',
  FLOOR: 'Podlaží',
  TOTAL_FLOORS: 'Počet podlaží',
  FLOOR_COUNT: 'Počet pater',
  FLOORS_IN_BUILDING: 'Pater v domě',

  // Property details
  DISPOSITION: 'Dispozice',
  CONDITION: 'Stav objektu',
  OWNERSHIP: 'Vlastnictví',
  FURNISHED: 'Vybavení',

  // Utilities
  HEATING: 'Topení',
  HEATING_ALT: 'Vytápění',
  HEATING_EN: 'Heating',
  WATER: 'Voda',
  SEWAGE: 'Odpad',
  ELECTRICITY: 'Elektřina',
  GAS: 'Plyn',

  // Energy
  ENERGY_CLASS: 'Třída PENB',
  ENERGY_RATING: 'Energetická náročnost budovy',

  // Amenities
  ELEVATOR: 'Výtah',
  PARKING: 'Parkování',
  GARAGE: 'Garáž',

  // Year built / renovation
  YEAR_BUILT: 'Rok postavení',
  YEAR_BUILT_ALT: 'Rok výstavby',
  YEAR_COMPLETED: 'Rok kolaudace',  // Actual field the API returns (occupancy certificate year)
  RENOVATION_YEAR: 'Rok rekonstrukce',

  // Financial (rentals)
  DEPOSIT: 'Kauce',
  HOA_FEES: 'Poplatky za správu',
  UTILITY_CHARGES: 'Měsíční náklady na energie',
  SERVICE_CHARGES: 'Měsíční náklady',
  AVAILABLE_FROM: 'Datum nastěhování',
  AVAILABLE_FROM_ALT: 'Dostupné od',

  // Land-specific
  ZONING: 'Druh pozemku',
  LAND_TYPE: 'Typ pozemku',

  // Commercial-specific
  COMMERCIAL_TYPE: 'Typ nemovitosti',
  COMMERCIAL_SUBTYPE: 'Druh prostoru',

  // Dates
  AKTUALIZACE: 'Aktualizace',

  // Additional amenities
  KLIMATIZACE: 'Klimatizace',
  BAZEN: 'Bazén',
  KRB: 'Krb',
  PODKROVI: 'Podkroví',
  PUDA: 'Půda',
  BEZBARIEROVY: 'Bezbariérový',
  BEZBARIEROVA: 'Bezbariérová',
  VYSKA_STROPU: 'Výška stropu',
  VYSKA_MISTNOSTI: 'Výška místnosti',
  OPLOCENI: 'Oplocení',
  ALARM: 'Alarm',
  ZABEZPECOVACI_SYSTEM: 'Zabezpečovací systém',
  SOLARNI_PANELY: 'Solární panely',
  FOTOVOLTAIKA: 'Fotovoltaika',
  PRISTUP: 'Přístup',
  PRISTUPOVA_CESTA: 'Přístupová cesta',
  CESTA: 'Cesta',
  STAVEBNI_POVOLENI: 'Stavební povolení',
  TEREN: 'Terén',
  SVAZITOST: 'Svažitost',
  KVALITA_PUDY: 'Kvalita půdy',
  ZASTAVITELNOST: 'Zastavitelnost',
  MOZNOST_ZASTAVENI: 'Možnost zastavění',
  CISLO_PARCELY: 'Číslo parcely',
  PARCELNI_CISLO: 'Parcelní číslo',
  PARCELA: 'Parcela',
  DAN_Z_NEMOVITOSTI: 'Daň z nemovitosti',
  TYP_STRECHY: 'Typ střechy',
  STRECHA: 'Střecha',
  ZAVLAZOVANI: 'Zavlažování',
  ZAVLAZOVACI_SYSTEM: 'Zavlažovací systém',
} as const;

/**
 * Type-safe field name type derived from FIELD_NAMES constant
 */
export type FieldName = typeof FIELD_NAMES[keyof typeof FIELD_NAMES];

/**
 * Structure of items in the SReality API items array
 *
 * Example:
 * {
 *   "name": "Plocha",
 *   "value": "52",
 *   "unit": "m²",
 *   "type": "number"
 * }
 */
export interface SRealityItemField {
  name: string;
  value: any; // Can be string, number, boolean, array, or object
  unit?: string;
  type?: 'string' | 'number' | 'boolean' | 'area' | 'set';
}

/**
 * GPS coordinates structure
 */
export interface SRealityGPS {
  lat: number;
  lon: number;
}

/**
 * HAL link structure
 */
export interface SRealityLink {
  href: string;
  title?: string;
}

/**
 * Image link structure with multiple sizes
 */
export interface SRealityImageLinks {
  dynamicDown?: SRealityLink; // Thumbnail (400x300)
  dynamicUp?: SRealityLink;   // Preview (800x600)
  gallery?: SRealityLink;      // Full size
  self?: SRealityLink;
}

/**
 * Embedded image object
 */
export interface SRealityEmbeddedImage {
  _links: SRealityImageLinks;
  order?: number;
}

/**
 * Seller information from _embedded.seller
 */
export interface SRealitySeller {
  name?: string;
  phone?: string;
  email?: string;
  logo_url?: string;
  company_name?: string;
}

/**
 * Video information from _embedded.video
 */
export interface SRealityVideo {
  url?: string;
  thumbnail?: string;
}

/**
 * Locality information from _embedded.locality
 */
export interface SRealityLocality {
  value?: string;
  gps?: SRealityGPS;
}

/**
 * Note information from _embedded.note
 */
export interface SRealityNote {
  has_note?: boolean;
  note?: string | null;
  _links?: {
    self?: SRealityLink;
  };
}

/**
 * Price structure (detail endpoint)
 */
export interface SRealityPrice {
  value?: string | number;
  unit?: string;
  name?: string;
}

/**
 * SEO data structure
 */
export interface SRealitySeo {
  category_main_cb?: number;
  category_type_cb?: number;
  category_sub_cb?: string; // e.g., "byt-2-kk"
  locality?: string;
}

/**
 * Links structure from SReality API responses
 */
export interface SRealityLinks {
  self?: SRealityLink;
  dynamicUp?: SRealityLink[];
  dynamicDown?: SRealityLink[];
  iterator?: SRealityLink;
  frontend_url?: SRealityLink;
  images?: SRealityLink;
}

/**
 * Embedded data structure from SReality API responses
 */
export interface SRealityEmbedded {
  images?: SRealityEmbeddedImage[];
  note?: SRealityNote;
  seller?: SRealitySeller;
  video?: SRealityVideo;
  locality?: SRealityLocality;
  description?: {
    value?: string;
  };
}

/**
 * Complete SReality listing object (from list endpoint)
 * Based on Estate object mapping from SREALITY_API_RESPONSE_MAPPINGS.md
 */
export interface SRealityListing {
  // Basic fields
  name?: string;
  locality?: string;
  price?: number;
  new?: boolean;
  is_auction?: boolean;
  auctionPrice?: number;
  hash_id?: number;
  region_tip?: number;

  // Media flags (newly documented)
  has_panorama?: number; // 1 = true, 0 = false
  has_floor_plan?: number; // 1 = true, 0 = false
  has_video?: number;

  // Marketing
  labels?: string[]; // e.g., ["Tip", "Novinka"]
  exclusively_at_rk?: boolean;

  // Location
  gps?: SRealityGPS;

  // Detail fields (from items array)
  items?: SRealityItemField[];

  // Price detail (from detail endpoint)
  price_czk?: SRealityPrice | string; // Can be object or string depending on endpoint
  price_note?: string;

  // SEO
  seo?: SRealitySeo;

  // Meta
  advert_images_count?: number;

  // HAL structure
  _links?: SRealityLinks;
  _embedded?: SRealityEmbedded;
}

/**
 * Estate detail response (from /estates/{id} endpoint)
 */
export interface SRealityDetailResponse extends SRealityListing {
  // Additional fields only available in detail endpoint
  description?: string;
  favourite?: {
    is_favourite?: boolean;
    _links?: {
      self?: SRealityLink;
    };
  };
}

/**
 * Cluster object for map view
 */
export interface SRealityCluster {
  lat: number;
  lon: number;
  count: number;
  price_avg?: number;
  type: 'cluster' | 'marker';
  estate_id?: number;
}

/**
 * API list response structure
 */
export interface SRealityListResponse {
  _embedded?: {
    estates?: SRealityListing[];
  };
  result_size?: string | number;
  _links?: {
    self?: SRealityLink;
    iterator?: SRealityLink;
  };
}
