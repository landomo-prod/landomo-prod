/**
 * Fotocasa API types
 */

export interface FotocasaFeature {
  key: string;
  value: number[];
  minValue: number;
  maxValue: number;
}

export interface FotocasaTransaction {
  transactionTypeId: number; // 1=sale, 2=rent
  value: number[];
  reduced: number;
  periodicityId: number;
  maxPrice: number;
  minPrice: number;
}

export interface FotocasaCoordinates {
  accuracy: number;
  latitude: number;
  longitude: number;
}

export interface FotocasaLocation {
  country: string;
  level1: string;   // Autonomous community (Cataluña, Madrid, etc.)
  level2: string;   // Province (Barcelona, Madrid, etc.)
  level3: string;   // Comarca
  level4: string;   // Zone
  level5: string;   // Municipality
  level6: string;
  level7: string;
  level8: string;
  upperLevel: string;
  countryId: number;
  level1Id: number;
  level2Id: number;
  level3Id: number;
  level4Id: number;
  level5Id: number;
  level6Id: number;
  level7Id: number;
  level8Id: number;
}

export interface FotocasaAddress {
  ubication: string;
  location: FotocasaLocation;
  coordinates: FotocasaCoordinates;
  zipCode: string;
  customZone: string | null;
}

export interface FotocasaAdvertiser {
  logo: {
    multimedia: {
      url: string;
      typeId: number;
      position: number | null;
      roomType: string | null;
    };
    url: { es: string };
  } | null;
  phone: string;
  typeId: number;
  clientId: number;
  urlAlias: string;
  clientAlias: string;
}

export interface FotocasaMultimedia {
  url: string;
  typeId: number;  // 2=image, 21=YouTube, 12=3D tour
  position: number | null;
  roomType: string | null;
}

export interface FotocasaListing {
  id: number;
  typeId: number;       // 2=vivienda, 4=terreno, 6=oficina/commercial, etc.
  subtypeId: number;    // 1=piso, 3=chalet, 5=terreno, etc.
  promotionId: number;
  promotionTypeId: number;
  isNew: boolean;
  advertiser: FotocasaAdvertiser;
  detail: { es: string };
  address: FotocasaAddress;
  features: FotocasaFeature[];
  transactions: FotocasaTransaction[];
  multimedias?: FotocasaMultimedia[];
  date: string;
  description: string;
  isTop: boolean;
  isPhotoReport: boolean;
  isVirtualTour: boolean;
  realEstateAdId: string;
  otherFeaturesCount: number;
  isCompleted: boolean | null;
  hasSubsidies: boolean;
}

export interface FotocasaSearchResponse {
  count: number;
  realEstates: FotocasaListing[];
  breadcrumb?: any;
  client: any;
}

/**
 * Fotocasa property type IDs
 * Based on API research
 */
export const FOTOCASA_PROPERTY_TYPES = {
  VIVIENDA: 2,    // Apartments + Houses
  TERRENO: 4,     // Land/plots
  OFICINA: 6,     // Offices/commercial
  GARAJE: 7,      // Garages
  LOCAL: 8,        // Retail/shops
  NAVE: 9,        // Warehouses
  TRASTERO: 10,   // Storage rooms
} as const;

/**
 * Transaction type IDs
 */
export const FOTOCASA_TRANSACTION_TYPES = {
  SALE: 1,
  RENT: 2,
} as const;

/**
 * Subtypes for viviendas (typeId=2)
 */
export const FOTOCASA_VIVIENDA_SUBTYPES = {
  PISO: 1,         // Apartment/flat
  ATICO: 2,        // Penthouse
  CHALET: 3,       // House/villa
  DUPLEX: 4,       // Duplex
  ESTUDIO: 5,      // Studio
  CASA_RURAL: 6,   // Country house
  FINCA: 7,        // Estate
} as const;

/**
 * Conservation state values from features
 */
export const CONSERVATION_STATES: Record<number, string> = {
  1: 'new_build',
  2: 'good',
  3: 'needs_renovation',
};

/**
 * Spanish autonomous communities by level1Id
 */
export const AUTONOMOUS_COMMUNITIES: Record<number, string> = {
  1: 'Andalucía',
  2: 'Aragón',
  3: 'Asturias',
  4: 'Baleares',
  5: 'Canarias',
  6: 'Cantabria',
  7: 'Castilla y León',
  8: 'Castilla-La Mancha',
  9: 'Cataluña',
  10: 'Extremadura',
  11: 'Galicia',
  12: 'La Rioja',
  13: 'Madrid',
  14: 'Murcia',
  15: 'Navarra',
  16: 'País Vasco',
  17: 'Valencia',
};
