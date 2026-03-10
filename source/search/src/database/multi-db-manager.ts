/**
 * Multi-Database Manager
 *
 * Manages connections to all country databases with read-only access.
 * Supports parallel queries across multiple databases.
 */

import { Pool, QueryResult } from 'pg';
import { config } from '../config';
import { getAllCountries } from '../countries';
import { dbLog } from '../logger';

// Map of country code to database connection pool
const countryPools = new Map<string, Pool>();

/**
 * Initialize database connections for all countries
 */
export function initializeConnections(): void {
  const countries = getAllCountries();

  dbLog.info({ count: countries.length }, 'Initializing database connections');

  countries.forEach(country => {
    const pool = new Pool({
      host: config.database.host,
      port: config.database.port,
      user: config.database.readOnlyUser,
      password: config.database.readOnlyPassword,
      database: country.database,
      max: config.database.maxConnections,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    // Handle pool errors
    pool.on('error', (err) => {
      dbLog.error({ err, country: country.code }, 'Database pool error');
    });

    countryPools.set(country.code, pool);
    dbLog.info({ country: country.code, database: country.database }, 'Connected to database');
  });

  dbLog.info('All database connections initialized');
}

/**
 * Get connection pool for a specific country
 *
 * @param countryCode - Country code (e.g., 'czech', 'uk')
 * @returns Database connection pool
 * @throws Error if country not found
 */
export function getCountryPool(countryCode: string): Pool {
  const pool = countryPools.get(countryCode.toLowerCase());
  if (!pool) {
    throw new Error(`No database connection for country: ${countryCode}`);
  }
  return pool;
}

/**
 * Query a single country database
 *
 * @param countryCode - Country code
 * @param sql - SQL query
 * @param params - Query parameters
 * @returns Query result
 */
export async function queryCountry(
  countryCode: string,
  sql: string,
  params: any[]
): Promise<QueryResult> {
  const pool = getCountryPool(countryCode);
  return pool.query(sql, params);
}

/**
 * Query result with country context
 */
export interface CountryQueryResult {
  country: string;
  result?: QueryResult;
  error?: Error;
}

/**
 * Query multiple countries in parallel
 *
 * @param countries - Array of country codes
 * @param sql - SQL query
 * @param params - Query parameters
 * @returns Map of country code to query result
 */
export async function queryCountries(
  countries: string[],
  sql: string,
  params: any[]
): Promise<Map<string, CountryQueryResult>> {
  const queries = countries.map(async (country) => {
    try {
      const result = await queryCountry(country, sql, params);
      return { country, result };
    } catch (error) {
      return { country, error: error as Error };
    }
  });

  const results = await Promise.all(queries);
  return new Map(results.map(r => [r.country, r]));
}

/**
 * Query all countries in parallel
 *
 * @param sql - SQL query
 * @param params - Query parameters
 * @returns Map of country code to query result
 */
export async function queryAllCountries(
  sql: string,
  params: any[]
): Promise<Map<string, CountryQueryResult>> {
  const countries = getAllCountries().map(c => c.code);
  return queryCountries(countries, sql, params);
}

/**
 * Get a single property by ID from a specific country
 *
 * @param countryCode - Country code
 * @param propertyId - Property UUID
 * @returns Property data or null
 */
export async function getPropertyById(
  countryCode: string,
  propertyId: string
): Promise<any | null> {
  const sql = `
    SELECT
      id,
      portal,
      portal_id,
      title,
      price,
      currency,
      property_type,
      property_category,
      transaction_type,
      city,
      region,
      country,
      district,
      neighbourhood,
      municipality,
      bedrooms,
      bathrooms,
      COALESCE(apt_sqm, house_sqm_living, comm_floor_area, land_area_plot_sqm) AS sqm,
      COALESCE(apt_floor, comm_floor_number) AS floor,
      latitude,
      longitude,
      COALESCE(has_parking, apt_has_parking, house_has_parking, comm_has_parking) AS has_parking,
      COALESCE(has_balcony, apt_has_balcony, house_has_balcony) AS has_balcony,
      has_pool,
      COALESCE(has_garden, house_has_garden) AS has_garden,
      COALESCE(has_terrace, apt_has_terrace, house_has_terrace) AS has_terrace,
      COALESCE(has_elevator, apt_has_elevator, comm_has_elevator) AS has_elevator,
      COALESCE(has_garage, apt_has_garage, house_has_garage) AS has_garage,
      condition,
      heating_type,
      furnished,
      construction_type,
      year_built,
      COALESCE(apt_energy_class, house_energy_class, comm_energy_class, energy_rating) AS energy_class,
      rooms,
      renovation_year,
      available_from,
      deposit,
      is_commission,
      commission_note,
      parking_spaces,
      published_date,
      COALESCE(has_basement, apt_has_basement, house_has_basement) AS has_basement,
      price_per_sqm,
      source_url,
      source_platform,
      czech_disposition,
      czech_ownership,
      uk_tenure,
      uk_council_tax_band,
      uk_epc_rating,
      uk_leasehold_years_remaining,
      usa_mls_number,
      australia_land_size_sqm,
      portal_metadata,
      portal_features,
      images,
      description,
      agent_name,
      agent_phone,
      agent_email,
      created_at,
      updated_at,
      status,
      -- Apartment-specific detail fields
      apt_sqm,
      apt_floor,
      apt_total_floors,
      apt_rooms,
      apt_bedrooms,
      apt_bathrooms,
      apt_has_loggia,
      apt_loggia_area,
      apt_balcony_area,
      apt_terrace_area,
      apt_cellar_area,
      apt_hoa_fees,
      apt_energy_class,
      apt_has_basement,
      -- House-specific detail fields
      house_sqm_living,
      house_sqm_total,
      house_sqm_plot,
      house_stories,
      house_rooms,
      house_bedrooms,
      house_bathrooms,
      house_garden_area,
      house_terrace_area,
      house_garage_count,
      house_cellar_area,
      house_energy_class,
      house_year_built,
      house_roof_type,
      house_has_basement,
      house_balcony_area,
      house_has_fireplace,
      house_has_attic,
      house_has_pool,
      house_property_subtype,
      house_service_charges,
      -- Land-specific detail fields
      land_area_plot_sqm,
      land_zoning,
      land_water_supply,
      land_sewage,
      land_electricity,
      land_gas,
      land_road_access,
      land_building_permit,
      land_property_subtype,
      -- Apartment extra detail fields
      apt_property_subtype,
      apt_floor_location,
      apt_service_charges,
      -- Commercial-specific detail fields
      comm_floor_area,
      comm_property_subtype,
      comm_floor_number,
      comm_total_floors,
      comm_ceiling_height,
      comm_has_loading_bay,
      comm_has_reception,
      comm_energy_class,
      comm_service_charges
    FROM properties
    WHERE id = $1 AND status = 'active'
  `;

  const result = await queryCountry(countryCode, sql, [propertyId]);
  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Search for a property across all countries by portal_id
 *
 * @param portal - Portal name
 * @param portalId - Portal-specific ID
 * @returns Property data with country, or null
 */
export async function findPropertyByPortalId(
  portal: string,
  portalId: string
): Promise<{ country: string; property: any } | null> {
  const sql = `
    SELECT *
    FROM properties
    WHERE portal = $1 AND portal_id = $2 AND status = 'active'
    LIMIT 1
  `;

  const results = await queryAllCountries(sql, [portal, portalId]);

  for (const [country, queryResult] of results.entries()) {
    if (queryResult.result && queryResult.result.rows.length > 0) {
      return {
        country,
        property: queryResult.result.rows[0]
      };
    }
  }

  return null;
}

/**
 * Test database connections
 *
 * @returns Object with connection status for each country
 */
export async function testConnections(): Promise<Record<string, boolean>> {
  const status: Record<string, boolean> = {};
  const countries = getAllCountries();

  for (const country of countries) {
    try {
      const pool = getCountryPool(country.code);
      await pool.query('SELECT 1');
      status[country.code] = true;
    } catch (error) {
      dbLog.error({ err: error, country: country.code }, 'Connection test failed');
      status[country.code] = false;
    }
  }

  return status;
}

/**
 * Close all database connections
 */
export async function closeAllConnections(): Promise<void> {
  dbLog.info('Closing all database connections');

  const closePromises = Array.from(countryPools.entries()).map(
    async ([country, pool]) => {
      try {
        await pool.end();
        dbLog.info({ country }, 'Closed connection');
      } catch (error) {
        dbLog.error({ err: error, country }, 'Error closing connection');
      }
    }
  );

  await Promise.all(closePromises);
  countryPools.clear();

  dbLog.info('All connections closed');
}

/**
 * Get connection pool stats
 */
export function getPoolStats(): Record<string, any> {
  const stats: Record<string, any> = {};

  countryPools.forEach((pool, country) => {
    stats[country] = {
      total: pool.totalCount,
      idle: pool.idleCount,
      waiting: pool.waitingCount
    };
  });

  return stats;
}
