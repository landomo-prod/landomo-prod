export interface RawLogicImmoListing {
  id: string;
  title?: string;
  price?: number;
  currency?: string;
  url?: string;
  type?: string; // apartment, house, land, commercial
  transaction_type?: string; // sale, rent
  surface?: number;
  rooms?: number;
  bedrooms?: number;
  bathrooms?: number;
  description?: string;
  address?: {
    street?: string;
    city?: string;
    postal_code?: string;
    province?: string;
    country?: string;
    lat?: number;
    lng?: number;
  };
  features?: string[];
  images?: string[];
  floor?: number;
  total_floors?: number;
  year_built?: number;
  energy_class?: string;
  has_elevator?: boolean;
  has_balcony?: boolean;
  has_terrace?: boolean;
  has_garden?: boolean;
  has_garage?: boolean;
  has_parking?: boolean;
  has_basement?: boolean;
  garden_surface?: number;
  plot_surface?: number;
  living_surface?: number;
  condition?: string;
  heating_type?: string;
  construction_type?: string;
  furnished?: boolean;
  agent?: {
    name?: string;
    phone?: string;
    email?: string;
    agency?: string;
  };
  published_at?: string;
}

export interface RawLogicImmoSearchResponse {
  items?: RawLogicImmoListing[];
  total?: number;
  page?: number;
  totalPages?: number;
  hasMore?: boolean;
}
