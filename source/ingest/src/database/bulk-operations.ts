/**
 * Bulk Database Operations
 * High-performance batch inserts/updates
 */

import { Pool } from 'pg';
import { IngestionPayload, ApartmentPropertyTierI, HousePropertyTierI, LandPropertyTierI, CommercialPropertyTierI, OtherPropertyTierI, StandardProperty, PropertyChangeEvent, PropertyFilterSnapshot, PropertyEventType, PropertyCategory } from '@landomo/core';
import { openInitialStatusPeriod, bulkOpenInitialStatusPeriods, reactivateProperty, recordScraperStatusChange } from './staleness-operations';
import { findPotentialDuplicates, linkDuplicate, PORTAL_PRIORITY, PartitionTable } from './dedup-operations';
import { dbLog } from '../logger';
import { getCoreDatabase } from './manager';
import { lookupGeoEnrichment } from '../services/district-lookup';

/**
 * Country-specific fields that scrapers may attach directly to the data object
 * (not nested under country_specific). Used for type-safe access in extractRowParams.
 */
interface CountryFieldsOnData {
  czech_disposition?: string;
  czech_ownership?: string;
  slovak_disposition?: string;
  slovak_ownership?: string;
  hungarian_room_count?: number;
  hungarian_ownership?: string;
  german_ownership?: string;
  german_hausgeld?: number;
  german_courtage?: string;
  german_kfw_standard?: string;
  german_is_denkmalschutz?: boolean;
  austrian_ownership?: string;
  austrian_operating_costs?: number;
  austrian_heating_costs?: number;
  france_dpe_rating?: string;
  france_ges_rating?: string;
  france_copropriete?: boolean;
  france_charges_copro?: number;
  spain_ibi_annual?: number;
  spain_community_fees?: number;
  spain_cedula_habitabilidad?: boolean;
  uk_tenure?: string;
  uk_council_tax_band?: string;
  uk_epc_rating?: string;
  uk_leasehold_years_remaining?: number;
}

/**
 * Extended fields that may exist on category TierI types at runtime
 * but are not part of the base interface (external_source_url, etc.)
 */
interface ExternalFields {
  external_source_url?: string;
}

export interface BulkInsertResult {
  inserted: number;
  updated: number;
  duration: number;
  changes: PropertyChangeEvent[];
}

/**
 * Convert Unix timestamp (seconds or milliseconds) to Date object for PostgreSQL
 * @param value - Can be number, string, Date, or null/undefined
 * @returns Date object or null
 */
function convertToPostgresDate(value: any): Date | null {
  if (!value) return null;

  // Already a Date object
  if (value instanceof Date) return value;

  // Unix timestamp as number
  if (typeof value === 'number') {
    // If timestamp is in seconds (< year 3000 in milliseconds), convert to milliseconds
    const timestamp = value < 10000000000 ? value * 1000 : value;
    return new Date(timestamp);
  }

  // String: could be numeric timestamp or ISO date
  if (typeof value === 'string') {
    // Only treat as numeric timestamp if entire string is digits
    if (/^\d+$/.test(value)) {
      const numValue = parseInt(value, 10);
      const timestamp = numValue < 10000000000 ? numValue * 1000 : numValue;
      return new Date(timestamp);
    }
    // Try parsing as ISO date string (e.g., "2026-03-01", "2026-03-01T12:00:00Z")
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }

  return null;
}

// Number of columns per row in the INSERT statement
const COLS_PER_ROW = 87;

const COLUMN_NAMES = `
  portal_id, portal, source_url, title, price, currency, property_type, transaction_type,
  address, city, region, country, postal_code, latitude, longitude,
  bedrooms, bathrooms, sqm, floor, rooms, year_built,
  images, videos, features, description, description_language,
  agent_name, agent_phone, agent_email, agent_agency, agent_agency_logo,
  has_parking, has_garden, has_balcony, has_terrace, has_pool, has_elevator,
  has_garage, has_basement, has_fireplace, is_furnished, is_new_construction, is_luxury,
  energy_rating,
  condition, heating_type, furnished, construction_type, renovation_year,
  available_from, published_date, deposit, parking_spaces,
  price_per_sqm, hoa_fees, property_tax,
  country_specific, raw_data,
  czech_disposition, czech_ownership, portal_metadata, portal_features, portal_ui_config,
  slovak_disposition, slovak_ownership,
  hungarian_room_count, hungarian_ownership,
  german_ownership, german_hausgeld, german_courtage, german_kfw_standard, german_is_denkmalschutz,
  austrian_ownership, austrian_operating_costs, austrian_heating_costs,
  france_dpe_rating, france_ges_rating, france_copropriete, france_charges_copro,
  spain_ibi_annual, spain_community_fees, spain_cedula_habitabilidad,
  uk_tenure, uk_council_tax_band, uk_epc_rating, uk_leasehold_years_remaining,
  last_scrape_run_id
`.replace(/\n/g, ' ').trim();

const ON_CONFLICT_SET = `
  source_url = EXCLUDED.source_url,
  title = EXCLUDED.title,
  price = EXCLUDED.price,
  description = EXCLUDED.description,
  description_language = EXCLUDED.description_language,
  images = EXCLUDED.images,
  videos = EXCLUDED.videos,
  features = EXCLUDED.features,
  agent_name = EXCLUDED.agent_name,
  agent_phone = EXCLUDED.agent_phone,
  agent_email = EXCLUDED.agent_email,
  agent_agency = EXCLUDED.agent_agency,
  has_parking = EXCLUDED.has_parking,
  has_garden = EXCLUDED.has_garden,
  has_balcony = EXCLUDED.has_balcony,
  has_terrace = EXCLUDED.has_terrace,
  has_pool = EXCLUDED.has_pool,
  has_elevator = EXCLUDED.has_elevator,
  has_garage = EXCLUDED.has_garage,
  has_basement = EXCLUDED.has_basement,
  has_fireplace = EXCLUDED.has_fireplace,
  is_furnished = EXCLUDED.is_furnished,
  is_new_construction = EXCLUDED.is_new_construction,
  is_luxury = EXCLUDED.is_luxury,
  energy_rating = EXCLUDED.energy_rating,
  condition = EXCLUDED.condition,
  heating_type = EXCLUDED.heating_type,
  furnished = EXCLUDED.furnished,
  construction_type = EXCLUDED.construction_type,
  renovation_year = EXCLUDED.renovation_year,
  available_from = EXCLUDED.available_from,
  published_date = EXCLUDED.published_date,
  deposit = EXCLUDED.deposit,
  parking_spaces = EXCLUDED.parking_spaces,
  country_specific = EXCLUDED.country_specific,
  raw_data = EXCLUDED.raw_data,
  czech_disposition = EXCLUDED.czech_disposition,
  czech_ownership = EXCLUDED.czech_ownership,
  portal_metadata = EXCLUDED.portal_metadata,
  portal_features = EXCLUDED.portal_features,
  portal_ui_config = EXCLUDED.portal_ui_config,
  slovak_disposition = EXCLUDED.slovak_disposition,
  slovak_ownership = EXCLUDED.slovak_ownership,
  hungarian_room_count = EXCLUDED.hungarian_room_count,
  hungarian_ownership = EXCLUDED.hungarian_ownership,
  german_ownership = EXCLUDED.german_ownership,
  german_hausgeld = EXCLUDED.german_hausgeld,
  german_courtage = EXCLUDED.german_courtage,
  german_kfw_standard = EXCLUDED.german_kfw_standard,
  german_is_denkmalschutz = EXCLUDED.german_is_denkmalschutz,
  austrian_ownership = EXCLUDED.austrian_ownership,
  austrian_operating_costs = EXCLUDED.austrian_operating_costs,
  austrian_heating_costs = EXCLUDED.austrian_heating_costs,
  france_dpe_rating = EXCLUDED.france_dpe_rating,
  france_ges_rating = EXCLUDED.france_ges_rating,
  france_copropriete = EXCLUDED.france_copropriete,
  france_charges_copro = EXCLUDED.france_charges_copro,
  spain_ibi_annual = EXCLUDED.spain_ibi_annual,
  spain_community_fees = EXCLUDED.spain_community_fees,
  spain_cedula_habitabilidad = EXCLUDED.spain_cedula_habitabilidad,
  uk_tenure = EXCLUDED.uk_tenure,
  uk_council_tax_band = EXCLUDED.uk_council_tax_band,
  uk_epc_rating = EXCLUDED.uk_epc_rating,
  uk_leasehold_years_remaining = EXCLUDED.uk_leasehold_years_remaining,
  last_scrape_run_id = EXCLUDED.last_scrape_run_id,
  status = 'active',
  last_seen_at = NOW(),
  last_updated_at = NOW(),
  updated_at = NOW()
`.trim();

/**
 * Extract the parameter values for a single property row
 */
function extractRowParams(prop: IngestionPayload): unknown[] {
  // Cast data once with proper intersection type for country-specific fields
  const data = prop.data as StandardProperty & CountryFieldsOnData;
  return [
    prop.portal_id,
    prop.portal,
    data.source_url || `http://example.com/${prop.portal_id}`,
    data.title,
    data.price,
    data.currency,
    data.property_type,
    data.transaction_type,
    data.location?.address,
    data.location?.city,
    data.location?.region,
    data.location?.country || prop.country,
    data.location?.postal_code,
    data.location?.coordinates?.lat,
    data.location?.coordinates?.lon,
    data.details?.bedrooms,
    data.details?.bathrooms,
    data.details?.sqm,
    data.details?.floor,
    data.details?.rooms,
    data.details?.year_built,
    JSON.stringify(data.images || []),
    JSON.stringify(data.videos || []),
    JSON.stringify(data.features || []),
    data.description,
    data.description_language,
    data.agent?.name,
    data.agent?.phone,
    data.agent?.email,
    data.agent?.agency,
    data.agent?.agency_logo,
    data.amenities?.has_parking || false,
    data.amenities?.has_garden || false,
    data.amenities?.has_balcony || false,
    data.amenities?.has_terrace || false,
    data.amenities?.has_pool || false,
    data.amenities?.has_elevator || false,
    data.amenities?.has_garage || false,
    data.amenities?.has_basement || false,
    data.amenities?.has_fireplace || false,
    data.amenities?.is_furnished || false,
    data.amenities?.is_new_construction || false,
    data.amenities?.is_luxury || false,
    data.energy_rating,
    // Universal Tier 1 attributes (promoted from country_specific)
    data.condition || data.country_specific?.condition,
    data.heating_type || data.country_specific?.heating_type,
    data.furnished || data.country_specific?.furnished,
    data.construction_type || data.country_specific?.construction_type,
    data.details?.renovation_year || data.country_specific?.renovation_year,
    convertToPostgresDate(data.available_from || data.country_specific?.available_from),
    convertToPostgresDate(data.published_date),
    data.deposit || data.country_specific?.deposit,
    data.details?.parking_spaces,
    data.price_per_sqm,
    data.hoa_fees,
    data.property_tax,
    JSON.stringify(data.country_specific || {}),
    JSON.stringify(prop.raw_data),
    data.country_specific?.czech_disposition ?? data.czech_disposition,
    data.country_specific?.czech_ownership ?? data.czech_ownership,
    JSON.stringify(data.portal_metadata || {}),
    data.portal_features || null,
    JSON.stringify(data.portal_ui_config || {}),
    data.slovak_disposition,
    data.slovak_ownership,
    data.hungarian_room_count,
    data.hungarian_ownership,
    data.german_ownership,
    data.german_hausgeld,
    data.german_courtage,
    data.german_kfw_standard,
    data.german_is_denkmalschutz || false,
    data.austrian_ownership,
    data.austrian_operating_costs,
    data.austrian_heating_costs,
    data.france_dpe_rating,
    data.france_ges_rating,
    data.france_copropriete || false,
    data.france_charges_copro,
    data.spain_ibi_annual,
    data.spain_community_fees,
    data.spain_cedula_habitabilidad || false,
    data.uk_tenure,
    data.uk_council_tax_band,
    data.uk_epc_rating,
    data.uk_leasehold_years_remaining,
  ];
}

/**
 * Bulk insert or update properties using true multi-row INSERT
 */
export async function bulkInsertOrUpdateProperties(
  pool: Pool,
  properties: IngestionPayload[],
  requestId?: string
): Promise<BulkInsertResult> {
  if (properties.length === 0) {
    return { inserted: 0, updated: 0, duration: 0, changes: [] };
  }

  const startTime = Date.now();

  // Step 1: Bulk SELECT existing properties to capture old prices/statuses
  const portals = properties.map(p => p.portal);
  const portalIds = properties.map(p => p.portal_id);
  const oldDataResult = await pool.query(
    `SELECT id, portal, portal_id, price, status
     FROM properties
     WHERE (portal, portal_id) IN (
       SELECT * FROM UNNEST($1::varchar[], $2::varchar[])
     )`,
    [portals, portalIds]
  );

  // Build lookup map: "portal:portal_id" -> { id, price, status }
  const oldDataMap = new Map<string, { id: string; price: any; status: string }>();
  for (const row of oldDataResult.rows) {
    oldDataMap.set(`${row.portal}:${row.portal_id}`, {
      id: row.id,
      price: row.price,
      status: row.status,
    });
  }

  // Step 2: Build multi-row INSERT ... ON CONFLICT with RETURNING
  const allParams: unknown[] = [];
  const valuesClauses: string[] = [];

  for (let i = 0; i < properties.length; i++) {
    const rowParams = extractRowParams(properties[i]);
    allParams.push(...rowParams);

    const offset = i * COLS_PER_ROW;
    const placeholders = Array.from(
      { length: COLS_PER_ROW },
      (_, j) => `$${offset + j + 1}`
    ).join(', ');
    valuesClauses.push(`(${placeholders})`);
  }

  const sql = `
    INSERT INTO properties (${COLUMN_NAMES})
    VALUES ${valuesClauses.join(',\n')}
    ON CONFLICT (portal, portal_id) DO UPDATE SET
      ${ON_CONFLICT_SET}
    RETURNING id, portal, portal_id
  `;

  const result = await pool.query(sql, allParams);

  let inserted = 0;
  let updated = 0;

  // Build a map of results for lifecycle processing
  // Note: With partitioned tables, we can't use xmax to detect inserts vs updates
  const resultMap = new Map<string, { id: string; wasInserted: boolean }>();
  for (const row of result.rows) {
    const key = `${row.portal}:${row.portal_id}`;
    // Detect new inserts via oldDataMap: if the key wasn't there before the UPSERT, it's new
    const wasInserted = !oldDataMap.has(key);
    resultMap.set(key, { id: row.id, wasInserted });
    if (wasInserted) inserted++;
    else updated++;
  }

  // Step 3: Lifecycle events and tracking (best-effort, never fail the batch)

  // 3a: Initialize history for newly inserted properties
  const newProperties: Array<{ id: string; price: any; status: string }> = [];
  for (const prop of properties) {
    const key = `${prop.portal}:${prop.portal_id}`;
    const res = resultMap.get(key);
    if (res?.wasInserted) {
      newProperties.push({
        id: res.id,
        price: prop.data.price,
        status: (prop.data.status as string) || 'active',
      });
    }
  }
  if (newProperties.length > 0) {
    // Bulk-initialize status_history in one query per distinct status value
    try {
      await bulkOpenInitialStatusPeriods(
        pool,
        newProperties.map(p => ({ id: p.id, status: p.status as 'active' | 'removed' | 'sold' | 'rented' }))
      );
    } catch (e) {
      dbLog.warn({ err: e, metric: 'bulk_ops.status_history.failure', operation: 'bulkOpenInitialStatusPeriods' }, 'Failed to initialize status history');
    }

    // Batch initialize price_history for all new properties with UNNEST
    try {
      const ids = newProperties.map(p => p.id);
      await pool.query(
        `UPDATE properties
         SET price_history = jsonb_build_array(jsonb_build_object('date', to_jsonb(NOW()), 'price', price))
         WHERE id = ANY($1::uuid[])`,
        [ids]
      );
    } catch (e) {
      dbLog.warn({
        err: e,
        metric: 'bulk_ops.price_history_init.failure',
        operation: 'initializePriceHistory',
      }, 'Failed to initialize price history for new properties');
    }
  }

  // 3b: Handle status changes (reactivation or scraper-detected removal)
  for (const prop of properties) {
    const key = `${prop.portal}:${prop.portal_id}`;
    const old = oldDataMap.get(key);
    const res = resultMap.get(key);
    const newStatus = prop.data.status || 'active';

    // Skip if this is a new property (status period already created in step 3a)
    if (res?.wasInserted) {
      continue;
    }

    // Skip if no status change
    if (!old || old.status === newStatus) {
      continue;
    }

    try {
      // Handle reactivation (removed -> active)
      if (old.status === 'removed' && newStatus === 'active') {
        await reactivateProperty(pool, old.id, prop.portal, prop.portal_id);
      }
      // Handle scraper-detected removal or other status changes
      else if (old.status !== newStatus) {
        await recordScraperStatusChange(
          pool,
          old.id,
          newStatus as 'active' | 'removed' | 'sold' | 'rented',
          'scraper_ingest'
        );
        dbLog.info({
          propertyId: old.id,
          portal: prop.portal,
          portalId: prop.portal_id,
          oldStatus: old.status,
          newStatus
        }, 'Status change recorded');
      }
    } catch (e) {
      dbLog.warn({
        err: e,
        metric: 'bulk_ops.status_change.failure',
        operation: 'recordStatusChange',
        propertyId: old?.id,
        portal: prop.portal,
      }, 'Failed to record status change');
    }
  }

  // 3c: Bulk ingestion log (includes request_id for correlation)
  try {
    const logPortals: string[] = [];
    const logPortalIds: string[] = [];
    const logPayloads: string[] = [];
    for (const prop of properties) {
      logPortals.push(prop.portal);
      logPortalIds.push(prop.portal_id);
      logPayloads.push(JSON.stringify(prop.raw_data));
    }
    const logValuesClauses: string[] = [];
    const logParams: unknown[] = [];
    const colsPerLogRow = 4;
    for (let i = 0; i < properties.length; i++) {
      const offset = i * colsPerLogRow;
      logValuesClauses.push(`($${offset + 1}::varchar, $${offset + 2}::varchar, 'success', $${offset + 3}::jsonb, $${offset + 4}::varchar)`);
      logParams.push(logPortals[i], logPortalIds[i], logPayloads[i], requestId || null);
    }
    await pool.query(
      `INSERT INTO ingestion_log (portal, portal_listing_id, status, raw_payload, request_id)
       VALUES ${logValuesClauses.join(', ')}`,
      logParams
    );
  } catch (e) {
    dbLog.warn({
      err: e,
      metric: 'bulk_ops.ingestion_log.failure',
      operation: 'writeIngestionLog',
    }, 'Failed to write ingestion log');
  }

  // 3d: Append to price_history JSONB for updated properties where price changed (batched)
  try {
    const priceChangeIds: string[] = [];
    const priceChangePrices: number[] = [];
    const priceChangeCurrencies: string[] = [];

    for (const prop of properties) {
      const key = `${prop.portal}:${prop.portal_id}`;
      const res = resultMap.get(key);
      const old = oldDataMap.get(key);
      if (res && !res.wasInserted && old?.price !== null && old?.price !== undefined) {
        if (String(old.price) !== String(prop.data.price)) {
          priceChangeIds.push(res.id);
          priceChangePrices.push(prop.data.price as number);
          priceChangeCurrencies.push((prop.data.currency as string) || 'CZK');
        }
      }
    }

    if (priceChangeIds.length > 0) {
      // Append to JSONB column on properties row
      await pool.query(
        `UPDATE properties
         SET price_history = price_history || jsonb_build_array(
           jsonb_build_object('date', to_jsonb(NOW()), 'price', v.new_price)
         )
         FROM (SELECT UNNEST($1::uuid[]) AS id, UNNEST($2::numeric[]) AS new_price) v
         WHERE properties.id = v.id`,
        [priceChangeIds, priceChangePrices]
      );

      // Write to price_history table (enables SQL queries, aggregations, alerts)
      const phValues: string[] = [];
      const phParams: unknown[] = [];
      for (let i = 0; i < priceChangeIds.length; i++) {
        phValues.push(`($${i * 3 + 1}::uuid, $${i * 3 + 2}::numeric, $${i * 3 + 3}::varchar)`);
        phParams.push(priceChangeIds[i], priceChangePrices[i], priceChangeCurrencies[i]);
      }
      await pool.query(
        `INSERT INTO price_history (property_id, price, currency)
         VALUES ${phValues.join(', ')}`,
        phParams
      );
    }
  } catch (e) {
    dbLog.warn({
      err: e,
      metric: 'bulk_ops.price_history_append.failure',
      operation: 'appendPriceHistory',
    }, 'Failed to record price history');
  }

  // 3e: Property changes log for updated properties
  try {
    const updatedProps: { propertyId: string; portal: string; portalId: string }[] = [];
    for (const prop of properties) {
      const key = `${prop.portal}:${prop.portal_id}`;
      const res = resultMap.get(key);
      if (res && !res.wasInserted) {
        updatedProps.push({ propertyId: res.id, portal: prop.portal, portalId: prop.portal_id });
      }
    }
    if (updatedProps.length > 0) {
      const pcValuesClauses: string[] = [];
      const pcParams: unknown[] = [];
      for (let i = 0; i < updatedProps.length; i++) {
        const offset = i * 3;
        pcValuesClauses.push(
          `(gen_random_uuid(), $${offset + 1}::uuid, 'data_update', jsonb_build_object('source', $${offset + 2}::varchar, 'portal_id', $${offset + 3}::varchar), NOW())`
        );
        pcParams.push(updatedProps[i].propertyId, updatedProps[i].portal, updatedProps[i].portalId);
      }
      await pool.query(
        `INSERT INTO property_changes (id, property_id, change_type, changed_fields, changed_at)
         VALUES ${pcValuesClauses.join(', ')}`,
        pcParams
      );
    }
  } catch (e) {
    dbLog.warn({
      err: e,
      metric: 'bulk_ops.property_changes.failure',
      operation: 'recordPropertyChanges',
    }, 'Failed to record property changes');
  }

  // Cross-portal dedup now handled in category-specific upsert functions
  // (upsertApartmentsBulk, upsertHouses, upsertLand, upsertCommercial)

  const duration = Date.now() - startTime;

  dbLog.info({ inserted, updated, durationMs: duration }, 'Bulk operation complete');

  return { inserted, updated, duration, changes: [] };
}

// ============================================================
// Category-Specific UPSERT Functions (for properties table)
// ============================================================

export interface UpsertResult {
  inserted: number;
  updated: number;
  propertyIds: string[];
  changes: PropertyChangeEvent[];
}

/**
 * Bulk upsert apartments to properties (partitioned table) with full lifecycle tracking
 * @param apartments - Array of apartment properties
 * @param country - Country code (e.g., 'czech', 'slovakia')
 * @param requestId - Optional request ID for correlation
 */
export async function upsertApartmentsBulk(
  apartments: ApartmentPropertyTierI[],
  country: string = 'czech',
  scrapeRunId?: string,
  requestId?: string
): Promise<BulkInsertResult> {
  if (apartments.length === 0) {
    return { inserted: 0, updated: 0, duration: 0, changes: [] };
  }

  const startTime = Date.now();
  const pool = getCoreDatabase(country);

  // Step 1: Bulk SELECT existing properties to capture old prices/statuses
  const portals = apartments.map(a => a.source_platform);
  const portalIds = apartments.map(a => a.portal_id || `${a.source_platform}-${Date.now()}`);

  const oldDataResult = await pool.query(
    `SELECT id, portal, portal_id, price, status
     FROM properties
     WHERE property_category = 'apartment'
       AND (portal, portal_id) IN (
         SELECT * FROM UNNEST($1::varchar[], $2::varchar[])
       )`,
    [portals, portalIds]
  );

  // Build lookup map: "portal:portal_id" -> { id, price, status }
  const oldDataMap = new Map<string, { id: string; price: any; status: string }>();
  for (const row of oldDataResult.rows) {
    oldDataMap.set(`${row.portal}:${row.portal_id}`, {
      id: row.id,
      price: row.price,
      status: row.status,
    });
  }

  // Step 2: Bulk lookup geo enrichment for properties with coordinates
  const geoMap = new Map<string, { district: string | null; neighbourhood: string | null; municipality: string | null }>();
  await Promise.all(apartments.map(async (apt, i) => {
    // Use pre-enriched data from batch-ingestion if available
    if ((apt as any).district || (apt as any).municipality) {
      geoMap.set(String(i), { district: (apt as any).district, neighbourhood: (apt as any).neighbourhood || null, municipality: (apt as any).municipality || null });
      return;
    }
    const lat = apt.location?.coordinates?.lat;
    const lon = apt.location?.coordinates?.lon;
    if (lat && lon) {
      const geo = await lookupGeoEnrichment(lat, lon);
      geoMap.set(String(i), { district: geo.district, neighbourhood: geo.neighbourhood, municipality: geo.municipality });
    } else {
      geoMap.set(String(i), { district: null, neighbourhood: null, municipality: null });
    }
  }));

  // Step 3: Build multi-row INSERT for bulk processing
  const allParams: unknown[] = [];
  const valuesClauses: string[] = [];
  const COLS_PER_APT_ROW = 82; // Number of parameters per apartment (60 + 2 commission + 9 universal Tier 1 + 2 universal commission + 1 external_source_url + 2 czech + 1 district + 1 neighbourhood + 1 municipality + 3 agent)

  for (let i = 0; i < apartments.length; i++) {
    const apt = apartments[i];
    const portal_id = apt.portal_id || `${apt.source_platform}-${Date.now()}-${i}`;

    const rowParams = [
      apt.source_platform,          // $1
      portal_id,                     // $2
      apt.source_url,                // $3
      apt.source_platform,           // $4 (source_platform again for consistency)
      apt.title,                     // $5
      apt.price,                     // $6
      apt.currency,                  // $7
      apt.transaction_type,          // $8
      JSON.stringify(apt.location),  // $9
      apt.location.city?.substring(0, 255),             // $10
      apt.location.region?.substring(0, 255),           // $11
      apt.location.country,          // $12
      apt.location.postal_code,      // $13
      apt.location.coordinates?.lat, // $14
      apt.location.coordinates?.lon, // $15
      apt.status || 'active',        // $16
      apt.bedrooms,                  // $17
      apt.bathrooms,                 // $18
      apt.sqm,                       // $19
      apt.floor,                     // $20
      apt.total_floors,              // $21
      apt.rooms,                     // $22
      apt.has_elevator,              // $23
      apt.has_balcony,               // $24
      apt.balcony_area,              // $25
      apt.has_parking,               // $26
      apt.parking_spaces,            // $27
      apt.has_basement,              // $28
      apt.cellar_area,               // $29
      apt.has_loggia,                // $30
      apt.loggia_area,               // $31
      apt.has_terrace,               // $32
      apt.terrace_area,              // $33
      apt.has_garage,                // $34
      apt.garage_count,              // $35
      apt.property_subtype?.substring(0, 100),          // $36
      apt.year_built,                // $37
      apt.construction_type?.substring(0, 100),         // $38
      apt.condition?.substring(0, 100),                 // $39
      apt.heating_type?.substring(0, 100),              // $40
      apt.energy_class?.substring(0, 100),              // $41
      apt.floor_location?.substring(0, 20),             // $42
      apt.hoa_fees,                  // $43
      apt.deposit,                   // $44
      apt.utility_charges,           // $45
      apt.service_charges,           // $46
      apt.is_commission ?? null,     // $47
      apt.commission_note || null,   // $48
      apt.available_from,            // $49
      apt.min_rent_days,             // $48
      apt.max_rent_days,             // $49
      JSON.stringify(apt.media || {}),                       // $50
      JSON.stringify(apt.agent || {}),                       // $51
      apt.features || [],                                     // $52
      apt.description,                                        // $53
      JSON.stringify(apt.images || []),                       // $54
      JSON.stringify(apt.videos || []),                       // $55
      JSON.stringify(apt.portal_metadata || {}),              // $56
      JSON.stringify(apt.country_specific || {}),             // $57
      JSON.stringify(apt),                                    // $58 raw_data
      apt.first_seen_at || new Date(),                       // $59
      apt.last_seen_at || new Date(),                        // $60
      // Universal Tier 1 fields
      (apt.condition || null)?.substring(0, 100),                               // $61
      (apt.heating_type || null)?.substring(0, 100),                            // $62
      apt.furnished || null,                                                    // $63
      (apt.construction_type || null)?.substring(0, 100),                       // $64
      apt.renovation_year || null,                                              // $65
      convertToPostgresDate(apt.available_from),                                // $66
      convertToPostgresDate(apt.published_date),                                // $67
      apt.deposit || null,                                                      // $68
      apt.parking_spaces || null,                                               // $69
      apt.is_commission ?? null,                                                  // $70
      apt.commission_note || null,                                                // $71
      (apt as ApartmentPropertyTierI & ExternalFields).external_source_url || null, // $72
      (apt as any).country_specific?.czech_disposition ?? (apt as any).czech_disposition ?? null, // $73
      (apt as any).country_specific?.czech_ownership ?? (apt as any).czech_ownership ?? null,     // $74
      geoMap.get(String(i))?.district ?? null,                                                       // $75
      geoMap.get(String(i))?.neighbourhood ?? null,                                                   // $76
      geoMap.get(String(i))?.municipality ?? null,                                                    // $77
      apt.agent?.name || null,                                                                          // $78
      apt.agent?.phone || null,                                                                         // $79
      apt.agent?.email || null,                                                                         // $80
    ];

    allParams.push(...rowParams);

    const offset = i * COLS_PER_APT_ROW;
    const placeholders = Array.from(
      { length: COLS_PER_APT_ROW },
      (_, j) => `$${offset + j + 1}`
    ).join(', ');
    valuesClauses.push(`('apartment', ${placeholders})`);
  }

  // Step 3: Execute bulk INSERT with RETURNING for tracking
  const sql = `
    INSERT INTO properties (
      property_category,
      portal, portal_id, source_url, source_platform,
      title, price, currency, transaction_type,
      location, city, region, country, postal_code, latitude, longitude,
      status,
      apt_bedrooms, apt_bathrooms, apt_sqm, apt_floor, apt_total_floors, apt_rooms,
      apt_has_elevator, apt_has_balcony, apt_balcony_area,
      apt_has_parking, apt_parking_spaces,
      apt_has_basement, apt_cellar_area,
      apt_has_loggia, apt_loggia_area,
      apt_has_terrace, apt_terrace_area,
      apt_has_garage, apt_garage_count,
      apt_property_subtype, apt_year_built, apt_construction_type, apt_condition,
      apt_heating_type, apt_energy_class, apt_floor_location,
      apt_hoa_fees, apt_deposit, apt_utility_charges, apt_service_charges,
      apt_is_commission, apt_commission_note,
      apt_available_from, apt_min_rent_days, apt_max_rent_days,
      media, agent, features, description,
      images, videos, portal_metadata, country_specific,
      raw_data,
      first_seen_at, last_seen_at,
      condition, heating_type, furnished, construction_type,
      renovation_year, available_from, published_date, deposit, parking_spaces,
      is_commission, commission_note,
      external_source_url,
      czech_disposition, czech_ownership,
      district, neighbourhood, municipality,
      agent_name, agent_phone, agent_email
    )
    VALUES ${valuesClauses.join(',\n')}
    ON CONFLICT (portal, portal_id, property_category)
    DO UPDATE SET
      title = EXCLUDED.title,
      price = EXCLUDED.price,
      location = EXCLUDED.location,
      city = EXCLUDED.city,
      region = EXCLUDED.region,
      latitude = COALESCE(EXCLUDED.latitude, properties.latitude),
      longitude = COALESCE(EXCLUDED.longitude, properties.longitude),
      apt_bedrooms = EXCLUDED.apt_bedrooms,
      apt_bathrooms = EXCLUDED.apt_bathrooms,
      apt_sqm = EXCLUDED.apt_sqm,
      apt_floor = EXCLUDED.apt_floor,
      apt_total_floors = EXCLUDED.apt_total_floors,
      apt_rooms = EXCLUDED.apt_rooms,
      apt_has_elevator = EXCLUDED.apt_has_elevator,
      apt_has_balcony = EXCLUDED.apt_has_balcony,
      apt_balcony_area = EXCLUDED.apt_balcony_area,
      apt_has_parking = EXCLUDED.apt_has_parking,
      apt_parking_spaces = EXCLUDED.apt_parking_spaces,
      apt_has_basement = EXCLUDED.apt_has_basement,
      apt_cellar_area = EXCLUDED.apt_cellar_area,
      apt_has_loggia = EXCLUDED.apt_has_loggia,
      apt_loggia_area = EXCLUDED.apt_loggia_area,
      apt_has_terrace = EXCLUDED.apt_has_terrace,
      apt_terrace_area = EXCLUDED.apt_terrace_area,
      apt_has_garage = EXCLUDED.apt_has_garage,
      apt_garage_count = EXCLUDED.apt_garage_count,
      apt_property_subtype = EXCLUDED.apt_property_subtype,
      apt_year_built = EXCLUDED.apt_year_built,
      apt_construction_type = EXCLUDED.apt_construction_type,
      apt_condition = EXCLUDED.apt_condition,
      apt_heating_type = EXCLUDED.apt_heating_type,
      apt_energy_class = EXCLUDED.apt_energy_class,
      apt_floor_location = EXCLUDED.apt_floor_location,
      apt_hoa_fees = EXCLUDED.apt_hoa_fees,
      apt_deposit = EXCLUDED.apt_deposit,
      apt_utility_charges = EXCLUDED.apt_utility_charges,
      apt_service_charges = EXCLUDED.apt_service_charges,
      apt_is_commission = EXCLUDED.apt_is_commission,
      apt_commission_note = EXCLUDED.apt_commission_note,
      apt_available_from = EXCLUDED.apt_available_from,
      apt_min_rent_days = EXCLUDED.apt_min_rent_days,
      apt_max_rent_days = EXCLUDED.apt_max_rent_days,
      media = EXCLUDED.media,
      agent = EXCLUDED.agent,
      features = EXCLUDED.features,
      description = EXCLUDED.description,
      images = EXCLUDED.images,
      videos = EXCLUDED.videos,
      portal_metadata = EXCLUDED.portal_metadata,
      country_specific = EXCLUDED.country_specific,
      raw_data = EXCLUDED.raw_data,
      condition = COALESCE(EXCLUDED.condition, properties.condition),
      heating_type = COALESCE(EXCLUDED.heating_type, properties.heating_type),
      furnished = COALESCE(EXCLUDED.furnished, properties.furnished),
      construction_type = COALESCE(EXCLUDED.construction_type, properties.construction_type),
      renovation_year = COALESCE(EXCLUDED.renovation_year, properties.renovation_year),
      available_from = COALESCE(EXCLUDED.available_from, properties.available_from),
      published_date = COALESCE(EXCLUDED.published_date, properties.published_date),
      deposit = COALESCE(EXCLUDED.deposit, properties.deposit),
      parking_spaces = COALESCE(EXCLUDED.parking_spaces, properties.parking_spaces),
      is_commission = COALESCE(EXCLUDED.is_commission, properties.is_commission),
      commission_note = COALESCE(EXCLUDED.commission_note, properties.commission_note),
      external_source_url = COALESCE(EXCLUDED.external_source_url, properties.external_source_url),
      czech_disposition = COALESCE(EXCLUDED.czech_disposition, properties.czech_disposition),
      czech_ownership = COALESCE(EXCLUDED.czech_ownership, properties.czech_ownership),
      district = COALESCE(EXCLUDED.district, properties.district),
      neighbourhood = COALESCE(EXCLUDED.neighbourhood, properties.neighbourhood),
      municipality = COALESCE(EXCLUDED.municipality, properties.municipality),
      agent_name = COALESCE(EXCLUDED.agent_name, properties.agent_name),
      agent_phone = COALESCE(EXCLUDED.agent_phone, properties.agent_phone),
      agent_email = COALESCE(EXCLUDED.agent_email, properties.agent_email),
      status = 'active',
      last_seen_at = NOW(),
      last_updated_at = NOW(),
      updated_at = NOW()
    RETURNING id, portal, portal_id;
  `;

  const result = await pool.query(sql, allParams);

  let inserted = 0;
  let updated = 0;

  // Build result map for lifecycle processing
  // Detect new inserts via oldDataMap: if the key wasn't there before the UPSERT, it's new
  const resultMap = new Map<string, { id: string; wasInserted: boolean }>();
  for (const row of result.rows) {
    const key = `${row.portal}:${row.portal_id}`;
    const wasInserted = !oldDataMap.has(key);
    resultMap.set(key, { id: row.id, wasInserted });
    if (wasInserted) inserted++;
    else updated++;
  }

  // Build property change events for notification system
  const changes: PropertyChangeEvent[] = [];
  for (const apt of apartments) {
    const key = `${apt.source_platform}:${apt.portal_id || ''}`;
    const res = resultMap.get(key);
    if (!res) continue;

    const old = oldDataMap.get(key);
    let event_type: PropertyEventType | null = null;
    let old_price: number | undefined;

    if (res.wasInserted) {
      event_type = 'new_listing';
    } else if (old && old.price !== null && old.price !== undefined) {
      const oldPriceNum = Number(old.price);
      const newPriceNum = Number(apt.price);
      if (newPriceNum < oldPriceNum) {
        event_type = 'price_drop';
        old_price = oldPriceNum;
      } else if (newPriceNum > oldPriceNum) {
        event_type = 'price_increase';
        old_price = oldPriceNum;
      }
    }

    if (event_type) {
      const aptGeoSnap = geoMap.get(String(apartments.indexOf(apt)));
      const snapshot: PropertyFilterSnapshot = {
        property_category: 'apartment',
        transaction_type: apt.transaction_type,
        city: apt.location?.city,
        region: apt.location?.region,
        district: aptGeoSnap?.district ?? undefined,
        neighbourhood: aptGeoSnap?.neighbourhood ?? undefined,
        municipality: aptGeoSnap?.municipality ?? undefined,
        price: Number(apt.price),
        currency: apt.currency,
        bedrooms: apt.bedrooms,
        bathrooms: apt.bathrooms,
        sqm: apt.sqm,
        floor: apt.floor,
        furnished: apt.furnished,
        construction_type: apt.construction_type,
        energy_class: apt.energy_class,
        year_built: apt.year_built,
        disposition: (apt as any).country_specific?.czech_disposition ?? (apt as any).czech_disposition,
        ownership: (apt as any).country_specific?.czech_ownership ?? (apt as any).czech_ownership,
        condition: apt.condition,
        building_type: apt.construction_type,
        has_parking: apt.has_parking,
        has_balcony: apt.has_balcony,
        has_terrace: apt.has_terrace,
        has_elevator: apt.has_elevator,
        has_garage: apt.has_garage,
        has_basement: apt.has_basement,
      };

      changes.push({
        property_id: res.id,
        portal_id: apt.portal_id || '',
        event_type,
        property_category: 'apartment',
        city: apt.location?.city || '',
        region: apt.location?.region,
        price: Number(apt.price),
        old_price,
        title: apt.title,
        source_url: apt.source_url,
        images: apt.images,
        filter_snapshot: snapshot,
      });
    }
  }

  // Stamp last_scrape_run_id on all upserted properties (best-effort)
  if (scrapeRunId && result.rows.length > 0) {
    const ids = result.rows.map((r: { id: string }) => r.id);
    try {
      await pool.query(
        `UPDATE properties SET last_scrape_run_id = $1 WHERE id = ANY($2)`,
        [scrapeRunId, ids]
      );
    } catch (err) {
      dbLog.warn({
        err,
        metric: 'bulk_ops.scrape_run_stamp.failure',
        operation: 'stampScrapeRunId',
        scrapeRunId,
      }, 'Failed to stamp last_scrape_run_id (non-fatal)');
    }
  }

  // Step 4: Lifecycle events and tracking (best-effort, never fail the batch)
  await performLifecycleTracking(pool, apartments, oldDataMap, resultMap, requestId);

  const duration = Date.now() - startTime;
  dbLog.info({ inserted, updated, durationMs: duration, count: apartments.length, changes: changes.length }, 'Apartment bulk upsert complete');

  return { inserted, updated, duration, changes };
}

/**
 * Legacy single-row upsert (kept for backward compatibility)
 * Use upsertApartmentsBulk for better performance
 */
export async function upsertApartments(
  apartments: ApartmentPropertyTierI[],
  country: string = 'czech',
  scrapeRunId?: string
): Promise<UpsertResult> {
  const result = await upsertApartmentsBulk(apartments, country, scrapeRunId);
  const propertyIds: string[] = [];
  return {
    inserted: result.inserted,
    updated: result.updated,
    propertyIds,
    changes: result.changes,
  };
}

/**
 * Fire-and-forget inline dedup for newly inserted properties.
 * For each new property, checks for cross-portal duplicates and links them.
 */
function runInlineDedupAsync(
  pool: Pool,
  newlyInserted: Array<{ id: string; portal: string; lat: number; lon: number; price: number; transaction_type: string | null; portal_id: string }>,
  table: PartitionTable
): void {
  if (newlyInserted.length === 0) return;

  setImmediate(async () => {
    for (const prop of newlyInserted) {
      try {
        const matches = await findPotentialDuplicates(
          {
            id: prop.id,
            latitude: prop.lat,
            longitude: prop.lon,
            price: prop.price,
            transaction_type: prop.transaction_type,
            portal: prop.portal,
            portal_id: prop.portal_id,
          },
          table,
          pool
        );

        if (matches.length > 0) {
          const best = matches[0]; // sorted by portal priority
          const ourPriority = PORTAL_PRIORITY[prop.portal] ?? 9;
          const theirPriority = PORTAL_PRIORITY[best.portal] ?? 9;

          if (ourPriority < theirPriority) {
            // We are higher priority — we're canonical, mark existing as duplicate
            await linkDuplicate(prop.id, best.propertyId, best.confidence, best.method, pool);
          } else {
            // They are higher priority — mark us as the duplicate
            await linkDuplicate(best.propertyId, prop.id, best.confidence, best.method, pool);
          }
        }
      } catch (e) {
        dbLog.warn({ err: e, propertyId: prop.id }, 'Inline dedup check failed');
      }
    }
  });
}

/**
 * Perform lifecycle tracking for upserted properties
 * Handles: status periods, price history, change log, ingestion log, dedup
 * Best-effort: never fails the main batch operation
 */
async function performLifecycleTracking(
  pool: Pool,
  properties: Array<{ source_platform: string; portal_id?: string; price: number; currency: string; status?: string; location: any; }>,
  oldDataMap: Map<string, { id: string; price: any; status: string }>,
  resultMap: Map<string, { id: string; wasInserted: boolean }>,
  requestId?: string
): Promise<void> {
  // 1. Open initial status periods for newly inserted properties
  const newPropertyIds: Map<string, 'active' | 'removed' | 'sold' | 'rented'> = new Map();
  for (const prop of properties) {
    const key = `${prop.source_platform}:${prop.portal_id || ''}`;
    const res = resultMap.get(key);
    if (res?.wasInserted) {
      const status = (prop.status as 'active' | 'removed' | 'sold' | 'rented') || 'active';
      newPropertyIds.set(res.id, status);
    }
  }

  if (newPropertyIds.size > 0) {
    try {
      await bulkOpenInitialStatusPeriods(
        pool,
        Array.from(newPropertyIds.entries()).map(([id, status]) => ({ id, status }))
      );
    } catch (e) {
      dbLog.warn({ err: e, metric: 'bulk_ops.status_history.failure', operation: 'bulkOpenInitialStatusPeriodsLifecycle' }, 'Failed to record initial status periods');
    }
  }

  // 2. Handle status changes (reactivation or scraper-detected removal)
  for (const prop of properties) {
    const key = `${prop.source_platform}:${prop.portal_id || ''}`;
    const old = oldDataMap.get(key);
    const res = resultMap.get(key);
    const newStatus = prop.status || 'active';

    if (res?.wasInserted || !old || old.status === newStatus) {
      continue;
    }

    try {
      if (old.status === 'removed' && newStatus === 'active') {
        await reactivateProperty(pool, old.id, prop.source_platform, prop.portal_id || '');
      } else if (old.status !== newStatus) {
        await recordScraperStatusChange(
          pool,
          old.id,
          newStatus as 'active' | 'removed' | 'sold' | 'rented',
          'scraper_ingest'
        );
      }
    } catch (e) {
      dbLog.warn({
        err: e,
        metric: 'bulk_ops.status_change.failure',
        operation: 'recordStatusChangeLifecycle',
        propertyId: old?.id,
        portal: prop.source_platform,
      }, 'Failed to record status change');
    }
  }

  // 3. Bulk ingestion log
  try {
    const logValuesClauses: string[] = [];
    const logParams: unknown[] = [];
    let logIdx = 0;

    for (const prop of properties) {
      logValuesClauses.push(`($${logIdx * 4 + 1}, $${logIdx * 4 + 2}, 'success', $${logIdx * 4 + 3}::jsonb, $${logIdx * 4 + 4})`);
      logParams.push(
        prop.source_platform,
        prop.portal_id || '',
        JSON.stringify(prop),
        requestId || null
      );
      logIdx++;
    }

    await pool.query(
      `INSERT INTO ingestion_log (portal, portal_listing_id, status, raw_payload, request_id)
       VALUES ${logValuesClauses.join(', ')}`,
      logParams
    );
  } catch (e) {
    dbLog.warn({
      err: e,
      metric: 'bulk_ops.ingestion_log.failure',
      operation: 'writeIngestionLogLifecycle',
    }, 'Failed to write ingestion log');
  }

  // 4. Append to price_history JSONB for updated properties where price changed (batched)
  try {
    const priceChangeIds: string[] = [];
    const priceChangePrices: number[] = [];
    const priceChangeCurrencies: string[] = [];

    for (const prop of properties) {
      const key = `${prop.source_platform}:${prop.portal_id || ''}`;
      const res = resultMap.get(key);
      const old = oldDataMap.get(key);

      if (res && !res.wasInserted && old?.price !== null && old?.price !== undefined) {
        if (String(old.price) !== String(prop.price)) {
          priceChangeIds.push(res.id);
          priceChangePrices.push(prop.price);
          priceChangeCurrencies.push(prop.currency || 'CZK');
        }
      }
    }

    if (priceChangeIds.length > 0) {
      // Append to JSONB column on properties row
      await pool.query(
        `UPDATE properties
         SET price_history = price_history || jsonb_build_array(
           jsonb_build_object('date', to_jsonb(NOW()), 'price', v.new_price)
         )
         FROM (SELECT UNNEST($1::uuid[]) AS id, UNNEST($2::numeric[]) AS new_price) v
         WHERE properties.id = v.id`,
        [priceChangeIds, priceChangePrices]
      );

      // Write to price_history table (enables SQL queries, aggregations, alerts)
      const phValues: string[] = [];
      const phParams: unknown[] = [];
      for (let i = 0; i < priceChangeIds.length; i++) {
        phValues.push(`($${i * 3 + 1}::uuid, $${i * 3 + 2}::numeric, $${i * 3 + 3}::varchar)`);
        phParams.push(priceChangeIds[i], priceChangePrices[i], priceChangeCurrencies[i]);
      }
      await pool.query(
        `INSERT INTO price_history (property_id, price, currency)
         VALUES ${phValues.join(', ')}`,
        phParams
      );
    }
  } catch (e) {
    dbLog.warn({
      err: e,
      metric: 'bulk_ops.price_history_append.failure',
      operation: 'appendPriceHistoryLifecycle',
    }, 'Failed to record price history');
  }

  // 5. Property changes log
  try {
    const updatedProps: { propertyId: string; portal: string; portalId: string }[] = [];
    for (const prop of properties) {
      const key = `${prop.source_platform}:${prop.portal_id || ''}`;
      const res = resultMap.get(key);
      if (res && !res.wasInserted) {
        updatedProps.push({
          propertyId: res.id,
          portal: prop.source_platform,
          portalId: prop.portal_id || ''
        });
      }
    }

    if (updatedProps.length > 0) {
      const pcValuesClauses: string[] = [];
      const pcParams: unknown[] = [];
      for (let i = 0; i < updatedProps.length; i++) {
        pcValuesClauses.push(
          `(gen_random_uuid(), $${i * 3 + 1}::uuid, 'data_update', jsonb_build_object('source', $${i * 3 + 2}::varchar, 'portal_id', $${i * 3 + 3}::varchar), NOW())`
        );
        pcParams.push(updatedProps[i].propertyId, updatedProps[i].portal, updatedProps[i].portalId);
      }
      await pool.query(
        `INSERT INTO property_changes (id, property_id, change_type, changed_fields, changed_at)
         VALUES ${pcValuesClauses.join(', ')}`,
        pcParams
      );
    }
  } catch (e) {
    dbLog.warn({
      err: e,
      metric: 'bulk_ops.property_changes.failure',
      operation: 'recordPropertyChangesLifecycle',
    }, 'Failed to record property changes');
  }

  // 6. Cross-portal dedup for newly inserted apartments (fire-and-forget)
  const dedupCandidates: Array<{ id: string; portal: string; lat: number; lon: number; price: number; transaction_type: string | null; portal_id: string }> = [];
  for (const prop of properties) {
    const key = `${prop.source_platform}:${prop.portal_id || ''}`;
    const res = resultMap.get(key);
    if (!res?.wasInserted) continue;

    const lat = prop.location?.coordinates?.lat ?? null;
    const lon = prop.location?.coordinates?.lon ?? null;
    if (lat == null || lon == null || !prop.price) continue;

    dedupCandidates.push({
      id: res.id,
      portal: prop.source_platform,
      lat,
      lon,
      price: prop.price,
      transaction_type: (prop as any).transaction_type ?? null,
      portal_id: prop.portal_id || '',
    });
  }
  runInlineDedupAsync(pool, dedupCandidates, 'properties_apartment');
}

/**
 * Upsert houses to properties (partitioned table)
 * @param houses - Array of house properties
 * @param country - Country code (e.g., 'czech', 'slovakia')
 */
export async function upsertHouses(
  houses: HousePropertyTierI[],
  country: string = 'czech',
  scrapeRunId?: string
): Promise<UpsertResult> {
  if (houses.length === 0) {
    return { inserted: 0, updated: 0, propertyIds: [], changes: [] };
  }

  const pool = getCoreDatabase(country);
  const propertyIds: string[] = [];
  const changes: PropertyChangeEvent[] = [];
  const newPropertyEntries: Array<{ id: string; status: 'active' | 'removed' | 'sold' | 'rented' }> = [];
  let inserted = 0;
  let updated = 0;

  // Pre-SELECT existing rows for change detection
  const portals = houses.map(h => h.source_platform);
  const portalIds = houses.map(h => h.portal_id || '');
  const oldDataResult = await pool.query(
    `SELECT id, portal, portal_id, price, status
     FROM properties
     WHERE property_category = 'house'
       AND (portal, portal_id) IN (
         SELECT * FROM UNNEST($1::varchar[], $2::varchar[])
       )`,
    [portals, portalIds]
  );
  const oldDataMap = new Map<string, { id: string; price: any; status: string }>();
  for (const row of oldDataResult.rows) {
    oldDataMap.set(`${row.portal}:${row.portal_id}`, { id: row.id, price: row.price, status: row.status });
  }

  for (const house of houses) {
    const query = `
      INSERT INTO properties (
        property_category,
        portal, portal_id, source_url, source_platform,
        title, price, currency, transaction_type,
        location, city, region, country, postal_code, latitude, longitude,
        status,
        house_bedrooms, house_bathrooms, house_sqm_living, house_sqm_total, house_sqm_plot,
        house_stories, house_rooms,
        house_has_garden, house_garden_area,
        house_has_garage, house_garage_count,
        house_has_parking, house_parking_spaces,
        house_has_basement, house_cellar_area,
        house_has_pool, house_has_fireplace,
        house_has_terrace, house_terrace_area,
        house_has_attic, house_has_balcony, house_balcony_area,
        house_property_subtype, house_year_built, house_renovation_year,
        house_construction_type, house_condition, house_heating_type,
        house_roof_type, house_energy_class,
        house_property_tax, house_hoa_fees, house_deposit,
        house_utility_charges, house_service_charges,
        house_is_commission, house_commission_note,
        house_available_from, house_min_rent_days, house_max_rent_days,
        media, agent, features, description,
        images, videos, portal_metadata, country_specific,
        raw_data,
        first_seen_at, last_seen_at,
        condition, heating_type, furnished, construction_type,
        renovation_year, available_from, published_date, deposit, parking_spaces,
        is_commission, commission_note,
        external_source_url,
        czech_disposition, czech_ownership,
        district, neighbourhood, municipality,
        agent_name, agent_phone, agent_email
      )
      VALUES (
        'house',
        $1, $2, $3, $4,
        $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14, $15,
        $16,
        $17, $18, $19, $20, $21,
        $22, $23,
        $24, $25,
        $26, $27,
        $28, $29,
        $30, $31,
        $32, $33,
        $34, $35,
        $36, $37, $38,
        $39, $40, $41,
        $42, $43, $44,
        $45, $46,
        $47, $48, $49,
        $50, $51,
        $52, $53,
        $54, $55, $56,
        $57, $58, $59, $60,
        $61, $62, $63, $64,
        $65,
        $66, $67,
        $68, $69, $70, $71,
        $72, $73, $74, $75, $76,
        $77, $78,
        $79,
        $80, $81,
        $82, $83, $84,
        $85, $86, $87
      )
      ON CONFLICT (portal, portal_id, property_category)
      DO UPDATE SET
        title = EXCLUDED.title,
        price = EXCLUDED.price,
        location = EXCLUDED.location,
        city = EXCLUDED.city,
        region = EXCLUDED.region,
        latitude = COALESCE(EXCLUDED.latitude, properties.latitude),
        longitude = COALESCE(EXCLUDED.longitude, properties.longitude),
        house_bedrooms = EXCLUDED.house_bedrooms,
        house_bathrooms = EXCLUDED.house_bathrooms,
        house_sqm_living = EXCLUDED.house_sqm_living,
        house_sqm_total = EXCLUDED.house_sqm_total,
        house_sqm_plot = EXCLUDED.house_sqm_plot,
        house_stories = EXCLUDED.house_stories,
        house_rooms = EXCLUDED.house_rooms,
        house_has_garden = EXCLUDED.house_has_garden,
        house_garden_area = EXCLUDED.house_garden_area,
        house_has_garage = EXCLUDED.house_has_garage,
        house_garage_count = EXCLUDED.house_garage_count,
        house_has_parking = EXCLUDED.house_has_parking,
        house_parking_spaces = EXCLUDED.house_parking_spaces,
        house_has_basement = EXCLUDED.house_has_basement,
        house_cellar_area = EXCLUDED.house_cellar_area,
        house_has_pool = EXCLUDED.house_has_pool,
        house_has_fireplace = EXCLUDED.house_has_fireplace,
        house_has_terrace = EXCLUDED.house_has_terrace,
        house_terrace_area = EXCLUDED.house_terrace_area,
        house_has_attic = EXCLUDED.house_has_attic,
        house_has_balcony = EXCLUDED.house_has_balcony,
        house_balcony_area = EXCLUDED.house_balcony_area,
        house_property_subtype = EXCLUDED.house_property_subtype,
        house_year_built = EXCLUDED.house_year_built,
        house_renovation_year = EXCLUDED.house_renovation_year,
        house_construction_type = EXCLUDED.house_construction_type,
        house_condition = EXCLUDED.house_condition,
        house_heating_type = EXCLUDED.house_heating_type,
        house_roof_type = EXCLUDED.house_roof_type,
        house_energy_class = EXCLUDED.house_energy_class,
        house_property_tax = EXCLUDED.house_property_tax,
        house_hoa_fees = EXCLUDED.house_hoa_fees,
        house_deposit = EXCLUDED.house_deposit,
        house_utility_charges = EXCLUDED.house_utility_charges,
        house_service_charges = EXCLUDED.house_service_charges,
        house_is_commission = EXCLUDED.house_is_commission,
        house_commission_note = EXCLUDED.house_commission_note,
        house_available_from = EXCLUDED.house_available_from,
        house_min_rent_days = EXCLUDED.house_min_rent_days,
        house_max_rent_days = EXCLUDED.house_max_rent_days,
        media = EXCLUDED.media,
        agent = EXCLUDED.agent,
        features = EXCLUDED.features,
        description = EXCLUDED.description,
        images = EXCLUDED.images,
        videos = EXCLUDED.videos,
        portal_metadata = EXCLUDED.portal_metadata,
        country_specific = EXCLUDED.country_specific,
        raw_data = EXCLUDED.raw_data,
        condition = COALESCE(EXCLUDED.condition, properties.condition),
        heating_type = COALESCE(EXCLUDED.heating_type, properties.heating_type),
        furnished = COALESCE(EXCLUDED.furnished, properties.furnished),
        construction_type = COALESCE(EXCLUDED.construction_type, properties.construction_type),
        renovation_year = COALESCE(EXCLUDED.renovation_year, properties.renovation_year),
        available_from = COALESCE(EXCLUDED.available_from, properties.available_from),
        published_date = COALESCE(EXCLUDED.published_date, properties.published_date),
        deposit = COALESCE(EXCLUDED.deposit, properties.deposit),
        parking_spaces = COALESCE(EXCLUDED.parking_spaces, properties.parking_spaces),
        is_commission = COALESCE(EXCLUDED.is_commission, properties.is_commission),
        commission_note = COALESCE(EXCLUDED.commission_note, properties.commission_note),
        external_source_url = COALESCE(EXCLUDED.external_source_url, properties.external_source_url),
        czech_disposition = COALESCE(EXCLUDED.czech_disposition, properties.czech_disposition),
        czech_ownership = COALESCE(EXCLUDED.czech_ownership, properties.czech_ownership),
        district = COALESCE(EXCLUDED.district, properties.district),
        neighbourhood = COALESCE(EXCLUDED.neighbourhood, properties.neighbourhood),
        municipality = COALESCE(EXCLUDED.municipality, properties.municipality),
        agent_name = COALESCE(EXCLUDED.agent_name, properties.agent_name),
        agent_phone = COALESCE(EXCLUDED.agent_phone, properties.agent_phone),
        agent_email = COALESCE(EXCLUDED.agent_email, properties.agent_email),
        status = CASE
          WHEN properties.status IN ('sold', 'rented') THEN properties.status
          ELSE 'active'
        END,
        last_seen_at = NOW(),
        last_updated_at = NOW(),
        updated_at = NOW()
      RETURNING id;
    `;

    // Geo enrichment: use pre-enriched data or lookup
    const houseGeo = ((house as any).district || (house as any).municipality)
      ? { district: (house as any).district, neighbourhood: (house as any).neighbourhood || null, municipality: (house as any).municipality || null }
      : await (async () => {
          const lat = house.location?.coordinates?.lat;
          const lon = house.location?.coordinates?.lon;
          if (lat && lon) {
            const g = await lookupGeoEnrichment(lat, lon);
            return { district: g.district, neighbourhood: g.neighbourhood, municipality: g.municipality };
          }
          return { district: null, neighbourhood: null, municipality: null };
        })();

    const params = [
      house.source_platform,
      house.portal_id || `${house.source_platform}-${Date.now()}`,
      house.source_url,
      house.source_platform,
      house.title,
      house.price,
      house.currency,
      house.transaction_type,
      JSON.stringify(house.location),
      house.location.city?.substring(0, 255),
      house.location.region?.substring(0, 255),
      house.location.country,
      house.location.postal_code,
      house.location.coordinates?.lat,
      house.location.coordinates?.lon,
      house.status || 'active',
      house.bedrooms,
      house.bathrooms,
      house.sqm_living,
      house.sqm_total,
      house.sqm_plot,
      house.stories,
      house.rooms,
      house.has_garden,
      house.garden_area,
      house.has_garage,
      house.garage_count,
      house.has_parking,
      house.parking_spaces,
      house.has_basement,
      house.cellar_area,
      house.has_pool,
      house.has_fireplace,
      house.has_terrace,
      house.terrace_area,
      house.has_attic,
      house.has_balcony,
      house.balcony_area,
      house.property_subtype?.substring(0, 100),
      house.year_built,
      house.renovation_year,
      house.construction_type?.substring(0, 100),
      house.condition?.substring(0, 100),
      house.heating_type?.substring(0, 100),
      house.roof_type?.substring(0, 100),
      house.energy_class?.substring(0, 100),
      house.property_tax,
      house.hoa_fees,
      house.deposit,
      house.utility_charges,
      house.service_charges,
      house.is_commission ?? null,
      house.commission_note || null,
      house.available_from,
      house.min_rent_days,
      house.max_rent_days,
      JSON.stringify(house.media || {}),
      JSON.stringify(house.agent || {}),
      house.features || [],
      house.description,
      JSON.stringify(house.images || []),
      JSON.stringify(house.videos || []),
      JSON.stringify(house.portal_metadata || {}),
      JSON.stringify(house.country_specific || {}),
      JSON.stringify(house), // raw_data = entire house object
      house.first_seen_at || new Date(),
      house.last_seen_at || new Date(),
      // Universal Tier 1 fields
      (house.condition || null)?.substring(0, 100),
      (house.heating_type || null)?.substring(0, 100),
      house.furnished || null,
      (house.construction_type || null)?.substring(0, 100),
      house.renovation_year || null,
      convertToPostgresDate(house.available_from),
      convertToPostgresDate(house.published_date),
      house.deposit || null,
      house.parking_spaces || null,
      house.is_commission ?? null,
      house.commission_note || null,
      (house as HousePropertyTierI & ExternalFields).external_source_url || null,
      (house as any).country_specific?.czech_disposition ?? (house as any).czech_disposition ?? null,
      (house as any).country_specific?.czech_ownership ?? (house as any).czech_ownership ?? null,
      houseGeo.district,
      houseGeo.neighbourhood,
      houseGeo.municipality,
      house.agent?.name || null,
      house.agent?.phone || null,
      house.agent?.email || null,
    ];

    const result = await pool.query(query, params);
    const row = result.rows[0];
    propertyIds.push(row.id);

    // Stamp last_scrape_run_id (best-effort)
    if (scrapeRunId) {
      pool.query(`UPDATE properties SET last_scrape_run_id = $1 WHERE id = $2`, [scrapeRunId, row.id]).catch(() => {});
    }

    // Detect changes for notification system
    const houseKey = `${house.source_platform}:${house.portal_id || ''}`;
    const old = oldDataMap.get(houseKey);
    let event_type: PropertyEventType | null = null;
    let old_price: number | undefined;

    if (!old) {
      event_type = 'new_listing';
      inserted++;
      newPropertyEntries.push({ id: row.id, status: (house.status as any) || 'active' });
    } else {
      updated++;
      const oldPriceNum = Number(old.price);
      const newPriceNum = Number(house.price);
      if (old.price !== null && old.price !== undefined) {
        if (newPriceNum < oldPriceNum) {
          event_type = 'price_drop';
          old_price = oldPriceNum;
        } else if (newPriceNum > oldPriceNum) {
          event_type = 'price_increase';
          old_price = oldPriceNum;
        }
      }
    }

    if (event_type) {
      const snapshot: PropertyFilterSnapshot = {
        property_category: 'house',
        transaction_type: house.transaction_type,
        city: house.location?.city,
        region: house.location?.region,
        district: houseGeo.district ?? undefined,
        neighbourhood: houseGeo.neighbourhood ?? undefined,
        municipality: houseGeo.municipality ?? undefined,
        price: Number(house.price),
        currency: house.currency,
        bedrooms: house.bedrooms,
        bathrooms: house.bathrooms,
        sqm_living: house.sqm_living,
        sqm_plot: house.sqm_plot,
        furnished: house.furnished,
        construction_type: house.construction_type,
        energy_class: house.energy_class,
        year_built: house.year_built,
        disposition: (house as any).country_specific?.czech_disposition ?? (house as any).czech_disposition,
        ownership: (house as any).country_specific?.czech_ownership ?? (house as any).czech_ownership,
        condition: house.condition,
        building_type: house.construction_type,
        has_parking: house.has_parking,
        has_pool: house.has_pool,
        has_garden: house.has_garden,
        has_balcony: house.has_balcony,
        has_terrace: house.has_terrace,
        has_garage: house.has_garage,
        has_basement: house.has_basement,
      };

      changes.push({
        property_id: row.id,
        portal_id: house.portal_id || '',
        event_type,
        property_category: 'house',
        city: house.location?.city || '',
        region: house.location?.region,
        price: Number(house.price),
        old_price,
        title: house.title,
        source_url: house.source_url,
        images: house.images,
        filter_snapshot: snapshot,
      });
    }
  }

  // Initialize status history for newly inserted houses (best-effort)
  if (newPropertyEntries.length > 0) {
    try {
      await bulkOpenInitialStatusPeriods(pool, newPropertyEntries);
    } catch (e) {
      dbLog.warn({ err: e, metric: 'bulk_ops.status_history.failure', operation: 'bulkOpenInitialStatusPeriodsHouses' }, 'Failed to initialize house status history');
    }
  }

  // Cross-portal dedup for newly inserted houses (fire-and-forget)
  {
    const dedupCandidates: Array<{ id: string; portal: string; lat: number; lon: number; price: number; transaction_type: string | null; portal_id: string }> = [];
    for (let i = 0; i < houses.length; i++) {
      const house = houses[i];
      const key = `${house.source_platform}:${house.portal_id || ''}`;
      const old = oldDataMap.get(key);
      if (old) continue; // not newly inserted
      const lat = house.location?.coordinates?.lat ?? null;
      const lon = house.location?.coordinates?.lon ?? null;
      if (lat == null || lon == null || !house.price) continue;
      dedupCandidates.push({
        id: propertyIds[i],
        portal: house.source_platform,
        lat, lon,
        price: Number(house.price),
        transaction_type: house.transaction_type ?? null,
        portal_id: house.portal_id || '',
      });
    }
    runInlineDedupAsync(pool, dedupCandidates, 'properties_house');
  }

  // Write price changes to price_history table + JSONB column (best-effort)
  try {
    const phIds: string[] = [];
    const phPrices: number[] = [];
    const phCurrencies: string[] = [];
    for (let i = 0; i < houses.length; i++) {
      const house = houses[i];
      const key = `${house.source_platform}:${house.portal_id || ''}`;
      const old = oldDataMap.get(key);
      if (old && old.price !== null && old.price !== undefined && String(old.price) !== String(house.price)) {
        phIds.push(propertyIds[i]);
        phPrices.push(Number(house.price));
        phCurrencies.push(house.currency || 'CZK');
      }
    }
    if (phIds.length > 0) {
      await pool.query(
        `UPDATE properties
         SET price_history = price_history || jsonb_build_array(
           jsonb_build_object('date', to_jsonb(NOW()), 'price', v.new_price)
         )
         FROM (SELECT UNNEST($1::uuid[]) AS id, UNNEST($2::numeric[]) AS new_price) v
         WHERE properties.id = v.id`,
        [phIds, phPrices]
      );
      const phValues: string[] = [];
      const phParams: unknown[] = [];
      for (let i = 0; i < phIds.length; i++) {
        phValues.push(`($${i * 3 + 1}::uuid, $${i * 3 + 2}::numeric, $${i * 3 + 3}::varchar)`);
        phParams.push(phIds[i], phPrices[i], phCurrencies[i]);
      }
      await pool.query(
        `INSERT INTO price_history (property_id, price, currency) VALUES ${phValues.join(', ')}`,
        phParams
      );
    }
  } catch (e) {
    dbLog.warn({ err: e, metric: 'bulk_ops.price_history_append.failure', operation: 'appendPriceHistoryHouses' }, 'Failed to record house price history');
  }

  dbLog.info({ inserted, updated, count: houses.length, changes: changes.length }, 'House upsert complete');

  return { inserted, updated, propertyIds, changes };
}

/**
 * Upsert land to properties (partitioned table)
 * @param land - Array of land properties
 * @param country - Country code (e.g., 'czech', 'slovakia')
 */
export async function upsertLand(
  land: LandPropertyTierI[],
  country: string = 'czech',
  scrapeRunId?: string
): Promise<UpsertResult> {
  if (land.length === 0) {
    return { inserted: 0, updated: 0, propertyIds: [], changes: [] };
  }

  const pool = getCoreDatabase(country);
  const propertyIds: string[] = [];
  const changes: PropertyChangeEvent[] = [];
  const newPropertyEntries: Array<{ id: string; status: 'active' | 'removed' | 'sold' | 'rented' }> = [];
  let inserted = 0;
  let updated = 0;

  // Pre-SELECT existing rows for change detection
  const portals = land.map(l => l.source_platform);
  const portalIds = land.map(l => l.portal_id || '');
  const oldDataResult = await pool.query(
    `SELECT id, portal, portal_id, price, status
     FROM properties
     WHERE property_category = 'land'
       AND (portal, portal_id) IN (
         SELECT * FROM UNNEST($1::varchar[], $2::varchar[])
       )`,
    [portals, portalIds]
  );
  const oldDataMap = new Map<string, { id: string; price: any; status: string }>();
  for (const row of oldDataResult.rows) {
    oldDataMap.set(`${row.portal}:${row.portal_id}`, { id: row.id, price: row.price, status: row.status });
  }

  for (const plot of land) {
    const query = `
      INSERT INTO properties (
        property_category,
        portal, portal_id, source_url, source_platform,
        title, price, currency, transaction_type,
        location, city, region, country, postal_code, latitude, longitude,
        status,
        land_area_plot_sqm, land_property_subtype,
        land_zoning, land_land_type,
        land_water_supply, land_sewage, land_electricity, land_gas,
        land_road_access,
        land_building_permit, land_max_building_coverage, land_max_building_height,
        land_terrain, land_soil_quality,
        land_cadastral_number, land_ownership_type,
        land_available_from,
        land_has_water_connection, land_has_electricity_connection,
        land_has_sewage_connection, land_has_gas_connection,
        land_is_commission, land_commission_note,
        media, agent, features, description,
        images, videos, portal_metadata, country_specific,
        raw_data,
        first_seen_at, last_seen_at,
        condition, heating_type, furnished, construction_type,
        renovation_year, available_from, published_date, deposit, parking_spaces,
        is_commission, commission_note,
        external_source_url,
        czech_disposition, czech_ownership,
        district, neighbourhood, municipality,
        agent_name, agent_phone, agent_email
      )
      VALUES (
        'land',
        $1, $2, $3, $4,
        $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14, $15,
        $16,
        $17, $18,
        $19, $20,
        $21, $22, $23, $24,
        $25,
        $26, $27, $28,
        $29, $30,
        $31, $32,
        $33,
        $34, $35,
        $36, $37,
        $38, $39,
        $40, $41, $42, $43,
        $44, $45, $46, $47,
        $48,
        $49, $50,
        $51, $52, $53, $54,
        $55, $56, $57, $58, $59,
        $60, $61,
        $62,
        $63, $64,
        $65, $66, $67,
        $68, $69, $70
      )
      ON CONFLICT (portal, portal_id, property_category)
      DO UPDATE SET
        title = EXCLUDED.title,
        price = EXCLUDED.price,
        location = EXCLUDED.location,
        city = EXCLUDED.city,
        region = EXCLUDED.region,
        latitude = COALESCE(EXCLUDED.latitude, properties.latitude),
        longitude = COALESCE(EXCLUDED.longitude, properties.longitude),
        land_area_plot_sqm = EXCLUDED.land_area_plot_sqm,
        land_property_subtype = EXCLUDED.land_property_subtype,
        land_zoning = EXCLUDED.land_zoning,
        land_land_type = EXCLUDED.land_land_type,
        land_water_supply = EXCLUDED.land_water_supply,
        land_sewage = EXCLUDED.land_sewage,
        land_electricity = EXCLUDED.land_electricity,
        land_gas = EXCLUDED.land_gas,
        land_road_access = EXCLUDED.land_road_access,
        land_building_permit = EXCLUDED.land_building_permit,
        land_max_building_coverage = EXCLUDED.land_max_building_coverage,
        land_max_building_height = EXCLUDED.land_max_building_height,
        land_terrain = EXCLUDED.land_terrain,
        land_soil_quality = EXCLUDED.land_soil_quality,
        land_cadastral_number = EXCLUDED.land_cadastral_number,
        land_ownership_type = EXCLUDED.land_ownership_type,
        land_available_from = EXCLUDED.land_available_from,
        land_has_water_connection = EXCLUDED.land_has_water_connection,
        land_has_electricity_connection = EXCLUDED.land_has_electricity_connection,
        land_has_sewage_connection = EXCLUDED.land_has_sewage_connection,
        land_has_gas_connection = EXCLUDED.land_has_gas_connection,
        land_is_commission = EXCLUDED.land_is_commission,
        land_commission_note = EXCLUDED.land_commission_note,
        media = EXCLUDED.media,
        agent = EXCLUDED.agent,
        features = EXCLUDED.features,
        description = EXCLUDED.description,
        images = EXCLUDED.images,
        videos = EXCLUDED.videos,
        portal_metadata = EXCLUDED.portal_metadata,
        country_specific = EXCLUDED.country_specific,
        raw_data = EXCLUDED.raw_data,
        condition = COALESCE(EXCLUDED.condition, properties.condition),
        heating_type = COALESCE(EXCLUDED.heating_type, properties.heating_type),
        furnished = COALESCE(EXCLUDED.furnished, properties.furnished),
        construction_type = COALESCE(EXCLUDED.construction_type, properties.construction_type),
        renovation_year = COALESCE(EXCLUDED.renovation_year, properties.renovation_year),
        available_from = COALESCE(EXCLUDED.available_from, properties.available_from),
        published_date = COALESCE(EXCLUDED.published_date, properties.published_date),
        deposit = COALESCE(EXCLUDED.deposit, properties.deposit),
        parking_spaces = COALESCE(EXCLUDED.parking_spaces, properties.parking_spaces),
        is_commission = COALESCE(EXCLUDED.is_commission, properties.is_commission),
        commission_note = COALESCE(EXCLUDED.commission_note, properties.commission_note),
        external_source_url = COALESCE(EXCLUDED.external_source_url, properties.external_source_url),
        czech_disposition = COALESCE(EXCLUDED.czech_disposition, properties.czech_disposition),
        czech_ownership = COALESCE(EXCLUDED.czech_ownership, properties.czech_ownership),
        district = COALESCE(EXCLUDED.district, properties.district),
        neighbourhood = COALESCE(EXCLUDED.neighbourhood, properties.neighbourhood),
        municipality = COALESCE(EXCLUDED.municipality, properties.municipality),
        agent_name = COALESCE(EXCLUDED.agent_name, properties.agent_name),
        agent_phone = COALESCE(EXCLUDED.agent_phone, properties.agent_phone),
        agent_email = COALESCE(EXCLUDED.agent_email, properties.agent_email),
        status = CASE
          WHEN properties.status IN ('sold', 'rented') THEN properties.status
          ELSE 'active'
        END,
        last_seen_at = NOW(),
        last_updated_at = NOW(),
        updated_at = NOW()
      RETURNING id;
    `;

    const plotGeo = ((plot as any).district || (plot as any).municipality)
      ? { district: (plot as any).district, neighbourhood: (plot as any).neighbourhood || null, municipality: (plot as any).municipality || null }
      : await (async () => {
          const lat = plot.location?.coordinates?.lat;
          const lon = plot.location?.coordinates?.lon;
          if (lat && lon) { const g = await lookupGeoEnrichment(lat, lon); return { district: g.district, neighbourhood: g.neighbourhood, municipality: g.municipality }; }
          return { district: null, neighbourhood: null, municipality: null };
        })();

    const params = [
      plot.source_platform,
      plot.portal_id || `${plot.source_platform}-${Date.now()}`,
      plot.source_url,
      plot.source_platform,
      plot.title,
      plot.price,
      plot.currency,
      plot.transaction_type,
      JSON.stringify(plot.location),
      plot.location.city?.substring(0, 255),
      plot.location.region?.substring(0, 255),
      plot.location.country,
      plot.location.postal_code,
      plot.location.coordinates?.lat,
      plot.location.coordinates?.lon,
      plot.status || 'active',
      plot.area_plot_sqm,
      plot.property_subtype,
      plot.zoning,
      plot.land_type,
      plot.water_supply,
      plot.sewage,
      plot.electricity,
      plot.gas,
      plot.road_access,
      plot.building_permit,
      plot.max_building_coverage,
      plot.max_building_height,
      plot.terrain,
      plot.soil_quality,
      plot.cadastral_number,
      plot.ownership_type,
      plot.available_from,
      plot.has_water_connection,
      plot.has_electricity_connection,
      plot.has_sewage_connection,
      plot.has_gas_connection,
      (plot as any).is_commission ?? null,
      (plot as any).commission_note || null,
      JSON.stringify(plot.media || {}),
      JSON.stringify(plot.agent || {}),
      plot.features || [],
      plot.description,
      JSON.stringify(plot.images || []),
      JSON.stringify(plot.videos || []),
      JSON.stringify(plot.portal_metadata || {}),
      JSON.stringify(plot.country_specific || {}),
      JSON.stringify(plot), // raw_data = entire land object
      plot.first_seen_at || new Date(),
      plot.last_seen_at || new Date(),
      // Universal Tier 1 fields (land doesn't have most of these, but DB columns exist)
      null, // condition - not applicable to land
      null, // heating_type - not applicable to land
      plot.furnished || null,
      null, // construction_type - not applicable to land
      plot.renovation_year || null,
      convertToPostgresDate(plot.available_from),
      convertToPostgresDate(plot.published_date),
      null, // deposit - not applicable to land
      null, // parking_spaces - not applicable to land
      (plot as any).is_commission ?? null,
      (plot as any).commission_note || null,
      (plot as LandPropertyTierI & ExternalFields).external_source_url || null,
      (plot as any).country_specific?.czech_disposition ?? (plot as any).czech_disposition ?? null,
      (plot as any).country_specific?.czech_ownership ?? (plot as any).czech_ownership ?? null,
      plotGeo.district,
      plotGeo.neighbourhood,
      plotGeo.municipality,
      plot.agent?.name || null,
      plot.agent?.phone || null,
      plot.agent?.email || null,
    ];

    const result = await pool.query(query, params);
    const row = result.rows[0];
    propertyIds.push(row.id);

    // Stamp last_scrape_run_id (best-effort)
    if (scrapeRunId) {
      pool.query(`UPDATE properties SET last_scrape_run_id = $1 WHERE id = $2`, [scrapeRunId, row.id]).catch(() => {});
    }

    // Detect changes for notification system
    const landKey = `${plot.source_platform}:${plot.portal_id || ''}`;
    const old = oldDataMap.get(landKey);
    let event_type: PropertyEventType | null = null;
    let old_price: number | undefined;

    if (!old) {
      event_type = 'new_listing';
      inserted++;
      newPropertyEntries.push({ id: row.id, status: (plot.status as any) || 'active' });
    } else {
      updated++;
      const oldPriceNum = Number(old.price);
      const newPriceNum = Number(plot.price);
      if (old.price !== null && old.price !== undefined) {
        if (newPriceNum < oldPriceNum) {
          event_type = 'price_drop';
          old_price = oldPriceNum;
        } else if (newPriceNum > oldPriceNum) {
          event_type = 'price_increase';
          old_price = oldPriceNum;
        }
      }
    }

    if (event_type) {
      const snapshot: PropertyFilterSnapshot = {
        property_category: 'land',
        transaction_type: plot.transaction_type,
        city: plot.location?.city,
        region: plot.location?.region,
        district: plotGeo.district ?? undefined,
        neighbourhood: plotGeo.neighbourhood ?? undefined,
        municipality: plotGeo.municipality ?? undefined,
        price: Number(plot.price),
        currency: plot.currency,
        area_plot_sqm: plot.area_plot_sqm,
        disposition: (plot as any).country_specific?.czech_disposition ?? (plot as any).czech_disposition,
        ownership: (plot as any).country_specific?.czech_ownership ?? (plot as any).czech_ownership,
      };

      changes.push({
        property_id: row.id,
        portal_id: plot.portal_id || '',
        event_type,
        property_category: 'land',
        city: plot.location?.city || '',
        region: plot.location?.region,
        price: Number(plot.price),
        old_price,
        title: plot.title,
        source_url: plot.source_url,
        images: plot.images,
        filter_snapshot: snapshot,
      });
    }
  }

  // Initialize status history for newly inserted land (best-effort)
  if (newPropertyEntries.length > 0) {
    try {
      await bulkOpenInitialStatusPeriods(pool, newPropertyEntries);
    } catch (e) {
      dbLog.warn({ err: e, metric: 'bulk_ops.status_history.failure', operation: 'bulkOpenInitialStatusPeriodsLand' }, 'Failed to initialize land status history');
    }
  }

  // Cross-portal dedup for newly inserted land (fire-and-forget)
  {
    const dedupCandidates: Array<{ id: string; portal: string; lat: number; lon: number; price: number; transaction_type: string | null; portal_id: string }> = [];
    for (let i = 0; i < land.length; i++) {
      const item = land[i];
      const key = `${item.source_platform}:${item.portal_id || ''}`;
      const old = oldDataMap.get(key);
      if (old) continue;
      const lat = item.location?.coordinates?.lat ?? null;
      const lon = item.location?.coordinates?.lon ?? null;
      if (lat == null || lon == null || !item.price) continue;
      dedupCandidates.push({
        id: propertyIds[i],
        portal: item.source_platform,
        lat, lon,
        price: Number(item.price),
        transaction_type: item.transaction_type ?? null,
        portal_id: item.portal_id || '',
      });
    }
    runInlineDedupAsync(pool, dedupCandidates, 'properties_land');
  }

  // Write price changes to price_history table + JSONB column (best-effort)
  try {
    const phIds: string[] = [];
    const phPrices: number[] = [];
    const phCurrencies: string[] = [];
    for (let i = 0; i < land.length; i++) {
      const plot = land[i];
      const key = `${plot.source_platform}:${plot.portal_id || ''}`;
      const old = oldDataMap.get(key);
      if (old && old.price !== null && old.price !== undefined && String(old.price) !== String(plot.price)) {
        phIds.push(propertyIds[i]);
        phPrices.push(Number(plot.price));
        phCurrencies.push(plot.currency || 'CZK');
      }
    }
    if (phIds.length > 0) {
      await pool.query(
        `UPDATE properties
         SET price_history = price_history || jsonb_build_array(
           jsonb_build_object('date', to_jsonb(NOW()), 'price', v.new_price)
         )
         FROM (SELECT UNNEST($1::uuid[]) AS id, UNNEST($2::numeric[]) AS new_price) v
         WHERE properties.id = v.id`,
        [phIds, phPrices]
      );
      const phValues: string[] = [];
      const phParams: unknown[] = [];
      for (let i = 0; i < phIds.length; i++) {
        phValues.push(`($${i * 3 + 1}::uuid, $${i * 3 + 2}::numeric, $${i * 3 + 3}::varchar)`);
        phParams.push(phIds[i], phPrices[i], phCurrencies[i]);
      }
      await pool.query(
        `INSERT INTO price_history (property_id, price, currency) VALUES ${phValues.join(', ')}`,
        phParams
      );
    }
  } catch (e) {
    dbLog.warn({ err: e, metric: 'bulk_ops.price_history_append.failure', operation: 'appendPriceHistoryLand' }, 'Failed to record land price history');
  }

  dbLog.info({ inserted, updated, count: land.length, changes: changes.length }, 'Land upsert complete');

  return { inserted, updated, propertyIds, changes };
}

/**
 * Upsert Commercial Properties
 * Inserts or updates commercial properties in properties_commercial partition
 *
 * IMPORTANT: Uses migration 013 schema (comm_floor_area, comm_floor_number, etc.)
 * Maps from CommercialPropertyTierI to actual database columns
 */
export async function upsertCommercial(
  commercial: CommercialPropertyTierI[],
  country: string = 'czech',
  scrapeRunId?: string
): Promise<UpsertResult> {
  if (commercial.length === 0) {
    return { inserted: 0, updated: 0, propertyIds: [], changes: [] };
  }

  const pool = getCoreDatabase(country);
  const propertyIds: string[] = [];
  const changes: PropertyChangeEvent[] = [];
  const newPropertyEntries: Array<{ id: string; status: 'active' | 'removed' | 'sold' | 'rented' }> = [];
  let inserted = 0;
  let updated = 0;

  // Pre-SELECT existing rows for change detection
  const portals = commercial.map(c => c.source_platform);
  const portalIds = commercial.map(c => c.portal_id || '');
  const oldDataResult = await pool.query(
    `SELECT id, portal, portal_id, price, status
     FROM properties
     WHERE property_category = 'commercial'
       AND (portal, portal_id) IN (
         SELECT * FROM UNNEST($1::varchar[], $2::varchar[])
       )`,
    [portals, portalIds]
  );
  const oldDataMap = new Map<string, { id: string; price: any; status: string }>();
  for (const row of oldDataResult.rows) {
    oldDataMap.set(`${row.portal}:${row.portal_id}`, { id: row.id, price: row.price, status: row.status });
  }

  for (const property of commercial) {
    const query = `
      INSERT INTO properties (
        property_category,
        portal, portal_id, source_url, source_platform,
        title, price, currency, transaction_type,
        location, city, region, country, postal_code, latitude, longitude,
        status,
        -- Commercial-specific fields (migration 013 schema)
        comm_property_subtype,
        comm_floor_area,
        comm_total_floors, comm_floor_number,
        comm_office_spaces, comm_meeting_rooms, comm_ceiling_height,
        comm_parking_spaces, comm_loading_docks,
        comm_has_elevator, comm_has_parking, comm_has_loading_bay,
        comm_has_reception, comm_has_kitchen, comm_has_conference_room,
        comm_has_server_room, comm_has_backup_power,
        comm_has_security_system, comm_has_hvac, comm_has_fire_safety,
        comm_year_built, comm_renovation_year, comm_construction_type,
        comm_condition, comm_heating_type, comm_cooling_type, comm_energy_class,
        comm_operating_costs, comm_service_charges,
        comm_property_tax, comm_hoa_fees, comm_deposit,
        comm_is_commission, comm_commission_note,
        comm_min_lease_months, comm_available_from,
        comm_zoning, comm_permitted_use, comm_max_occupancy,
        comm_accessibility_features, comm_internet_speed, comm_utilities_included,
        media, agent, features, description,
        images, videos, portal_metadata, country_specific,
        raw_data, first_seen_at, last_seen_at,
        condition, heating_type, furnished, construction_type,
        renovation_year, available_from, published_date, deposit, parking_spaces,
        is_commission, commission_note,
        external_source_url,
        czech_disposition, czech_ownership,
        district, neighbourhood, municipality,
        agent_name, agent_phone, agent_email
      )
      VALUES (
        'commercial',
        $1, $2, $3, $4,
        $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14, $15,
        $16,
        $17,
        $18,
        $19, $20,
        $21, $22, $23,
        $24, $25,
        $26, $27, $28,
        $29, $30, $31,
        $32, $33,
        $34, $35, $36,
        $37, $38, $39,
        $40, $41, $42, $43,
        $44, $45,
        $46, $47, $48,
        $49, $50,
        $51, $52,
        $53, $54, $55,
        $56, $57, $58,
        $59, $60, $61, $62,
        $63, $64, $65, $66,
        $67, $68, $69,
        $70, $71, $72, $73,
        $74, $75, $76, $77, $78,
        $79, $80,
        $81,
        $82, $83,
        $84, $85, $86,
        $87, $88, $89
      )
      ON CONFLICT (portal, portal_id, property_category)
      DO UPDATE SET
        title = EXCLUDED.title,
        price = EXCLUDED.price,
        currency = EXCLUDED.currency,
        transaction_type = EXCLUDED.transaction_type,
        location = EXCLUDED.location,
        city = EXCLUDED.city,
        region = EXCLUDED.region,
        postal_code = EXCLUDED.postal_code,
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        comm_property_subtype = EXCLUDED.comm_property_subtype,
        comm_floor_area = EXCLUDED.comm_floor_area,
        comm_total_floors = EXCLUDED.comm_total_floors,
        comm_floor_number = EXCLUDED.comm_floor_number,
        comm_office_spaces = EXCLUDED.comm_office_spaces,
        comm_meeting_rooms = EXCLUDED.comm_meeting_rooms,
        comm_ceiling_height = EXCLUDED.comm_ceiling_height,
        comm_parking_spaces = EXCLUDED.comm_parking_spaces,
        comm_loading_docks = EXCLUDED.comm_loading_docks,
        comm_has_elevator = EXCLUDED.comm_has_elevator,
        comm_has_parking = EXCLUDED.comm_has_parking,
        comm_has_loading_bay = EXCLUDED.comm_has_loading_bay,
        comm_has_reception = EXCLUDED.comm_has_reception,
        comm_has_kitchen = EXCLUDED.comm_has_kitchen,
        comm_has_conference_room = EXCLUDED.comm_has_conference_room,
        comm_has_server_room = EXCLUDED.comm_has_server_room,
        comm_has_backup_power = EXCLUDED.comm_has_backup_power,
        comm_has_security_system = EXCLUDED.comm_has_security_system,
        comm_has_hvac = EXCLUDED.comm_has_hvac,
        comm_has_fire_safety = EXCLUDED.comm_has_fire_safety,
        comm_year_built = EXCLUDED.comm_year_built,
        comm_renovation_year = EXCLUDED.comm_renovation_year,
        comm_construction_type = EXCLUDED.comm_construction_type,
        comm_condition = EXCLUDED.comm_condition,
        comm_heating_type = EXCLUDED.comm_heating_type,
        comm_cooling_type = EXCLUDED.comm_cooling_type,
        comm_energy_class = EXCLUDED.comm_energy_class,
        comm_operating_costs = EXCLUDED.comm_operating_costs,
        comm_service_charges = EXCLUDED.comm_service_charges,
        comm_property_tax = EXCLUDED.comm_property_tax,
        comm_hoa_fees = EXCLUDED.comm_hoa_fees,
        comm_deposit = EXCLUDED.comm_deposit,
        comm_is_commission = EXCLUDED.comm_is_commission,
        comm_commission_note = EXCLUDED.comm_commission_note,
        comm_min_lease_months = EXCLUDED.comm_min_lease_months,
        comm_available_from = EXCLUDED.comm_available_from,
        comm_zoning = EXCLUDED.comm_zoning,
        comm_permitted_use = EXCLUDED.comm_permitted_use,
        comm_max_occupancy = EXCLUDED.comm_max_occupancy,
        comm_accessibility_features = EXCLUDED.comm_accessibility_features,
        comm_internet_speed = EXCLUDED.comm_internet_speed,
        comm_utilities_included = EXCLUDED.comm_utilities_included,
        media = EXCLUDED.media,
        agent = EXCLUDED.agent,
        features = EXCLUDED.features,
        description = EXCLUDED.description,
        images = EXCLUDED.images,
        videos = EXCLUDED.videos,
        portal_metadata = EXCLUDED.portal_metadata,
        country_specific = EXCLUDED.country_specific,
        raw_data = EXCLUDED.raw_data,
        condition = COALESCE(EXCLUDED.condition, properties.condition),
        heating_type = COALESCE(EXCLUDED.heating_type, properties.heating_type),
        furnished = COALESCE(EXCLUDED.furnished, properties.furnished),
        construction_type = COALESCE(EXCLUDED.construction_type, properties.construction_type),
        renovation_year = COALESCE(EXCLUDED.renovation_year, properties.renovation_year),
        available_from = COALESCE(EXCLUDED.available_from, properties.available_from),
        published_date = COALESCE(EXCLUDED.published_date, properties.published_date),
        deposit = COALESCE(EXCLUDED.deposit, properties.deposit),
        parking_spaces = COALESCE(EXCLUDED.parking_spaces, properties.parking_spaces),
        is_commission = COALESCE(EXCLUDED.is_commission, properties.is_commission),
        commission_note = COALESCE(EXCLUDED.commission_note, properties.commission_note),
        external_source_url = COALESCE(EXCLUDED.external_source_url, properties.external_source_url),
        czech_disposition = COALESCE(EXCLUDED.czech_disposition, properties.czech_disposition),
        czech_ownership = COALESCE(EXCLUDED.czech_ownership, properties.czech_ownership),
        district = COALESCE(EXCLUDED.district, properties.district),
        neighbourhood = COALESCE(EXCLUDED.neighbourhood, properties.neighbourhood),
        municipality = COALESCE(EXCLUDED.municipality, properties.municipality),
        agent_name = COALESCE(EXCLUDED.agent_name, properties.agent_name),
        agent_phone = COALESCE(EXCLUDED.agent_phone, properties.agent_phone),
        agent_email = COALESCE(EXCLUDED.agent_email, properties.agent_email),
        status = CASE
          WHEN properties.status IN ('sold', 'rented') THEN properties.status
          ELSE 'active'
        END,
        last_seen_at = NOW(),
        last_updated_at = NOW(),
        updated_at = NOW()
      RETURNING id, portal, portal_id;
    `;

    const commGeo = ((property as any).district || (property as any).municipality)
      ? { district: (property as any).district, neighbourhood: (property as any).neighbourhood || null, municipality: (property as any).municipality || null }
      : await (async () => {
          const lat = property.location?.coordinates?.lat;
          const lon = property.location?.coordinates?.lon;
          if (lat && lon) {
            const g = await lookupGeoEnrichment(lat, lon);
            return { district: g.district, neighbourhood: g.neighbourhood, municipality: g.municipality };
          }
          return { district: null, neighbourhood: null, municipality: null };
        })();

    const params = [
      // $1-$4: portal identification
      property.source_platform,
      property.portal_id,
      property.source_url,
      property.source_platform,

      // $5-$8: core property data
      property.title,
      property.price,
      property.currency,
      property.transaction_type,

      // $9-$15: location data
      JSON.stringify(property.location),
      property.location?.city?.substring(0, 255) || null,
      property.location?.region?.substring(0, 255) || null,
      property.location?.country || 'Czech Republic',
      property.location?.postal_code || null,
      property.location?.coordinates?.lat || null,
      property.location?.coordinates?.lon || null,

      // $16: status
      property.status || 'active',

      // $17: comm_property_subtype
      property.property_subtype,

      // $18: comm_floor_area (use sqm_total or sqm_usable)
      property.sqm_total || property.sqm_usable,

      // $19-$20: comm_total_floors, comm_floor_number
      property.total_floors,
      property.floor,

      // $21-$23: comm_office_spaces, comm_meeting_rooms, comm_ceiling_height
      null, // office_spaces not in CommercialPropertyTierI
      null, // meeting_rooms not in CommercialPropertyTierI
      property.ceiling_height,

      // $24-$25: comm_parking_spaces, comm_loading_docks
      property.parking_spaces,
      null, // loading_docks not in CommercialPropertyTierI

      // $26-$28: comm_has_elevator, comm_has_parking, comm_has_loading_bay
      property.has_elevator,
      property.has_parking,
      null, // has_loading_bay not in CommercialPropertyTierI

      // $29-$31: comm_has_reception, comm_has_kitchen, comm_has_conference_room
      null, // has_reception not in CommercialPropertyTierI
      property.has_kitchen,
      null, // has_conference_room not in CommercialPropertyTierI

      // $32-$33: comm_has_server_room, comm_has_backup_power
      null, // has_server_room not in CommercialPropertyTierI
      null, // has_backup_power not in CommercialPropertyTierI

      // $34-$36: comm_has_security_system, comm_has_hvac, comm_has_fire_safety
      property.has_security_system,
      property.has_hvac,
      null, // has_fire_safety not in CommercialPropertyTierI

      // $37-$39: comm_year_built, comm_renovation_year, comm_construction_type
      property.year_built,
      property.renovation_year,
      property.construction_type,

      // $40-$43: comm_condition, comm_heating_type, comm_cooling_type, comm_energy_class
      property.condition,
      property.heating_type,
      null, // cooling_type not in CommercialPropertyTierI
      property.energy_class,

      // $44-$45: comm_operating_costs, comm_service_charges
      property.operating_costs,
      property.service_charges,

      // $46-$48: comm_property_tax, comm_hoa_fees, comm_deposit
      null, // property_tax not in CommercialPropertyTierI
      null, // hoa_fees not in CommercialPropertyTierI
      property.deposit,

      // $49-$50: comm_is_commission, comm_commission_note
      (property as any).is_commission ?? null,
      (property as any).commission_note || null,

      // $51-$52: comm_min_lease_months, comm_available_from
      null, // min_lease_months not in CommercialPropertyTierI
      null, // available_from not in CommercialPropertyTierI

      // $53-$55: comm_zoning, comm_permitted_use, comm_max_occupancy
      null, // zoning not in CommercialPropertyTierI
      null, // permitted_use not in CommercialPropertyTierI
      null, // max_occupancy not in CommercialPropertyTierI

      // $56-$58: comm_accessibility_features, comm_internet_speed, comm_utilities_included
      property.has_disabled_access ? ['wheelchair_accessible'] : null,
      null, // internet_speed not in CommercialPropertyTierI
      null, // utilities_included not in CommercialPropertyTierI

      // $59-$62: media, agent, features, description
      JSON.stringify(property.media || {}),
      JSON.stringify(property.agent || {}),
      property.features || [],
      property.description,

      // $63-$66: images, videos, portal_metadata, country_specific
      JSON.stringify(property.images || []),
      JSON.stringify(property.videos || []),
      JSON.stringify(property.portal_metadata || {}),
      JSON.stringify(property.country_specific || {}),

      // $67-$69: raw_data, first_seen_at, last_seen_at
      JSON.stringify(property), // raw_data = entire commercial object
      property.first_seen_at || new Date(),
      property.last_seen_at || new Date(),

      // $70-$80: Universal Tier 1 fields
      property.condition || null,
      property.heating_type || null,
      property.furnished || null,
      property.construction_type || null,
      property.renovation_year || null,
      convertToPostgresDate(property.available_from),
      convertToPostgresDate(property.published_date),
      property.deposit || null,
      property.parking_spaces || null,
      (property as any).is_commission ?? null,
      (property as any).commission_note || null,
      (property as CommercialPropertyTierI & ExternalFields).external_source_url || null,
      (property as any).country_specific?.czech_disposition ?? (property as any).czech_disposition ?? null,
      (property as any).country_specific?.czech_ownership ?? (property as any).czech_ownership ?? null,
      commGeo.district,       // $84
      commGeo.neighbourhood,  // $85
      commGeo.municipality,   // $86
      property.agent?.name || null,   // $87
      property.agent?.phone || null,  // $88
      property.agent?.email || null,  // $89
    ];

    const result = await pool.query(query, params);
    const row = result.rows[0];
    propertyIds.push(row.id);

    // Stamp last_scrape_run_id (best-effort)
    if (scrapeRunId) {
      pool.query(`UPDATE properties SET last_scrape_run_id = $1 WHERE id = $2`, [scrapeRunId, row.id]).catch(() => {});
    }

    // Detect changes for notification system
    const commKey = `${property.source_platform}:${property.portal_id || ''}`;
    const old = oldDataMap.get(commKey);
    let event_type: PropertyEventType | null = null;
    let old_price: number | undefined;

    if (!old) {
      event_type = 'new_listing';
      inserted++;
      newPropertyEntries.push({ id: row.id, status: (property.status as any) || 'active' });
    } else {
      updated++;
      const oldPriceNum = Number(old.price);
      const newPriceNum = Number(property.price);
      if (old.price !== null && old.price !== undefined) {
        if (newPriceNum < oldPriceNum) {
          event_type = 'price_drop';
          old_price = oldPriceNum;
        } else if (newPriceNum > oldPriceNum) {
          event_type = 'price_increase';
          old_price = oldPriceNum;
        }
      }
    }

    if (event_type) {
      const snapshot: PropertyFilterSnapshot = {
        property_category: 'commercial',
        transaction_type: property.transaction_type,
        city: property.location?.city,
        region: property.location?.region,
        district: commGeo.district ?? undefined,
        neighbourhood: commGeo.neighbourhood ?? undefined,
        municipality: commGeo.municipality ?? undefined,
        price: Number(property.price),
        currency: property.currency,
        sqm_total: property.sqm_total || property.sqm_usable,
        furnished: property.furnished,
        construction_type: property.construction_type,
        energy_class: property.energy_class,
        year_built: property.year_built,
        disposition: (property as any).country_specific?.czech_disposition ?? (property as any).czech_disposition,
        ownership: (property as any).country_specific?.czech_ownership ?? (property as any).czech_ownership,
        condition: property.condition,
        has_parking: property.has_parking,
        has_elevator: property.has_elevator,
      };

      changes.push({
        property_id: row.id,
        portal_id: property.portal_id || '',
        event_type,
        property_category: 'commercial',
        city: property.location?.city || '',
        region: property.location?.region,
        price: Number(property.price),
        old_price,
        title: property.title,
        source_url: property.source_url,
        images: property.images,
        filter_snapshot: snapshot,
      });
    }
  }

  // Initialize status history for newly inserted commercial properties (best-effort)
  if (newPropertyEntries.length > 0) {
    try {
      await bulkOpenInitialStatusPeriods(pool, newPropertyEntries);
    } catch (e) {
      dbLog.warn({ err: e, metric: 'bulk_ops.status_history.failure', operation: 'bulkOpenInitialStatusPeriodsCommercial' }, 'Failed to initialize commercial status history');
    }
  }

  // Cross-portal dedup for newly inserted commercial (fire-and-forget)
  {
    const dedupCandidates: Array<{ id: string; portal: string; lat: number; lon: number; price: number; transaction_type: string | null; portal_id: string }> = [];
    for (let i = 0; i < commercial.length; i++) {
      const item = commercial[i];
      const key = `${item.source_platform}:${item.portal_id || ''}`;
      const old = oldDataMap.get(key);
      if (old) continue;
      const lat = item.location?.coordinates?.lat ?? null;
      const lon = item.location?.coordinates?.lon ?? null;
      if (lat == null || lon == null || !item.price) continue;
      dedupCandidates.push({
        id: propertyIds[i],
        portal: item.source_platform,
        lat, lon,
        price: Number(item.price),
        transaction_type: item.transaction_type ?? null,
        portal_id: item.portal_id || '',
      });
    }
    runInlineDedupAsync(pool, dedupCandidates, 'properties_commercial');
  }

  // Write price changes to price_history table + JSONB column (best-effort)
  try {
    const phIds: string[] = [];
    const phPrices: number[] = [];
    const phCurrencies: string[] = [];
    for (let i = 0; i < commercial.length; i++) {
      const prop = commercial[i];
      const key = `${prop.source_platform}:${prop.portal_id || ''}`;
      const old = oldDataMap.get(key);
      if (old && old.price !== null && old.price !== undefined && String(old.price) !== String(prop.price)) {
        phIds.push(propertyIds[i]);
        phPrices.push(Number(prop.price));
        phCurrencies.push(prop.currency || 'CZK');
      }
    }
    if (phIds.length > 0) {
      await pool.query(
        `UPDATE properties
         SET price_history = price_history || jsonb_build_array(
           jsonb_build_object('date', to_jsonb(NOW()), 'price', v.new_price)
         )
         FROM (SELECT UNNEST($1::uuid[]) AS id, UNNEST($2::numeric[]) AS new_price) v
         WHERE properties.id = v.id`,
        [phIds, phPrices]
      );
      const phValues: string[] = [];
      const phParams: unknown[] = [];
      for (let i = 0; i < phIds.length; i++) {
        phValues.push(`($${i * 3 + 1}::uuid, $${i * 3 + 2}::numeric, $${i * 3 + 3}::varchar)`);
        phParams.push(phIds[i], phPrices[i], phCurrencies[i]);
      }
      await pool.query(
        `INSERT INTO price_history (property_id, price, currency) VALUES ${phValues.join(', ')}`,
        phParams
      );
    }
  } catch (e) {
    dbLog.warn({ err: e, metric: 'bulk_ops.price_history_append.failure', operation: 'appendPriceHistoryCommercial' }, 'Failed to record commercial price history');
  }

  dbLog.info({ inserted, updated, count: commercial.length, changes: changes.length }, 'Commercial upsert complete');

  return { inserted, updated, propertyIds, changes };
}

/**
 * Upsert other properties to properties (partitioned table)
 * Handles garages, parking spaces, mobile homes, storage units, etc.
 * @param others - Array of other properties
 * @param country - Country code (e.g., 'czech', 'slovakia')
 */
export async function upsertOther(
  others: OtherPropertyTierI[],
  country: string = 'czech',
  scrapeRunId?: string
): Promise<UpsertResult> {
  if (others.length === 0) {
    return { inserted: 0, updated: 0, propertyIds: [], changes: [] };
  }

  const pool = getCoreDatabase(country);
  const propertyIds: string[] = [];
  let inserted = 0;
  let updated = 0;

  // Pre-SELECT existing rows for insert vs update detection
  const otherPortals = others.map(o => o.source_platform);
  const otherPortalIds = others.map(o => o.portal_id || '');
  const otherOldDataResult = await pool.query(
    `SELECT portal, portal_id FROM properties
     WHERE property_category = 'other'
       AND (portal, portal_id) IN (
         SELECT * FROM UNNEST($1::varchar[], $2::varchar[])
       )`,
    [otherPortals, otherPortalIds]
  );
  const otherExistingKeys = new Set<string>(
    otherOldDataResult.rows.map((r: { portal: string; portal_id: string }) => `${r.portal}:${r.portal_id}`)
  );

  for (const property of others) {
    const query = `
      INSERT INTO properties (
        property_category,
        portal, portal_id, source_url, source_platform,
        title, price, currency, transaction_type,
        location, city, region, country, postal_code, latitude, longitude,
        status,
        other_property_subtype, other_sqm_total,
        other_has_parking, other_parking_spaces,
        other_has_electricity, other_has_water_connection, other_has_heating,
        other_security_type, other_access_type,
        other_year_built, other_construction_type, other_condition,
        other_deposit, other_service_charges, other_available_from,
        media, agent, features, description,
        images, videos, portal_metadata, country_specific,
        raw_data, first_seen_at, last_seen_at,
        condition, heating_type, furnished, construction_type,
        renovation_year, available_from, published_date, deposit, parking_spaces,
        external_source_url,
        czech_disposition, czech_ownership,
        district, neighbourhood, municipality
      )
      VALUES (
        'other',
        $1, $2, $3, $4,
        $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14, $15,
        $16,
        $17, $18,
        $19, $20,
        $21, $22, $23,
        $24, $25,
        $26, $27, $28,
        $29, $30, $31,
        $32, $33, $34, $35,
        $36, $37, $38, $39,
        $40, $41, $42,
        $43, $44, $45, $46,
        $47, $48, $49, $50, $51,
        $52,
        $53, $54,
        $55, $56, $57
      )
      ON CONFLICT (portal, portal_id, property_category)
      DO UPDATE SET
        title = EXCLUDED.title,
        price = EXCLUDED.price,
        currency = EXCLUDED.currency,
        transaction_type = EXCLUDED.transaction_type,
        location = EXCLUDED.location,
        city = EXCLUDED.city,
        region = EXCLUDED.region,
        postal_code = EXCLUDED.postal_code,
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        other_property_subtype = EXCLUDED.other_property_subtype,
        other_sqm_total = EXCLUDED.other_sqm_total,
        other_has_parking = EXCLUDED.other_has_parking,
        other_parking_spaces = EXCLUDED.other_parking_spaces,
        other_has_electricity = EXCLUDED.other_has_electricity,
        other_has_water_connection = EXCLUDED.other_has_water_connection,
        other_has_heating = EXCLUDED.other_has_heating,
        other_security_type = EXCLUDED.other_security_type,
        other_access_type = EXCLUDED.other_access_type,
        other_year_built = EXCLUDED.other_year_built,
        other_construction_type = EXCLUDED.other_construction_type,
        other_condition = EXCLUDED.other_condition,
        other_deposit = EXCLUDED.other_deposit,
        other_service_charges = EXCLUDED.other_service_charges,
        other_available_from = EXCLUDED.other_available_from,
        media = EXCLUDED.media,
        agent = EXCLUDED.agent,
        features = EXCLUDED.features,
        description = EXCLUDED.description,
        images = EXCLUDED.images,
        videos = EXCLUDED.videos,
        portal_metadata = EXCLUDED.portal_metadata,
        country_specific = EXCLUDED.country_specific,
        raw_data = EXCLUDED.raw_data,
        condition = COALESCE(EXCLUDED.condition, properties.condition),
        heating_type = COALESCE(EXCLUDED.heating_type, properties.heating_type),
        furnished = COALESCE(EXCLUDED.furnished, properties.furnished),
        construction_type = COALESCE(EXCLUDED.construction_type, properties.construction_type),
        renovation_year = COALESCE(EXCLUDED.renovation_year, properties.renovation_year),
        available_from = COALESCE(EXCLUDED.available_from, properties.available_from),
        published_date = COALESCE(EXCLUDED.published_date, properties.published_date),
        deposit = COALESCE(EXCLUDED.deposit, properties.deposit),
        parking_spaces = COALESCE(EXCLUDED.parking_spaces, properties.parking_spaces),
        external_source_url = COALESCE(EXCLUDED.external_source_url, properties.external_source_url),
        czech_disposition = COALESCE(EXCLUDED.czech_disposition, properties.czech_disposition),
        czech_ownership = COALESCE(EXCLUDED.czech_ownership, properties.czech_ownership),
        district = COALESCE(EXCLUDED.district, properties.district),
        neighbourhood = COALESCE(EXCLUDED.neighbourhood, properties.neighbourhood),
        municipality = COALESCE(EXCLUDED.municipality, properties.municipality),
        status = CASE
          WHEN properties.status IN ('sold', 'rented') THEN properties.status
          ELSE 'active'
        END,
        last_seen_at = NOW(),
        last_updated_at = NOW(),
        updated_at = NOW()
      RETURNING id, portal, portal_id;
    `;

    const otherGeo = ((property as any).district || (property as any).municipality)
      ? { district: (property as any).district, neighbourhood: (property as any).neighbourhood || null, municipality: (property as any).municipality || null }
      : await (async () => {
          const lat = property.location?.coordinates?.lat;
          const lon = property.location?.coordinates?.lon;
          if (lat && lon) {
            const g = await lookupGeoEnrichment(lat, lon);
            return { district: g.district, neighbourhood: g.neighbourhood, municipality: g.municipality };
          }
          return { district: null, neighbourhood: null, municipality: null };
        })();

    const params = [
      // $1-$4: portal identification
      property.source_platform,
      property.portal_id || `${property.source_platform}-${Date.now()}`,
      property.source_url,
      property.source_platform,

      // $5-$8: core property data
      property.title,
      property.price,
      property.currency,
      property.transaction_type,

      // $9-$15: location data
      JSON.stringify(property.location),
      property.location?.city?.substring(0, 255) || null,
      property.location?.region?.substring(0, 255) || null,
      property.location?.country || null,
      property.location?.postal_code || null,
      property.location?.coordinates?.lat || null,
      property.location?.coordinates?.lon || null,

      // $16: status
      property.status || 'active',

      // $17-$18: other_property_subtype, other_sqm_total
      property.property_subtype || null,
      property.sqm_total,

      // $19-$20: other_has_parking, other_parking_spaces
      property.has_parking,
      property.parking_spaces || null,

      // $21-$23: other_has_electricity, other_has_water_connection, other_has_heating
      property.has_electricity,
      property.has_water_connection || null,
      property.has_heating || null,

      // $24-$25: other_security_type, other_access_type
      property.security_type || null,
      property.access_type || null,

      // $26-$28: other_year_built, other_construction_type, other_condition
      property.year_built || null,
      property.construction_type || null,
      property.condition || null,

      // $29-$31: other_deposit, other_service_charges, other_available_from
      property.deposit || null,
      property.service_charges || null,
      property.available_from || null,

      // $32-$35: media, agent, features, description
      JSON.stringify(property.media || {}),
      JSON.stringify(property.agent || {}),
      property.features || [],
      property.description,

      // $36-$39: images, videos, portal_metadata, country_specific
      JSON.stringify(property.images || []),
      JSON.stringify(property.videos || []),
      JSON.stringify(property.portal_metadata || {}),
      JSON.stringify(property.country_specific || {}),

      // $40-$42: raw_data, first_seen_at, last_seen_at
      JSON.stringify(property),
      property.first_seen_at || new Date(),
      property.last_seen_at || new Date(),

      // $43-$52: Universal Tier 1 fields + external_source_url
      property.condition || null,
      null, // heating_type - not on OtherPropertyTierI
      null, // furnished - not on OtherPropertyTierI
      property.construction_type || null,
      null, // renovation_year - not on OtherPropertyTierI
      convertToPostgresDate(property.available_from),
      null, // published_date - not on OtherPropertyTierI
      property.deposit || null,
      property.parking_spaces || null,
      (property as OtherPropertyTierI & ExternalFields).external_source_url || null,
      (property as any).country_specific?.czech_disposition ?? (property as any).czech_disposition ?? null,
      (property as any).country_specific?.czech_ownership ?? (property as any).czech_ownership ?? null,
      otherGeo.district,       // $55
      otherGeo.neighbourhood,  // $56
      otherGeo.municipality,   // $57
    ];

    const result = await pool.query(query, params);
    const row = result.rows[0];
    propertyIds.push(row.id);

    // Stamp last_scrape_run_id (best-effort)
    if (scrapeRunId) {
      pool.query(`UPDATE properties SET last_scrape_run_id = $1 WHERE id = $2`, [scrapeRunId, row.id]).catch(() => {});
    }

    const otherKey = `${property.source_platform}:${property.portal_id || ''}`;
    if (otherExistingKeys.has(otherKey)) {
      updated++;
    } else {
      inserted++;
    }
  }

  dbLog.info({ inserted, updated, count: others.length }, 'Other upsert complete');

  return { inserted, updated, propertyIds, changes: [] };
}
