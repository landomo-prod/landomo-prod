/**
 * Filters Route
 *
 * GET /api/v1/filters
 *
 * Returns all available filter options with real counts from the DB,
 * scoped by property_category and transaction_type. Used by frontend
 * to build dynamic filter panels.
 *
 * Query params:
 *   country          - country code (default: all)
 *   property_category - apartment | house | land | commercial
 *   transaction_type  - sale | rent
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { queryCountries, getCountryPool } from '../database/multi-db-manager';
import { getAllCountryCodes } from '../countries';
import { generateCacheKey, cacheGet, cacheSet } from '../cache/redis-manager';
import { getPrecomputedFilters } from '../cache/filter-options-refresher';
import { routeLog } from '../logger';

const CACHE_TTL = 600; // 10 minutes
const PRECOMPUTED_MAX_AGE_MINUTES = 120; // accept precomputed data up to 2h old

// Single-flight: deduplicate concurrent identical filter requests
const inFlightFilters = new Map<string, Promise<any>>();

interface FiltersQuery {
  country?: string;
  property_category?: string;
  transaction_type?: string;
}

export async function filtersRoutes(fastify: FastifyInstance) {
  fastify.get<{ Querystring: FiltersQuery }>(
    '/api/v1/filters',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            country:           { type: 'string' },
            property_category: { type: 'string', enum: ['apartment', 'house', 'land', 'commercial'] },
            transaction_type:  { type: 'string', enum: ['sale', 'rent'] },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Querystring: FiltersQuery }>, reply: FastifyReply) => {
      const { country, property_category, transaction_type } = request.query;

      const countries = country ? [country] : getAllCountryCodes();

      // Cache key includes all params
      const cacheKey = generateCacheKey('filters', { countries, property_category, transaction_type });
      const cached = await cacheGet<any>(cacheKey);
      if (cached) {
        return reply.status(200).send(cached);
      }

      // Single-flight: concurrent identical cache-miss requests share one DB query
      if (inFlightFilters.has(cacheKey)) {
        const result = await inFlightFilters.get(cacheKey)!;
        return reply.status(200).send(result);
      }

      // Register in-flight promise so concurrent identical cache-miss requests share one computation
      const computePromise = _computeFilters(
        countries, property_category, transaction_type, cacheKey
      ).finally(() => inFlightFilters.delete(cacheKey));
      inFlightFilters.set(cacheKey, computePromise);

      try {
        const result = await computePromise;
        return reply.status(200).send(result);
      } catch (error) {
        routeLog.error({ err: error }, 'Error computing filter options');
        return reply.status(500).send({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );
}

async function _computeFilters(
  countries: string[],
  property_category: string | undefined,
  transaction_type: string | undefined,
  cacheKey: string
): Promise<any> {
      // Try pre-computed table first (written by background refresher, <2ms read)
      // Single-country only — precomputed data is per-country
      if (countries.length === 1) {
        try {
          const pool = getCountryPool(countries[0]);
          const precomputed = await getPrecomputedFilters(
            pool,
            property_category ?? '',
            transaction_type  ?? '',
            PRECOMPUTED_MAX_AGE_MINUTES
          );
          if (precomputed) {
            await cacheSet(cacheKey, precomputed, CACHE_TTL);
            return precomputed;
          }
        } catch {
          // fall through to live query
        }
      }

      // Build WHERE conditions
      const conditions: string[] = ["status = 'active'"];
      const params: any[] = [];
      let idx = 1;

      if (property_category) {
        conditions.push(`property_category = $${idx++}`);
        params.push(property_category);
      }
      if (transaction_type) {
        conditions.push(`transaction_type = $${idx++}`);
        params.push(transaction_type);
      }

      const whereClause = `WHERE ${conditions.join(' AND ')}`;

      // Determine which sqm column to use based on category
      const sqmCol =
        property_category === 'house'       ? 'house_sqm_living' :
        property_category === 'land'        ? 'land_area_plot_sqm' :
        property_category === 'commercial'  ? 'comm_floor_area' :
        'apt_sqm'; // apartment + fallback

      const bedroomsCol =
        property_category === 'house'      ? 'house_bedrooms' :
        property_category === 'apartment'  ? 'apt_bedrooms' :
        'bedrooms';

      // Amenity columns are category-prefixed in the schema
      const isHouse       = property_category === 'house';
      const isCommercial  = property_category === 'commercial';
      const parkingCol  = isHouse ? 'house_has_parking'  : 'apt_has_parking';
      const balconyCol  = 'apt_has_balcony';
      const elevatorCol = isCommercial ? 'comm_has_elevator' : 'apt_has_elevator';
      const garageCol   = isHouse ? 'house_has_garage'  : 'apt_has_basement'; // closest proxy for non-house
      const gardenCol   = isHouse ? 'house_has_garden'  : 'apt_has_balcony';
      const terraceCol  = isHouse ? 'house_has_terrace' : 'apt_has_terrace';
      const basementCol = isHouse ? 'house_has_basement': 'apt_has_basement';

      const sql = `
        WITH base AS (
          SELECT
            price,
            ${sqmCol} AS sqm_val,
            ${bedroomsCol} AS bedrooms_val,
            city,
            portal,
            property_category,
            transaction_type,
            COALESCE(czech_disposition, country_specific->>'czech_disposition') AS czech_disposition,
            COALESCE(czech_ownership,   country_specific->>'czech_ownership')   AS czech_ownership,
            condition,
            heating_type,
            construction_type,
            furnished,
            ${parkingCol}  AS has_parking,
            ${balconyCol}  AS has_balcony,
            ${elevatorCol} AS has_elevator,
            ${garageCol}   AS has_garage,
            ${gardenCol}   AS has_garden,
            ${terraceCol}  AS has_terrace,
            ${basementCol} AS has_basement
          FROM properties
          ${whereClause}
        ),

        -- Price stats
        price_stats AS (
          SELECT
            MIN(price)                                        AS price_min,
            MAX(price)                                        AS price_max,
            PERCENTILE_CONT(0.1) WITHIN GROUP (ORDER BY price) AS price_p10,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price) AS price_p50,
            PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY price) AS price_p90
          FROM base WHERE price > 0
        ),

        -- Sqm stats
        sqm_stats AS (
          SELECT
            MIN(sqm_val)                                          AS sqm_min,
            MAX(sqm_val)                                          AS sqm_max,
            PERCENTILE_CONT(0.1) WITHIN GROUP (ORDER BY sqm_val) AS sqm_p10,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sqm_val) AS sqm_p50,
            PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY sqm_val) AS sqm_p90
          FROM base WHERE sqm_val > 0
        ),

        -- Bedrooms distribution
        bedrooms_agg AS (
          SELECT bedrooms_val::text AS val, COUNT(*) AS cnt
          FROM base
          WHERE bedrooms_val IS NOT NULL AND bedrooms_val BETWEEN 0 AND 10
          GROUP BY bedrooms_val
          ORDER BY bedrooms_val
        ),

        -- Top cities (limit 50)
        city_agg AS (
          SELECT city AS val, COUNT(*) AS cnt
          FROM base
          WHERE city IS NOT NULL AND city != ''
          GROUP BY city
          ORDER BY cnt DESC
          LIMIT 50
        ),

        -- Portals
        portal_agg AS (
          SELECT portal AS val, COUNT(*) AS cnt
          FROM base
          GROUP BY portal
          ORDER BY cnt DESC
        ),

        -- Categories (when not filtered)
        category_agg AS (
          SELECT property_category AS val, COUNT(*) AS cnt
          FROM base
          GROUP BY property_category
          ORDER BY cnt DESC
        ),

        -- Transaction types
        txn_agg AS (
          SELECT transaction_type AS val, COUNT(*) AS cnt
          FROM base
          GROUP BY transaction_type
        ),

        -- Czech disposition
        disposition_agg AS (
          SELECT czech_disposition AS val, COUNT(*) AS cnt
          FROM base
          WHERE czech_disposition IS NOT NULL AND czech_disposition != ''
          GROUP BY czech_disposition
          ORDER BY cnt DESC
        ),

        -- Czech ownership
        ownership_agg AS (
          SELECT czech_ownership AS val, COUNT(*) AS cnt
          FROM base
          WHERE czech_ownership IS NOT NULL AND czech_ownership != ''
          GROUP BY czech_ownership
          ORDER BY cnt DESC
        ),

        -- Condition
        condition_agg AS (
          SELECT condition AS val, COUNT(*) AS cnt
          FROM base
          WHERE condition IS NOT NULL AND condition != ''
          GROUP BY condition
          ORDER BY cnt DESC
        ),

        -- Heating type
        heating_agg AS (
          SELECT heating_type AS val, COUNT(*) AS cnt
          FROM base
          WHERE heating_type IS NOT NULL AND heating_type != ''
          GROUP BY heating_type
          ORDER BY cnt DESC
        ),

        -- Construction type
        construction_agg AS (
          SELECT construction_type AS val, COUNT(*) AS cnt
          FROM base
          WHERE construction_type IS NOT NULL AND construction_type != ''
          GROUP BY construction_type
          ORDER BY cnt DESC
        ),

        -- Furnished
        furnished_agg AS (
          SELECT furnished AS val, COUNT(*) AS cnt
          FROM base
          WHERE furnished IS NOT NULL AND furnished != ''
          GROUP BY furnished
          ORDER BY cnt DESC
        ),

        -- Boolean amenities (only count = true)
        amenity_agg AS (
          SELECT 'has_parking'  AS feature, COUNT(*) FILTER (WHERE has_parking  = true) AS cnt FROM base UNION ALL
          SELECT 'has_balcony',              COUNT(*) FILTER (WHERE has_balcony  = true) FROM base UNION ALL
          SELECT 'has_elevator',             COUNT(*) FILTER (WHERE has_elevator = true) FROM base UNION ALL
          SELECT 'has_garage',               COUNT(*) FILTER (WHERE has_garage   = true) FROM base UNION ALL
          SELECT 'has_garden',               COUNT(*) FILTER (WHERE has_garden   = true) FROM base UNION ALL
          SELECT 'has_terrace',              COUNT(*) FILTER (WHERE has_terrace  = true) FROM base UNION ALL
          SELECT 'has_basement',             COUNT(*) FILTER (WHERE has_basement = true) FROM base
        ),

        total_agg AS (SELECT COUNT(*) AS cnt FROM base)

        SELECT 'price'        AS facet, NULL AS val, NULL::bigint AS cnt, row_to_json(p.*) AS meta FROM price_stats p UNION ALL
        SELECT 'sqm',          NULL,     NULL,  row_to_json(s.*) FROM sqm_stats s        UNION ALL
        SELECT 'bedrooms',     val,      cnt,   NULL FROM bedrooms_agg                   UNION ALL
        SELECT 'city',         val,      cnt,   NULL FROM city_agg                       UNION ALL
        SELECT 'portal',       val,      cnt,   NULL FROM portal_agg                     UNION ALL
        SELECT 'category',     val,      cnt,   NULL FROM category_agg                   UNION ALL
        SELECT 'txn_type',     val,      cnt,   NULL FROM txn_agg                        UNION ALL
        SELECT 'disposition',  val,      cnt,   NULL FROM disposition_agg                UNION ALL
        SELECT 'ownership',    val,      cnt,   NULL FROM ownership_agg                  UNION ALL
        SELECT 'condition',    val,      cnt,   NULL FROM condition_agg                  UNION ALL
        SELECT 'heating',      val,      cnt,   NULL FROM heating_agg                    UNION ALL
        SELECT 'construction', val,      cnt,   NULL FROM construction_agg               UNION ALL
        SELECT 'furnished',    val,      cnt,   NULL FROM furnished_agg                  UNION ALL
        SELECT 'amenity',      feature,  cnt,   NULL FROM amenity_agg                    UNION ALL
        SELECT 'total',        'total',  cnt,   NULL FROM total_agg
      `;

      try {
        const results = await queryCountries(countries, sql, params);

        // Merge across countries
        const merged: any = {
          total: 0,
          price: null,
          sqm: null,
          bedrooms: [],
          cities: [],
          portals: [],
          categories: [],
          transaction_types: [],
          czech_disposition: [],
          czech_ownership: [],
          condition: [],
          heating_type: [],
          construction_type: [],
          furnished: [],
          amenities: {} as Record<string, number>,
        };

        // Accumulators
        const bedroomsMap = new Map<string, number>();
        const cityMap     = new Map<string, number>();
        const portalMap   = new Map<string, number>();
        const categoryMap = new Map<string, number>();
        const txnMap      = new Map<string, number>();
        const dispositionMap   = new Map<string, number>();
        const ownershipMap     = new Map<string, number>();
        const conditionMap     = new Map<string, number>();
        const heatingMap       = new Map<string, number>();
        const constructionMap  = new Map<string, number>();
        const furnishedMap     = new Map<string, number>();
        const amenityMap       = new Map<string, number>();

        // Numeric stats accumulators (weighted avg across countries)
        let priceMin = Infinity, priceMax = -Infinity;
        let sqmMin   = Infinity, sqmMax   = -Infinity;
        const priceP50s: number[] = [], sqmP50s: number[] = [];

        for (const [, queryResult] of results) {
          if (!queryResult.result?.rows) continue;

          for (const row of queryResult.result.rows) {
            const cnt = parseInt(row.cnt ?? 0, 10);

            switch (row.facet) {
              case 'price': {
                const m = row.meta as any;
                if (m) {
                  if (m.price_min != null) priceMin = Math.min(priceMin, parseFloat(m.price_min));
                  if (m.price_max != null) priceMax = Math.max(priceMax, parseFloat(m.price_max));
                  if (m.price_p50 != null) priceP50s.push(parseFloat(m.price_p50));
                }
                break;
              }
              case 'sqm': {
                const m = row.meta as any;
                if (m) {
                  if (m.sqm_min != null) sqmMin = Math.min(sqmMin, parseFloat(m.sqm_min));
                  if (m.sqm_max != null) sqmMax = Math.max(sqmMax, parseFloat(m.sqm_max));
                  if (m.sqm_p50 != null) sqmP50s.push(parseFloat(m.sqm_p50));
                }
                break;
              }
              case 'bedrooms':     bedroomsMap.set(row.val,   (bedroomsMap.get(row.val)   || 0) + cnt); break;
              case 'city':         cityMap.set(row.val,        (cityMap.get(row.val)        || 0) + cnt); break;
              case 'portal':       portalMap.set(row.val,      (portalMap.get(row.val)      || 0) + cnt); break;
              case 'category':     categoryMap.set(row.val,    (categoryMap.get(row.val)    || 0) + cnt); break;
              case 'txn_type':     txnMap.set(row.val,         (txnMap.get(row.val)         || 0) + cnt); break;
              case 'disposition':  dispositionMap.set(row.val, (dispositionMap.get(row.val) || 0) + cnt); break;
              case 'ownership':    ownershipMap.set(row.val,   (ownershipMap.get(row.val)   || 0) + cnt); break;
              case 'condition':    conditionMap.set(row.val,   (conditionMap.get(row.val)   || 0) + cnt); break;
              case 'heating':      heatingMap.set(row.val,     (heatingMap.get(row.val)     || 0) + cnt); break;
              case 'construction': constructionMap.set(row.val,(constructionMap.get(row.val)|| 0) + cnt); break;
              case 'furnished':    furnishedMap.set(row.val,   (furnishedMap.get(row.val)   || 0) + cnt); break;
              case 'amenity':      amenityMap.set(row.val,     (amenityMap.get(row.val)     || 0) + cnt); break;
              case 'total':        merged.total += cnt; break;
            }
          }
        }

        // Build output
        const toArray = (m: Map<string, number>) =>
          Array.from(m.entries())
            .map(([value, count]) => ({ value, count }))
            .sort((a, b) => b.count - a.count);

        merged.price = priceMin === Infinity ? null : {
          min:    Math.round(priceMin),
          max:    Math.round(priceMax),
          median: priceP50s.length ? Math.round(priceP50s.reduce((a, b) => a + b, 0) / priceP50s.length) : null,
        };
        merged.sqm = sqmMin === Infinity ? null : {
          min:    Math.round(sqmMin),
          max:    Math.round(sqmMax),
          median: sqmP50s.length ? Math.round(sqmP50s.reduce((a, b) => a + b, 0) / sqmP50s.length) : null,
        };

        merged.bedrooms         = toArray(bedroomsMap).sort((a, b) => parseInt(a.value) - parseInt(b.value));
        merged.cities           = toArray(cityMap).slice(0, 50);
        merged.portals          = toArray(portalMap);
        merged.categories       = toArray(categoryMap);
        merged.transaction_types = toArray(txnMap);
        merged.czech_disposition = toArray(dispositionMap);
        merged.czech_ownership   = toArray(ownershipMap);
        merged.condition         = toArray(conditionMap);
        merged.heating_type      = toArray(heatingMap);
        merged.construction_type = toArray(constructionMap);
        merged.furnished         = toArray(furnishedMap);
        merged.amenities = Object.fromEntries(amenityMap.entries());

        // Remove empty facets
        for (const key of ['czech_disposition','czech_ownership','condition','heating_type','construction_type','furnished'] as const) {
          if ((merged[key] as any[]).length === 0) delete merged[key];
        }

        await cacheSet(cacheKey, merged, CACHE_TTL);
        return merged;

      } catch (error) {
        throw error;
      }
}
