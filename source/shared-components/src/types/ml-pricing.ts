/** ML Pricing Service Types */

export interface PredictionRequest {
  country: string;
  property_category: 'apartment' | 'house' | 'land' | 'commercial';
  features: PropertyFeatures;
  options?: PredictionOptions;
}

export interface PredictionOptions {
  include_confidence?: boolean;
}

export interface PredictionResponse {
  predicted_price: number;
  currency: string;
  confidence_interval?: ConfidenceInterval;
  prediction_metadata: PredictionMetadata;
}

export interface ConfidenceInterval {
  lower: number;
  upper: number;
  confidence_level: number;
}

export interface PredictionMetadata {
  model_version: string;
  trained_at: string;
  feature_count: number;
  prediction_time_ms: number;
  cache_hit: boolean;
}

export interface ApartmentFeatures {
  bedrooms?: number;
  sqm: number;
  floor?: number;
  has_elevator?: boolean;
  has_balcony?: boolean;
  has_parking?: boolean;
  has_basement?: boolean;
  city: string;
  latitude?: number;
  longitude?: number;
  year_built?: number;
}

export interface HouseFeatures {
  bedrooms?: number;
  sqm_living: number;
  sqm_plot?: number;
  has_garden?: boolean;
  has_garage?: boolean;
  has_parking?: boolean;
  has_basement?: boolean;
  city: string;
  latitude?: number;
  longitude?: number;
  year_built?: number;
}

export interface LandFeatures {
  area_plot_sqm: number;
  zoning?: string;
  city: string;
  latitude?: number;
  longitude?: number;
}

export interface CommercialFeatures {
  sqm_total: number;
  property_subtype?: string;
  has_elevator?: boolean;
  has_parking?: boolean;
  city: string;
  latitude?: number;
  longitude?: number;
  year_built?: number;
}

export type PropertyFeatures =
  | ApartmentFeatures
  | HouseFeatures
  | LandFeatures
  | CommercialFeatures;

export interface ModelInfo {
  country: string;
  property_category: string;
  model_version: string;
  model_type: string;
  trained_at: string;
  status: string;
  metrics: ModelMetrics;
  training_samples: number;
  feature_count: number;
  data_coverage: DataCoverage;
}

export interface ModelMetrics {
  mae: number;
  rmse: number;
  r2: number;
  mape: number;
}

export interface DataCoverage {
  active_listings: number;
  avg_price: number;
  median_price: number;
}
