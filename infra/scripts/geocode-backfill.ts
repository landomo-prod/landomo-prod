#!/usr/bin/env tsx
/**
 * Geocode Backfill Script
 *
 * Geocodes properties missing GPS coordinates using a two-phase approach:
 *   Phase 1 (--fast): City-level geocoding — geocode unique city+region combos,
 *                     then bulk-update all matching properties. ~500 API calls.
 *   Phase 2 (default): Street-level geocoding — geocode unique full addresses,
 *                       then bulk-update. Deduplicates to minimize API calls.
 *
 * Uses local Pelias for CZ properties (fast, no rate limit),
 * falls back to Nominatim for other countries (1 req/sec).
 *
 * Usage:
 *   npx tsx scripts/geocode-backfill.ts [--country czech_republic] [--batch-size 200] [--dry-run] [--fast]
 */

import pg from 'pg';

const { Pool } = pg;

// ── Config ──────────────────────────────────────────────────────────
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || '5432');
const DB_USER = process.env.DB_USER || 'landomo';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const PELIAS_URL = process.env.PELIAS_URL || 'http://localhost:4100';
const NOMINATIM_RATE_LIMIT_MS = 1100;
const REQUEST_TIMEOUT_MS = 5000;

// ── Args ────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const countryFilter = getArg('--country');
const batchSize = parseInt(getArg('--batch-size') || '200');
const dryRun = args.includes('--dry-run');
const usePelias = !args.includes('--no-pelias');
const fastMode = args.includes('--fast');

function getArg(name: string): string | undefined {
  const idx = args.indexOf(name);
  return idx >= 0 ? args[idx + 1] : undefined;
}

// ── Country DB map ──────────────────────────────────────────────────
const COUNTRY_DBS: Record<string, string> = {
  czech_republic: process.env.DB_NAME || 'landomo_czech_republic',
  slovakia: 'landomo_slovakia',
  austria: 'landomo_austria',
  germany: 'landomo_germany',
  hungary: 'landomo_hungary',
};

const COUNTRY_CODES: Record<string, string> = {
  czech_republic: 'cz',
  slovakia: 'sk',
  austria: 'at',
  germany: 'de',
  hungary: 'hu',
};

// ── Stats ───────────────────────────────────────────────────────────
let totalApiCalls = 0;
let totalPropertiesUpdated = 0;
let totalFailed = 0;
let totalSkipped = 0;

let lastNominatimRequest = 0;

// ── Geocoding functions ─────────────────────────────────────────────

async function geocodeWithPelias(address: string): Promise<{ lat: number; lon: number; accuracy: string } | null> {
  try {
    const url = `${PELIAS_URL}/v1/search?text=${encodeURIComponent(address)}&size=1`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const resp = await fetch(url, { signal: controller.signal });
      if (!resp.ok) return null;
      const data = await resp.json() as any;
      if (!data.features || data.features.length === 0) return null;
      const [lon, lat] = data.features[0].geometry.coordinates;
      const accuracy = data.features[0].properties?.accuracy || 'pelias';
      return { lat, lon, accuracy };
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return null;
  }
}

async function geocodeWithNominatim(address: string, countryCode: string): Promise<{ lat: number; lon: number; accuracy: string } | null> {
  try {
    const now = Date.now();
    const elapsed = now - lastNominatimRequest;
    if (elapsed < NOMINATIM_RATE_LIMIT_MS) {
      await new Promise(r => setTimeout(r, NOMINATIM_RATE_LIMIT_MS - elapsed));
    }
    lastNominatimRequest = Date.now();

    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=${countryCode}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const resp = await fetch(url, {
        headers: {
          'User-Agent': 'Landomo/1.0 (contact@landomo.com)',
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });
      if (!resp.ok) return null;
      const data = await resp.json() as any[];
      if (!data || data.length === 0) return null;
      return {
        lat: parseFloat(data[0].lat),
        lon: parseFloat(data[0].lon),
        accuracy: data[0].type || 'nominatim',
      };
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return null;
  }
}

async function queryWithRetry(pool: pg.Pool, sql: string, params: any[], retries = 3): Promise<pg.QueryResult> {
  for (let i = 0; i < retries; i++) {
    try {
      return await pool.query(sql, params);
    } catch (err: any) {
      if (i < retries - 1 && (err.code === 'ECONNREFUSED' || err.code === '57P01' || err.code === '57P03' || err.message?.includes('terminating'))) {
        console.warn(`    [retry ${i + 1}/${retries}] DB error: ${err.message}, waiting 10s...`);
        await new Promise(r => setTimeout(r, 10000));
        continue;
      }
      throw err;
    }
  }
  throw new Error('unreachable');
}

async function geocodeAddress(address: string, countryCode: string, isPeliasCountry: boolean): Promise<{ lat: number; lon: number; accuracy: string } | null> {
  totalApiCalls++;
  let result: { lat: number; lon: number; accuracy: string } | null = null;
  if (isPeliasCountry) {
    result = await geocodeWithPelias(address);
  }
  if (!result) {
    result = await geocodeWithNominatim(address, countryCode);
  }
  return result;
}

// ── Phase 1: City-level geocoding ───────────────────────────────────

async function processCityLevel(pool: pg.Pool, countryCode: string, isPeliasCountry: boolean, country: string) {
  console.log(`  Phase 1: City-level geocoding...`);

  // Get unique city+region combos for properties missing coords
  const cityResult = await pool.query(`
    SELECT DISTINCT
      COALESCE(NULLIF(TRIM(city), ''), '') AS city_val,
      COALESCE(NULLIF(TRIM(region), ''), '') AS region_val,
      COUNT(*) as cnt
    FROM properties_new
    WHERE status = 'active'
      AND (latitude IS NULL OR longitude IS NULL)
      AND city IS NOT NULL AND TRIM(city) != ''
    GROUP BY city_val, region_val
    ORDER BY cnt DESC
  `);

  console.log(`  Found ${cityResult.rows.length} unique city+region combos`);

  let geocoded = 0;
  let failed = 0;
  for (const row of cityResult.rows) {
    const address = [row.city_val, row.region_val, country === 'czech_republic' ? 'Czech Republic' : country].filter(Boolean).join(', ');
    const result = await geocodeAddress(address, countryCode, isPeliasCountry);

    if (result) {
      const accuracy = 'city_' + result.accuracy;
      if (!dryRun) {
        const updateResult = await queryWithRetry(pool, `
          UPDATE properties_new
          SET latitude = $1, longitude = $2,
              portal_metadata = COALESCE(portal_metadata, '{}'::jsonb) || jsonb_build_object('geocoded', true, 'geocode_accuracy', $3::text)
          WHERE status = 'active'
            AND (latitude IS NULL OR longitude IS NULL)
            AND COALESCE(NULLIF(TRIM(city), ''), '') = $4
            AND COALESCE(NULLIF(TRIM(region), ''), '') = $5
        `, [result.lat, result.lon, accuracy, row.city_val, row.region_val]);
        totalPropertiesUpdated += updateResult.rowCount || 0;
        console.log(`    "${address}" -> (${result.lat.toFixed(4)}, ${result.lon.toFixed(4)}) — ${updateResult.rowCount} properties`);
      } else {
        console.log(`    [dry-run] "${address}" -> (${result.lat.toFixed(4)}, ${result.lon.toFixed(4)}) — ~${row.cnt} properties`);
        totalPropertiesUpdated += parseInt(row.cnt);
      }
      geocoded++;
    } else {
      failed++;
      if (parseInt(row.cnt) > 10) {
        console.log(`    FAILED: "${address}" (${row.cnt} properties)`);
      }
    }

    if ((geocoded + failed) % 50 === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      console.log(`    [${elapsed}s] Progress: ${geocoded + failed}/${cityResult.rows.length} cities, ${totalPropertiesUpdated} properties updated`);
    }
  }

  totalFailed += failed;
  console.log(`  Phase 1 done: ${geocoded} cities geocoded, ${failed} failed, ${totalPropertiesUpdated} properties updated`);
}

// ── Phase 2: Street-level geocoding (per-property) ──────────────────

function buildAddress(row: any): string | null {
  // Try address field first
  if (row.address && row.address.trim().length > 3) return row.address.trim();
  // Try location JSONB
  if (row.location) {
    try {
      const loc = typeof row.location === 'string' ? JSON.parse(row.location) : row.location;
      if (loc.address && loc.address.trim().length > 3) return loc.address.trim();
      const parts: string[] = [];
      if (loc.street) parts.push(loc.street);
      if (loc.city) parts.push(loc.city);
      if (loc.region) parts.push(loc.region);
      if (parts.length > 0) return parts.join(', ');
    } catch { /* ignore */ }
  }
  // Fall back to city + region
  const parts: string[] = [];
  if (row.city && row.city.trim()) parts.push(row.city.trim());
  if (row.region && row.region.trim()) parts.push(row.region.trim());
  return parts.length > 0 ? parts.join(', ') : null;
}

async function processStreetLevel(pool: pg.Pool, countryCode: string, isPeliasCountry: boolean) {
  console.log(`  Phase 2: Street-level geocoding (remaining properties)...`);

  // Get unique addresses for remaining un-geocoded properties
  const addrResult = await pool.query(`
    SELECT
      COALESCE(NULLIF(TRIM(address), ''), location->>'address', '') AS addr_val,
      city, region, location,
      array_agg(ARRAY[id::text, property_category]) AS prop_ids,
      COUNT(*) as cnt
    FROM properties_new
    WHERE status = 'active'
      AND (latitude IS NULL OR longitude IS NULL)
    GROUP BY addr_val, city, region, location
    ORDER BY cnt DESC
    LIMIT 50000
  `);

  console.log(`  Found ${addrResult.rows.length} unique address patterns (still missing coords)`);

  // In-memory cache for address -> result (avoids re-geocoding same string)
  const cache = new Map<string, { lat: number; lon: number; accuracy: string } | null>();

  let geocoded = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of addrResult.rows) {
    const address = buildAddress(row);
    if (!address) {
      skipped += parseInt(row.cnt);
      totalSkipped += parseInt(row.cnt);
      continue;
    }

    const normalizedAddr = address.toLowerCase().trim();
    let result: { lat: number; lon: number; accuracy: string } | null;

    if (cache.has(normalizedAddr)) {
      result = cache.get(normalizedAddr)!;
    } else {
      result = await geocodeAddress(address, countryCode, isPeliasCountry);
      cache.set(normalizedAddr, result);
    }

    if (result) {
      if (!dryRun) {
        // Bulk update all properties with this address pattern
        const ids = row.prop_ids as string[][];
        for (const [id, category] of ids) {
          await queryWithRetry(pool, `
            UPDATE properties_new
            SET latitude = $1, longitude = $2,
                portal_metadata = COALESCE(portal_metadata, '{}'::jsonb) || jsonb_build_object('geocoded', true, 'geocode_accuracy', $3::text)
            WHERE id = $4 AND property_category = $5
          `, [result.lat, result.lon, result.accuracy, id, category]);
        }
        totalPropertiesUpdated += ids.length;
      } else {
        totalPropertiesUpdated += parseInt(row.cnt);
      }
      geocoded++;
    } else {
      failed++;
      totalFailed += parseInt(row.cnt);
    }

    if ((geocoded + failed + skipped) % 100 === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      console.log(`    [${elapsed}s] Addresses: ${geocoded + failed}/${addrResult.rows.length}, Updated: ${totalPropertiesUpdated}, API calls: ${totalApiCalls}, Cache hits: ${cache.size}`);
    }
  }

  console.log(`  Phase 2 done: ${geocoded} addresses geocoded, ${failed} failed, ${skipped} skipped`);
}

// ── Main ────────────────────────────────────────────────────────────

async function processCountry(country: string) {
  const dbName = COUNTRY_DBS[country];
  if (!dbName) {
    console.error(`Unknown country: ${country}`);
    return;
  }

  const pool = new Pool({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: dbName,
    max: 3,
  });

  pool.on('error', (err) => {
    console.warn(`[pool] Idle client error (non-fatal): ${err.message}`);
  });

  const countryCode = COUNTRY_CODES[country] || country.substring(0, 2);
  const isPeliasCountry = country === 'czech_republic' && usePelias;

  try {
    const countResult = await pool.query(`
      SELECT COUNT(*) as total,
             COUNT(*) FILTER (WHERE latitude IS NULL OR longitude IS NULL) as missing
      FROM properties_new
      WHERE status = 'active'
    `);
    const { total, missing } = countResult.rows[0];
    console.log(`\n=== ${country} ===`);
    console.log(`  Total active: ${total}, Missing GPS: ${missing}`);

    if (parseInt(missing) === 0) {
      console.log(`  All properties geocoded, skipping.`);
      return;
    }

    // Phase 1: City-level (always run first - fast bulk update)
    await processCityLevel(pool, countryCode, isPeliasCountry, country);

    // Phase 2: Street-level for remaining (skip in --fast mode)
    if (!fastMode) {
      await processStreetLevel(pool, countryCode, isPeliasCountry);
    } else {
      // Report remaining
      const remaining = await pool.query(`
        SELECT COUNT(*) as cnt FROM properties_new
        WHERE status = 'active' AND (latitude IS NULL OR longitude IS NULL)
      `);
      console.log(`  [fast mode] Skipping Phase 2. ${remaining.rows[0].cnt} properties still missing coords.`);
    }
  } finally {
    await pool.end();
  }
}

const startTime = Date.now();

async function main() {
  console.log('Geocode Backfill Script');
  console.log(`  Mode: ${fastMode ? 'FAST (city-level only)' : 'FULL (city + street-level)'}`);
  console.log(`  Pelias: ${usePelias ? PELIAS_URL : 'disabled'}`);
  console.log(`  Batch size: ${batchSize}`);
  console.log(`  Dry run: ${dryRun}`);

  const countries = countryFilter ? [countryFilter] : Object.keys(COUNTRY_DBS);

  for (const country of countries) {
    await processCountry(country);
  }

  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log(`\n=== DONE (${elapsed} min) ===`);
  console.log(`  API calls:         ${totalApiCalls}`);
  console.log(`  Properties updated: ${totalPropertiesUpdated}`);
  console.log(`  Failed:            ${totalFailed}`);
  console.log(`  Skipped (no addr): ${totalSkipped}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
