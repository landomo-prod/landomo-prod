/**
 * Boundary Types
 * Shared types for administrative boundaries and polygon data
 */

/**
 * Administrative boundary with geometry
 */
export interface Boundary {
  id: string;
  relationId: number; // OSM relation ID
  name: string;
  adminLevel: number | null; // 2=country, 4=region, 6=county, 8=city, 9=district, 10=neighborhood
  parentRelationId: number | null;
  geometry: any; // GeoJSON MultiPolygon or Polygon
  tags: Record<string, any>;
  names: Record<string, string>; // Multi-language names: { "en": "Prague", "cs": "Praha" }
  boundaryType?: string; // country, region, city, district, neighborhood
  countryCode?: string; // ISO 3166-1 alpha-3
}

/**
 * Simplified boundary without geometry (for search results)
 */
export interface BoundarySummary {
  id: string;
  relationId: number;
  name: string;
  adminLevel: number | null;
  boundaryType?: string;
  countryCode?: string;
  bbox?: BoundingBox;
  centroid?: Point;
}

/**
 * Bounding box
 */
export interface BoundingBox {
  minLat: number;
  minLon: number;
  maxLat: number;
  maxLon: number;
}

/**
 * Geographic point
 */
export interface Point {
  lat: number;
  lon: number;
}

/**
 * Point-in-polygon query request
 */
export interface PointInPolygonRequest {
  lat: number;
  lon: number;
  adminLevel?: number;
  countryCode?: string;
}

/**
 * Point-in-polygon query response
 */
export interface PointInPolygonResponse {
  data: Boundary[];
  cached: boolean;
}

/**
 * Boundary search request
 */
export interface BoundarySearchRequest {
  name: string;
  adminLevel?: number;
  countryCode?: string;
  limit?: number;
}

/**
 * Property-boundary association
 */
export interface PropertyBoundaryAssociation {
  propertyId: string;
  boundaryId: string;
  boundaryType: 'country' | 'region' | 'city' | 'district' | 'neighborhood' | 'postal_code';
  confidence: 'high' | 'medium' | 'low';
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Polygon service API client configuration
 */
export interface PolygonServiceConfig {
  baseUrl: string;
  apiKey: string;
  timeout?: number;
}

/**
 * Overpass sync request
 */
export interface OverpassSyncRequest {
  countryCode: string; // ISO 3166-1 alpha-2 (CZ, SK, HU, etc.)
  adminLevels?: number[]; // Default: [2, 4, 6, 8, 9, 10]
  skipRecent?: boolean; // Skip areas updated in last 30 days
  force?: boolean; // Force re-sync even if recently updated
}

/**
 * Overpass sync response
 */
export interface OverpassSyncResponse {
  success: boolean;
  countryCode: string;
  areasProcessed: number;
  areasSkipped: number;
  areasCreated: number;
  areasUpdated: number;
  errors: string[];
  durationMs: number;
}
