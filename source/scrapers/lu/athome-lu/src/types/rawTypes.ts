export interface AtHomeAddress {
  street?: string;
  zip?: string;
  city?: string;
  country?: string;
  district?: string;
  region?: string;
  geohash?: string;
  pin?: {
    lat: number;
    lon: number;
  };
}

export interface AtHomeContact {
  agency?: {
    name?: string;
    logo?: string;
    phone?: string;
    email?: string;
  };
}

export interface AtHomePrices {
  min?: number;
  max?: number;
  currency?: string;
}

export interface AtHomeSurfaces {
  min?: number;
  max?: number;
  unit?: string;
}

export interface AtHomePermalink {
  fr?: string;
  en?: string;
  de?: string;
}

export interface AtHomeMedia {
  photos?: string[];
  plan?: string;
  video?: string;
  virtualVisit?: string;
  brochure?: string;
}

export interface AtHomeChild {
  id: number;
  type?: string;
  floor?: number;
  rooms?: number;
  bedrooms?: number;
  surface?: number;
  price?: number;
  status?: string;
  bathrooms?: number;
}

export interface AtHomeListingRaw {
  id: number;
  externalReference?: string;
  type?: string;
  typeKey?: string;
  typeId?: number;
  group?: string;
  groupId?: string;
  format?: string;
  permalink?: AtHomePermalink;
  isNewBuild?: boolean;
  status?: string;
  transaction?: string;
  publishTo?: string;
  createdAt?: string;
  updatedAt?: string;
  soldAt?: string | null;
  soldPrice?: number | null;
  name?: string;
  availableUnits?: number;
  address?: AtHomeAddress;
  contact?: AtHomeContact;
  media?: AtHomeMedia;
  prices?: AtHomePrices;
  rooms?: number;
  bedrooms?: number;
  surfaces?: AtHomeSurfaces;
  children?: AtHomeChild[];
  previewDescription?: string;
  previewDescriptions?: { fr?: string; en?: string; de?: string };
  // Fields available on detail endpoint
  description?: string;
  features?: string[];
  energy_class?: string;
  year_built?: number;
  condition?: string;
  heating_type?: string;
  floor?: number;
  total_floors?: number;
  has_elevator?: boolean;
  has_balcony?: boolean;
  has_parking?: boolean;
  has_basement?: boolean;
  has_garden?: boolean;
  has_garage?: boolean;
  has_terrace?: boolean;
  has_pool?: boolean;
  parking_spaces?: number;
  bathrooms?: number;
  sqm_plot?: number;
}

export interface AtHomeDetailRaw extends AtHomeListingRaw {
  detailed_description?: string;
  detailed_features?: string[];
}

export interface AtHomeSearchResponse {
  data: AtHomeListingRaw[];
}
