/**
 * Advanced Database Queries
 *
 * Implements radius search, property details, aggregations for GraphQL API.
 * Uses the partitioned properties table with PostGIS for spatial queries.
 */

import { Pool } from 'pg';
import { PropertyFilters, buildFilterClauses } from './filter-builder';

export interface RadiusSearchResult {
  id: string;
  title: string;
  price: number;
  currency: string;
  propertyCategory: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
  thumbnailUrl?: string;
  bedrooms?: number;
  sqm?: number;
}

export interface PropertyDetail {
  id: string;
  portal: string;
  portalId: string;
  title: string;
  price: number;
  currency: string;
  propertyCategory: string;
  transactionType: string;
  status: string;
  description?: string;
  sourceUrl: string;
  sourcePlatform: string;
  // Location
  city?: string;
  region?: string;
  country: string;
  latitude?: number;
  longitude?: number;
  geohash?: string;
  location?: any;
  // Category-specific
  bedrooms?: number;
  bathrooms?: number;
  sqm?: number;
  floor?: number;
  totalFloors?: number;
  hasElevator?: boolean;
  hasBalcony?: boolean;
  hasParking?: boolean;
  hasBasement?: boolean;
  hasGarden?: boolean;
  hasGarage?: boolean;
  sqmPlot?: number;
  // Media & agent
  media?: any;
  agent?: any;
  // Metadata
  countrySpecific?: any;
  portalMetadata?: any;
  createdAt?: string;
  updatedAt?: string;
}

export interface PropertyStats {
  totalCount: number;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  medianPrice: number;
  categoryDistribution: Record<string, number>;
  transactionDistribution: Record<string, number>;
}

/**
 * Radius search using PostGIS ST_DWithin
 */
export async function radiusSearch(
  pool: Pool,
  centerLat: number,
  centerLon: number,
  radiusKm: number,
  filters?: PropertyFilters,
  sortBy?: string,
  limit: number = 100,
  offset: number = 0
): Promise<{ results: RadiusSearchResult[]; total: number }> {
  const radiusMeters = radiusKm * 1000;
  // $1=lon, $2=lat, $3=radius_meters, filters start at $4
  const filterResult = buildFilterClauses(filters, 4);

  const sql = `
    WITH matched AS (
      SELECT
        p.id,
        p.title,
        p.price,
        p.currency,
        p.property_category,
        p.latitude,
        p.longitude,
        p.media->'images'->0 as thumbnail_url,
        CASE p.property_category
          WHEN 'apartment' THEN p.apt_bedrooms
          WHEN 'house' THEN p.house_bedrooms
          ELSE NULL
        END as bedrooms,
        CASE p.property_category
          WHEN 'apartment' THEN p.apt_sqm
          WHEN 'house' THEN p.house_sqm_living
          WHEN 'land' THEN p.land_area_plot_sqm
          WHEN 'commercial' THEN p.comm_floor_area
        END as sqm,
        d.distance_km
      FROM properties p,
      LATERAL (
        SELECT ST_Distance(
          geography(ST_SetSRID(ST_MakePoint(p.longitude::float8, p.latitude::float8), 4326)),
          geography(ST_SetSRID(ST_MakePoint($1, $2), 4326))
        ) / 1000.0 AS distance_km
      ) d
      WHERE
        p.latitude IS NOT NULL
        AND p.longitude IS NOT NULL
        AND p.status = 'active'
        AND d.distance_km <= $3 / 1000.0
        ${filterResult.sql}
    )
    SELECT *, COUNT(*) OVER() as total_count
    FROM matched
    ORDER BY ${getRadiusSortClause(sortBy)}
    LIMIT ${limit} OFFSET ${offset}
  `;

  const params = [centerLon, centerLat, radiusMeters, ...filterResult.params];
  const result = await pool.query(sql, params);

  const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;

  return {
    total,
    results: result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      price: parseFloat(row.price),
      currency: row.currency,
      propertyCategory: row.property_category,
      latitude: parseFloat(row.latitude),
      longitude: parseFloat(row.longitude),
      distanceKm: parseFloat(row.distance_km),
      thumbnailUrl: row.thumbnail_url ? String(row.thumbnail_url).replace(/^"|"$/g, '') : undefined,
      bedrooms: row.bedrooms,
      sqm: row.sqm ? parseFloat(row.sqm) : undefined,
    })),
  };
}

function getRadiusSortClause(sortBy?: string): string {
  switch (sortBy) {
    case 'PRICE_ASC': return 'price ASC NULLS LAST';
    case 'PRICE_DESC': return 'price DESC NULLS LAST';
    case 'DATE_DESC': return 'created_at DESC';
    case 'DISTANCE_ASC': return 'distance_km ASC';
    default: return 'distance_km ASC';
  }
}

/**
 * Get full property details by ID
 */
export async function getPropertyDetail(
  pool: Pool,
  propertyId: string
): Promise<PropertyDetail | null> {
  const sql = `
    SELECT
      id, portal, portal_id, title, price, currency,
      property_category, transaction_type, status,
      description, source_url, source_platform,
      city, region, country, latitude, longitude, geohash,
      location,
      -- Apartment fields
      apt_bedrooms, apt_bathrooms, apt_sqm, apt_floor, apt_total_floors,
      apt_has_elevator, apt_has_balcony, apt_has_parking, apt_has_basement,
      -- House fields
      house_bedrooms, house_bathrooms, house_sqm_living, house_sqm_plot,
      house_has_garden, house_has_garage, house_has_parking, house_has_basement,
      -- Land fields
      land_area_plot_sqm,
      -- Commercial fields
      comm_floor_area, comm_has_elevator, comm_has_parking,
      comm_property_subtype,
      -- Meta
      media, agent, country_specific, portal_metadata,
      created_at, updated_at
    FROM properties
    WHERE id = $1
  `;

  const result = await pool.query(sql, [propertyId]);
  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  const cat = row.property_category;

  return {
    id: row.id,
    portal: row.portal,
    portalId: row.portal_id,
    title: row.title,
    price: parseFloat(row.price),
    currency: row.currency,
    propertyCategory: row.property_category,
    transactionType: row.transaction_type,
    status: row.status,
    description: row.description,
    sourceUrl: row.source_url,
    sourcePlatform: row.source_platform,
    city: row.city,
    region: row.region,
    country: row.country,
    latitude: row.latitude ? parseFloat(row.latitude) : undefined,
    longitude: row.longitude ? parseFloat(row.longitude) : undefined,
    geohash: row.geohash,
    location: row.location,
    bedrooms: cat === 'apartment' ? row.apt_bedrooms : cat === 'house' ? row.house_bedrooms : undefined,
    bathrooms: cat === 'apartment' ? row.apt_bathrooms : cat === 'house' ? row.house_bathrooms : undefined,
    sqm: cat === 'apartment' ? row.apt_sqm : cat === 'house' ? row.house_sqm_living : cat === 'commercial' ? row.comm_floor_area : cat === 'land' ? row.land_area_plot_sqm : undefined,
    floor: cat === 'apartment' ? row.apt_floor : undefined,
    totalFloors: cat === 'apartment' ? row.apt_total_floors : undefined,
    hasElevator: cat === 'apartment' ? row.apt_has_elevator : cat === 'commercial' ? row.comm_has_elevator : undefined,
    hasBalcony: cat === 'apartment' ? row.apt_has_balcony : undefined,
    hasParking: cat === 'apartment' ? row.apt_has_parking : cat === 'house' ? row.house_has_parking : cat === 'commercial' ? row.comm_has_parking : undefined,
    hasBasement: cat === 'apartment' ? row.apt_has_basement : cat === 'house' ? row.house_has_basement : undefined,
    hasGarden: cat === 'house' ? row.house_has_garden : undefined,
    hasGarage: cat === 'house' ? row.house_has_garage : undefined,
    sqmPlot: cat === 'house' ? row.house_sqm_plot : cat === 'land' ? row.land_area_plot_sqm : undefined,
    media: row.media,
    agent: row.agent,
    countrySpecific: row.country_specific,
    portalMetadata: row.portal_metadata,
    createdAt: row.created_at?.toISOString(),
    updatedAt: row.updated_at?.toISOString(),
  };
}

/**
 * Get property statistics/aggregations for a bounding box
 */
export async function getPropertyStats(
  pool: Pool,
  bounds: { north: number; south: number; east: number; west: number },
  filters?: PropertyFilters
): Promise<PropertyStats> {
  const filterResult = buildFilterClauses(filters, 5);

  const statsSql = `
    SELECT
      COUNT(*)::int as total_count,
      COALESCE(AVG(price), 0)::numeric as avg_price,
      COALESCE(MIN(price), 0)::numeric as min_price,
      COALESCE(MAX(price), 0)::numeric as max_price,
      COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price), 0) as median_price
    FROM properties
    WHERE
      status = 'active'
      AND latitude BETWEEN $1 AND $2
      AND longitude BETWEEN $3 AND $4
      ${filterResult.sql}
  `;

  const catSql = `
    SELECT property_category, COUNT(*)::int as count
    FROM properties
    WHERE
      status = 'active'
      AND latitude BETWEEN $1 AND $2
      AND longitude BETWEEN $3 AND $4
      ${filterResult.sql}
    GROUP BY property_category
  `;

  const txnSql = `
    SELECT transaction_type, COUNT(*)::int as count
    FROM properties
    WHERE
      status = 'active'
      AND latitude BETWEEN $1 AND $2
      AND longitude BETWEEN $3 AND $4
      ${filterResult.sql}
    GROUP BY transaction_type
  `;

  const baseParams = [bounds.south, bounds.north, bounds.west, bounds.east, ...filterResult.params];

  const [statsResult, catResult, txnResult] = await Promise.all([
    pool.query(statsSql, baseParams),
    pool.query(catSql, baseParams),
    pool.query(txnSql, baseParams),
  ]);

  const stats = statsResult.rows[0];
  const categoryDistribution: Record<string, number> = {};
  catResult.rows.forEach((row) => {
    categoryDistribution[row.property_category] = row.count;
  });

  const transactionDistribution: Record<string, number> = {};
  txnResult.rows.forEach((row) => {
    transactionDistribution[row.transaction_type] = row.count;
  });

  return {
    totalCount: stats.total_count,
    avgPrice: parseFloat(stats.avg_price),
    minPrice: parseFloat(stats.min_price),
    maxPrice: parseFloat(stats.max_price),
    medianPrice: parseFloat(stats.median_price),
    categoryDistribution,
    transactionDistribution,
  };
}
