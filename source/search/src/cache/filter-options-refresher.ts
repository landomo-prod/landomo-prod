/**
 * Filter Options Refresher
 *
 * Pre-computes filter options (price ranges, city lists, disposition distributions,
 * etc.) and writes them to filter_options_precomputed in the DB.
 *
 * Called:
 *   - Once on server startup (background, non-blocking)
 *   - After each property:updated pub/sub event (debounced 5 min)
 *
 * The API reads from this table first; live CTE query is the fallback.
 */

import { getCountryPool } from '../database/multi-db-manager';
import { getAllCountryCodes } from '../countries';
import { routeLog } from '../logger';

const log = routeLog.child({ module: 'filter-refresher' });

// All (category, txn) combinations to precompute. '' = no filter.
// Must cover all 15 combos used by the filters API (5 categories × 3 txn types).
// Missing entries fall back to a live CTE query which can take 1-2s on cold DB.
const COMBINATIONS: Array<{ category: string; txn: string }> = [
  { category: '',           txn: ''      }, // all
  { category: '',           txn: 'sale'  }, // all-sale (was missing — live query ~1.6s)
  { category: '',           txn: 'rent'  }, // all-rent (was missing — live query ~0.8s)
  { category: 'apartment',  txn: ''      },
  { category: 'apartment',  txn: 'sale'  },
  { category: 'apartment',  txn: 'rent'  },
  { category: 'house',      txn: ''      },
  { category: 'house',      txn: 'sale'  },
  { category: 'house',      txn: 'rent'  },
  { category: 'land',       txn: ''      },
  { category: 'land',       txn: 'sale'  },
  { category: 'land',       txn: 'rent'  }, // was missing
  { category: 'commercial', txn: ''      },
  { category: 'commercial', txn: 'sale'  }, // was missing
  { category: 'commercial', txn: 'rent'  },
];

// Build the heavy CTE SQL for one combination
function buildFilterSQL(category: string, txn: string): { sql: string; params: any[] } {
  const conditions: string[] = ["status = 'active'"];
  const params: any[] = [];
  let idx = 1;

  if (category) { conditions.push(`property_category = $${idx++}`); params.push(category); }
  if (txn)      { conditions.push(`transaction_type = $${idx++}`);  params.push(txn); }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const sqmCol =
    category === 'house'      ? 'house_sqm_living' :
    category === 'land'       ? 'land_area_plot_sqm' :
    category === 'commercial' ? 'comm_floor_area' :
    'apt_sqm';

  const bedroomsCol =
    category === 'house'     ? 'house_bedrooms' :
    category === 'apartment' ? 'apt_bedrooms' :
    'bedrooms';

  const isHouse      = category === 'house';
  const isCommercial = category === 'commercial';
  const parkingCol  = isHouse ? 'house_has_parking'  : 'apt_has_parking';
  const elevatorCol = isCommercial ? 'comm_has_elevator' : 'apt_has_elevator';
  const garageCol   = isHouse ? 'house_has_garage'   : 'apt_has_basement';
  const gardenCol   = isHouse ? 'house_has_garden'   : 'apt_has_balcony';
  const terraceCol  = isHouse ? 'house_has_terrace'  : 'apt_has_terrace';
  const basementCol = isHouse ? 'house_has_basement' : 'apt_has_basement';

  const sql = `
    WITH base AS (
      SELECT
        price,
        ${sqmCol}     AS sqm_val,
        ${bedroomsCol} AS bedrooms_val,
        city, portal, property_category, transaction_type,
        COALESCE(czech_disposition, country_specific->>'czech_disposition') AS czech_disposition,
        COALESCE(czech_ownership,   country_specific->>'czech_ownership')   AS czech_ownership,
        condition, heating_type, construction_type, furnished,
        ${parkingCol}  AS has_parking,
        apt_has_balcony AS has_balcony,
        ${elevatorCol} AS has_elevator,
        ${garageCol}   AS has_garage,
        ${gardenCol}   AS has_garden,
        ${terraceCol}  AS has_terrace,
        ${basementCol} AS has_basement
      FROM properties ${whereClause}
    ),
    price_stats AS (
      SELECT MIN(price) AS price_min, MAX(price) AS price_max,
             PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price) AS price_median
      FROM base WHERE price > 0
    ),
    sqm_stats AS (
      SELECT MIN(sqm_val) AS sqm_min, MAX(sqm_val) AS sqm_max,
             PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sqm_val) AS sqm_median
      FROM base WHERE sqm_val > 0
    ),
    bedrooms_agg AS (
      SELECT jsonb_agg(jsonb_build_object('value', bedrooms_val::text, 'count', cnt) ORDER BY bedrooms_val)
      FROM (SELECT bedrooms_val, COUNT(*) AS cnt FROM base
            WHERE bedrooms_val IS NOT NULL AND bedrooms_val BETWEEN 0 AND 10
            GROUP BY bedrooms_val) t
    ),
    city_agg AS (
      SELECT jsonb_agg(jsonb_build_object('value', city, 'count', cnt) ORDER BY cnt DESC)
      FROM (SELECT city, COUNT(*) AS cnt FROM base WHERE city IS NOT NULL AND city != ''
            GROUP BY city ORDER BY cnt DESC LIMIT 50) t
    ),
    portal_agg AS (
      SELECT jsonb_agg(jsonb_build_object('value', portal, 'count', cnt) ORDER BY cnt DESC)
      FROM (SELECT portal, COUNT(*) AS cnt FROM base GROUP BY portal ORDER BY cnt DESC) t
    ),
    category_agg AS (
      SELECT jsonb_agg(jsonb_build_object('value', property_category, 'count', cnt) ORDER BY cnt DESC)
      FROM (SELECT property_category, COUNT(*) AS cnt FROM base GROUP BY property_category ORDER BY cnt DESC) t
    ),
    txn_agg AS (
      SELECT jsonb_agg(jsonb_build_object('value', transaction_type, 'count', cnt) ORDER BY cnt DESC)
      FROM (SELECT transaction_type, COUNT(*) AS cnt FROM base GROUP BY transaction_type) t
    ),
    disposition_agg AS (
      SELECT jsonb_agg(jsonb_build_object('value', czech_disposition, 'count', cnt) ORDER BY cnt DESC)
      FROM (SELECT czech_disposition, COUNT(*) AS cnt FROM base
            WHERE czech_disposition IS NOT NULL AND czech_disposition != ''
            GROUP BY czech_disposition ORDER BY cnt DESC) t
    ),
    ownership_agg AS (
      SELECT jsonb_agg(jsonb_build_object('value', czech_ownership, 'count', cnt) ORDER BY cnt DESC)
      FROM (SELECT czech_ownership, COUNT(*) AS cnt FROM base
            WHERE czech_ownership IS NOT NULL AND czech_ownership != ''
            GROUP BY czech_ownership ORDER BY cnt DESC) t
    ),
    condition_agg AS (
      SELECT jsonb_agg(jsonb_build_object('value', condition, 'count', cnt) ORDER BY cnt DESC)
      FROM (SELECT condition, COUNT(*) AS cnt FROM base
            WHERE condition IS NOT NULL AND condition != ''
            GROUP BY condition ORDER BY cnt DESC) t
    ),
    heating_agg AS (
      SELECT jsonb_agg(jsonb_build_object('value', heating_type, 'count', cnt) ORDER BY cnt DESC)
      FROM (SELECT heating_type, COUNT(*) AS cnt FROM base
            WHERE heating_type IS NOT NULL AND heating_type != ''
            GROUP BY heating_type ORDER BY cnt DESC) t
    ),
    construction_agg AS (
      SELECT jsonb_agg(jsonb_build_object('value', construction_type, 'count', cnt) ORDER BY cnt DESC)
      FROM (SELECT construction_type, COUNT(*) AS cnt FROM base
            WHERE construction_type IS NOT NULL AND construction_type != ''
            GROUP BY construction_type ORDER BY cnt DESC) t
    ),
    furnished_agg AS (
      SELECT jsonb_agg(jsonb_build_object('value', furnished, 'count', cnt) ORDER BY cnt DESC)
      FROM (SELECT furnished, COUNT(*) AS cnt FROM base
            WHERE furnished IS NOT NULL AND furnished != ''
            GROUP BY furnished ORDER BY cnt DESC) t
    ),
    amenity_agg AS (
      SELECT
        COUNT(*) FILTER (WHERE has_parking  = true) AS parking,
        COUNT(*) FILTER (WHERE has_balcony  = true) AS balcony,
        COUNT(*) FILTER (WHERE has_elevator = true) AS elevator,
        COUNT(*) FILTER (WHERE has_garage   = true) AS garage,
        COUNT(*) FILTER (WHERE has_garden   = true) AS garden,
        COUNT(*) FILTER (WHERE has_terrace  = true) AS terrace,
        COUNT(*) FILTER (WHERE has_basement = true) AS basement
      FROM base
    ),
    total_agg AS (SELECT COUNT(*) AS cnt FROM base)
    SELECT
      (SELECT cnt FROM total_agg) AS total,
      (SELECT row_to_json(p.*) FROM price_stats p) AS price,
      (SELECT row_to_json(s.*) FROM sqm_stats s)   AS sqm,
      (SELECT * FROM bedrooms_agg)    AS bedrooms,
      (SELECT * FROM city_agg)        AS cities,
      (SELECT * FROM portal_agg)      AS portals,
      (SELECT * FROM category_agg)    AS categories,
      (SELECT * FROM txn_agg)         AS transaction_types,
      (SELECT * FROM disposition_agg) AS czech_disposition,
      (SELECT * FROM ownership_agg)   AS czech_ownership,
      (SELECT * FROM condition_agg)   AS condition,
      (SELECT * FROM heating_agg)     AS heating_type,
      (SELECT * FROM construction_agg) AS construction_type,
      (SELECT * FROM furnished_agg)   AS furnished,
      (SELECT row_to_json(a.*) FROM amenity_agg a) AS amenities
  `;

  return { sql, params };
}

async function refreshOneCombination(
  pool: any,
  country: string,
  category: string,
  txn: string
): Promise<void> {
  const { sql, params } = buildFilterSQL(category, txn);

  const result = await pool.query(sql, params);
  const row = result.rows[0];
  if (!row) return;

  // Build the data JSONB — remove empty/null arrays
  const data: Record<string, any> = {
    total:            parseInt(row.total ?? 0, 10),
    price:            row.price    ?? null,
    sqm:              row.sqm      ?? null,
    bedrooms:         row.bedrooms ?? [],
    cities:           row.cities   ?? [],
    portals:          row.portals  ?? [],
    categories:       row.categories ?? [],
    transaction_types: row.transaction_types ?? [],
  };

  // Only include non-empty optional facets
  for (const [key, val] of Object.entries({
    czech_disposition: row.czech_disposition,
    czech_ownership:   row.czech_ownership,
    condition:         row.condition,
    heating_type:      row.heating_type,
    construction_type: row.construction_type,
    furnished:         row.furnished,
  })) {
    if (val && Array.isArray(val) && val.length > 0) data[key] = val;
  }

  if (row.amenities) {
    data.amenities = {
      has_parking:  parseInt(row.amenities.parking  ?? 0, 10),
      has_balcony:  parseInt(row.amenities.balcony  ?? 0, 10),
      has_elevator: parseInt(row.amenities.elevator ?? 0, 10),
      has_garage:   parseInt(row.amenities.garage   ?? 0, 10),
      has_garden:   parseInt(row.amenities.garden   ?? 0, 10),
      has_terrace:  parseInt(row.amenities.terrace  ?? 0, 10),
      has_basement: parseInt(row.amenities.basement ?? 0, 10),
    };
  }

  await pool.query(
    `INSERT INTO filter_options_precomputed (property_category, transaction_type, computed_at, data)
     VALUES ($1, $2, NOW(), $3)
     ON CONFLICT (property_category, transaction_type)
     DO UPDATE SET computed_at = NOW(), data = EXCLUDED.data`,
    [category, txn, JSON.stringify(data)]
  );

  log.debug({ country, category: category || '*', txn: txn || '*' }, 'Filter options refreshed');
}

let refreshDebounceTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Refresh all filter combinations for all countries.
 * Runs sequentially per country to avoid overloading the DB.
 */
export async function refreshFilterOptions(countries?: string[]): Promise<void> {
  const targets = countries ?? getAllCountryCodes();
  const start = Date.now();
  let totalRefreshed = 0;

  for (const country of targets) {
    try {
      const pool = getCountryPool(country);
      for (const { category, txn } of COMBINATIONS) {
        try {
          await refreshOneCombination(pool, country, category, txn);
          totalRefreshed++;
        } catch (err) {
          log.error({ err, country, category, txn }, 'Failed to refresh filter combination');
        }
      }
    } catch (err) {
      log.error({ err, country }, 'Failed to get pool for country during filter refresh');
    }
  }

  log.info({ totalRefreshed, durationMs: Date.now() - start }, 'Filter options refresh complete');
}

/**
 * Debounced refresh — called on pub/sub events.
 * Waits 5 minutes after the last event before refreshing,
 * so a burst of ingest jobs triggers only one refresh.
 */
export function scheduleFilterRefresh(countries?: string[]): void {
  if (refreshDebounceTimer) clearTimeout(refreshDebounceTimer);
  refreshDebounceTimer = setTimeout(() => {
    refreshFilterOptions(countries).catch(err =>
      log.error({ err }, 'Scheduled filter refresh failed')
    );
  }, 5 * 60 * 1000); // 5 minutes
}

/**
 * Read pre-computed filter options from DB.
 * Returns null if not yet computed or older than maxAgeMinutes.
 */
export async function getPrecomputedFilters(
  pool: any,
  category: string,
  txn: string,
  maxAgeMinutes = 120
): Promise<any | null> {
  const result = await pool.query(
    `SELECT data, computed_at FROM filter_options_precomputed
     WHERE property_category = $1 AND transaction_type = $2
       AND computed_at > NOW() - INTERVAL '1 minute' * $3`,
    [category, txn, maxAgeMinutes]
  );
  return result.rows[0]?.data ?? null;
}
