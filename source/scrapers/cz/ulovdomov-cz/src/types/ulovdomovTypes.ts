/**
 * UlovDomov.cz API response types - based on real API inspection
 */

export interface UlovDomovPhoto {
  id: number;
  path: string;
  alt: string;
}

export interface UlovDomovPrice {
  value: number;
  currency: string;
}

export interface UlovDomovLocation {
  id: number;
  title: string;
}

export interface UlovDomovGeoCoordinates {
  lat: number;
  lng: number;
}

/**
 * Detail page parameter with options array (from __NEXT_DATA__)
 * Example: { options: [{ id: "brick", title: "Cihlová" }] }
 */
export interface UlovDomovParamOptions {
  options?: { id: string; title?: string }[];
}

/**
 * Detail page parameter with a value (from __NEXT_DATA__)
 * Example: { value: "22 m2" } or { value: 3 }
 */
export interface UlovDomovParamValue {
  value?: string | number;
}

/**
 * Structured parameters from the detail page __NEXT_DATA__ blob.
 * Not all parameters are present on every listing.
 */
export interface UlovDomovDetailParameters {
  energyEfficiencyRating?: UlovDomovParamOptions;
  buildingCondition?: UlovDomovParamOptions;
  material?: UlovDomovParamOptions;
  furnished?: UlovDomovParamOptions;
  ownership?: UlovDomovParamOptions;
  heating?: UlovDomovParamOptions;
  floors?: UlovDomovParamValue;
  acceptanceYear?: UlovDomovParamValue;
  reconstructionYear?: UlovDomovParamValue;
  floorArea?: UlovDomovParamValue;
  estateArea?: UlovDomovParamValue;
  gardenArea?: UlovDomovParamValue;
  readyDate?: UlovDomovParamValue;
  lift?: UlovDomovParamValue;
  pool?: UlovDomovParamValue;
  loft?: UlovDomovParamValue;
  lowEnergy?: UlovDomovParamValue;
  wheelchairAccessible?: UlovDomovParamValue;
  gas?: UlovDomovParamOptions;
  gully?: UlovDomovParamOptions;
  water?: UlovDomovParamOptions;
  objectType?: UlovDomovParamOptions;
  objectLocation?: UlovDomovParamOptions;
}

/**
 * Owner/agent info from the detail page __NEXT_DATA__ blob.
 */
export interface UlovDomovDetailOwner {
  firstName?: string;
  surname?: string;
  phone?: string;
  type?: string;
  photo?: string;
}

/**
 * Detail page data extracted from __NEXT_DATA__ → props.pageProps
 */
export interface UlovDomovDetailData {
  parameters?: UlovDomovDetailParameters;
  owner?: UlovDomovDetailOwner;
  district?: { name?: string };
  region?: { name?: string };
  publishedAt?: string;
  matterportUrl?: string;
}

export interface UlovDomovOffer {
  id: number;
  title: string;
  area: number;
  description: string;
  disposition: string | null;  // camelCase: "onePlusKk", "twoPlusOne", etc.
  houseType: string | null;    // "familyHouse", "villa", etc.
  geoCoordinates: UlovDomovGeoCoordinates | null;
  photos: UlovDomovPhoto[];
  rentalPrice: UlovDomovPrice | null;  // Used for both rent and sale prices
  isNoCommission: boolean;
  depositPrice: UlovDomovPrice | null;
  monthlyFeesPrice: UlovDomovPrice | null;
  priceUnit: 'perMonth' | 'perRealEstate' | string;
  published: string;
  seo: string;
  street: UlovDomovLocation | null;
  village: UlovDomovLocation | null;
  villagePart: UlovDomovLocation | null;
  convenience: string[];     // flat amenities: "balcony", "terrace", "cellar", etc.
  houseConvenience: string[]; // house amenities: "garden", "garage", "cellar", "parking"
  floorLevel: number | null;
  availableFrom: string | null;
  priceNote: string | null;
  offerType: 'rent' | 'sale' | 'coliving' | string;
  propertyType: 'flat' | 'house' | 'room' | 'land' | 'commercial' | string;
  absoluteUrl: string;
  isTop: boolean;
  showScamWarn: boolean;

  /** Detail page data, merged after fetching the detail page */
  _detail?: UlovDomovDetailData;
}

export interface UlovDomovFindResponse {
  success: boolean;
  extraData: {
    total: number;
    totalPages: number;
    perPage: number;
    currentPage: number;
  };
  data: {
    offers: UlovDomovOffer[];
  };
  error?: string;
}

export interface UlovDomovCountResponse {
  success: boolean;
  data: {
    count: number;
  };
  error?: string;
}

/** Czech Republic bounding box */
export const CZ_BOUNDS = {
  northEast: { lat: 51.06, lng: 18.87 },
  southWest: { lat: 48.55, lng: 12.09 }
};

export type UlovDomovOfferType = 'rent' | 'sale' | 'coliving';
