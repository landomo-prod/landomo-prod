/**
 * Aggregations Routes
 *
 * GET /api/v1/aggregations - Get aggregate statistics with filter support.
 *
 * Returns property type distribution, price histogram, bedroom distribution,
 * top cities, and source portal distribution. Accepts the same filter params
 * as the search endpoint so facets reflect the current query context.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { queryCountries } from '../database/multi-db-manager';
import { getAllCountryCodes } from '../countries';
import { SearchFilters } from '../types/search';
import { generateCacheKey, cacheGet, cacheSet } from '../cache/redis-manager';
import { cacheHitsTotal, cacheMissesTotal } from '../metrics';
import { routeLog } from '../logger';

/** 5-minute TTL for facet aggregations */
const FACETS_CACHE_TTL = 300;

// ─── Query-string schema ────────────────────────────────────────────

interface AggregationQuery {
  countries?: string;
  // Same filter params as search
  property_type?: string;
  transaction_type?: string;
  city?: string;
  region?: string;
  price_min?: number;
  price_max?: number;
  bedrooms?: number;
  bedrooms_min?: number;
  bedrooms_max?: number;
  bathrooms_min?: number;
  sqm_min?: number;
  sqm_max?: number;
  has_parking?: boolean;
  has_garden?: boolean;
  has_pool?: boolean;
  has_balcony?: boolean;
  has_terrace?: boolean;
  has_elevator?: boolean;
  has_garage?: boolean;
  portal?: string;
  search_query?: string;
}

// ─── Response types ─────────────────────────────────────────────────

interface PriceHistogramBucket {
  label: string;
  min: number;
  max: number | null;
  count: number;
}

interface FacetAggregations {
  property_types: Record<string, number>;
  price_histogram: PriceHistogramBucket[];
  bedrooms: Record<string, number>;
  top_cities: Array<{ city: string; count: number }>;
  portals: Record<string, number>;
  total: number;
  by_country: Record<string, {
    property_types: Record<string, number>;
    price_histogram: PriceHistogramBucket[];
    bedrooms: Record<string, number>;
    top_cities: Array<{ city: string; count: number }>;
    portals: Record<string, number>;
    total: number;
  }>;
}

// ─── WHERE-clause builder (mirrors query-builder.ts logic) ──────────

function buildWhereClause(filters: Partial<SearchFilters>): { clause: string; params: any[] } {
  const conditions: string[] = ["status = 'active'", "(canonical_property_id IS NULL OR id = canonical_property_id)"];
  const params: any[] = [];
  let idx = 1;

  if (filters.property_type) {
    conditions.push(`property_type = $${idx++}`);
    params.push(filters.property_type);
  }
  if (filters.transaction_type) {
    conditions.push(`transaction_type = $${idx++}`);
    params.push(filters.transaction_type);
  }
  if (filters.city) {
    conditions.push(`city = $${idx++}`);
    params.push(filters.city);
  }
  if (filters.region) {
    conditions.push(`region = $${idx++}`);
    params.push(filters.region);
  }
  if (filters.price_min !== undefined) {
    conditions.push(`price >= $${idx++}`);
    params.push(filters.price_min);
  }
  if (filters.price_max !== undefined) {
    conditions.push(`price <= $${idx++}`);
    params.push(filters.price_max);
  }
  if (filters.bedrooms !== undefined) {
    conditions.push(`bedrooms = $${idx++}`);
    params.push(filters.bedrooms);
  }
  if (filters.bedrooms_min !== undefined) {
    conditions.push(`bedrooms >= $${idx++}`);
    params.push(filters.bedrooms_min);
  }
  if (filters.bedrooms_max !== undefined) {
    conditions.push(`bedrooms <= $${idx++}`);
    params.push(filters.bedrooms_max);
  }
  if (filters.bathrooms_min !== undefined) {
    conditions.push(`bathrooms >= $${idx++}`);
    params.push(filters.bathrooms_min);
  }
  if (filters.sqm_min !== undefined) {
    conditions.push(`sqm >= $${idx++}`);
    params.push(filters.sqm_min);
  }
  if (filters.sqm_max !== undefined) {
    conditions.push(`sqm <= $${idx++}`);
    params.push(filters.sqm_max);
  }
  if (filters.has_parking !== undefined) {
    conditions.push(`has_parking = $${idx++}`);
    params.push(filters.has_parking);
  }
  if (filters.has_garden !== undefined) {
    conditions.push(`has_garden = $${idx++}`);
    params.push(filters.has_garden);
  }
  if (filters.has_pool !== undefined) {
    conditions.push(`has_pool = $${idx++}`);
    params.push(filters.has_pool);
  }
  if (filters.has_balcony !== undefined) {
    conditions.push(`has_balcony = $${idx++}`);
    params.push(filters.has_balcony);
  }
  if (filters.has_terrace !== undefined) {
    conditions.push(`has_terrace = $${idx++}`);
    params.push(filters.has_terrace);
  }
  if (filters.has_elevator !== undefined) {
    conditions.push(`has_elevator = $${idx++}`);
    params.push(filters.has_elevator);
  }
  if (filters.has_garage !== undefined) {
    conditions.push(`has_garage = $${idx++}`);
    params.push(filters.has_garage);
  }
  if (filters.portal) {
    conditions.push(`portal = $${idx++}`);
    params.push(filters.portal);
  }
  if (filters.search_query) {
    conditions.push(`(title ILIKE $${idx} OR description ILIKE $${idx})`);
    params.push(`%${filters.search_query}%`);
    idx++;
  }

  return {
    clause: `WHERE ${conditions.join(' AND ')}`,
    params,
  };
}

// ─── Single-pass aggregation SQL ────────────────────────────────────

function buildAggregationSQL(whereClause: string): string {
  // Five CTEs compute all facets in one round-trip per country database.
  // The base WHERE is shared so facets always reflect the active filters.
  return `
    WITH base AS (
      SELECT property_type, price, bedrooms, city, portal
      FROM properties
      ${whereClause}
    ),
    type_agg AS (
      SELECT COALESCE(property_type, 'unknown') AS val, COUNT(*) AS cnt
      FROM base GROUP BY property_type
    ),
    price_agg AS (
      SELECT
        CASE
          WHEN price < 100000 THEN '0-100k'
          WHEN price < 200000 THEN '100k-200k'
          WHEN price < 500000 THEN '200k-500k'
          WHEN price < 1000000 THEN '500k-1M'
          ELSE '1M+'
        END AS bucket,
        CASE
          WHEN price < 100000 THEN 0
          WHEN price < 200000 THEN 100000
          WHEN price < 500000 THEN 200000
          WHEN price < 1000000 THEN 500000
          ELSE 1000000
        END AS bucket_min,
        CASE
          WHEN price < 100000 THEN 100000
          WHEN price < 200000 THEN 200000
          WHEN price < 500000 THEN 500000
          WHEN price < 1000000 THEN 1000000
          ELSE NULL
        END AS bucket_max,
        COUNT(*) AS cnt
      FROM base
      WHERE price IS NOT NULL
      GROUP BY bucket, bucket_min, bucket_max
    ),
    bed_agg AS (
      SELECT COALESCE(bedrooms::text, 'unknown') AS val, COUNT(*) AS cnt
      FROM base GROUP BY bedrooms
    ),
    city_agg AS (
      SELECT COALESCE(city, 'unknown') AS val, COUNT(*) AS cnt
      FROM base GROUP BY city ORDER BY cnt DESC LIMIT 20
    ),
    portal_agg AS (
      SELECT COALESCE(portal, 'unknown') AS val, COUNT(*) AS cnt
      FROM base GROUP BY portal
    ),
    total_agg AS (
      SELECT COUNT(*) AS cnt FROM base
    )
    SELECT
      'type' AS facet, val, cnt::int, NULL::int AS bucket_min, NULL::int AS bucket_max FROM type_agg
    UNION ALL
    SELECT
      'price' AS facet, bucket AS val, cnt::int, bucket_min::int, bucket_max::int FROM price_agg
    UNION ALL
    SELECT
      'bedrooms' AS facet, val, cnt::int, NULL, NULL FROM bed_agg
    UNION ALL
    SELECT
      'city' AS facet, val, cnt::int, NULL, NULL FROM city_agg
    UNION ALL
    SELECT
      'portal' AS facet, val, cnt::int, NULL, NULL FROM portal_agg
    UNION ALL
    SELECT
      'total' AS facet, 'total' AS val, cnt::int, NULL, NULL FROM total_agg
  `;
}

// ─── Row parsing ────────────────────────────────────────────────────

const PRICE_BUCKET_ORDER: Record<string, number> = {
  '0-100k': 0,
  '100k-200k': 1,
  '200k-500k': 2,
  '500k-1M': 3,
  '1M+': 4,
};

interface CountryFacets {
  property_types: Record<string, number>;
  price_histogram: PriceHistogramBucket[];
  bedrooms: Record<string, number>;
  top_cities: Array<{ city: string; count: number }>;
  portals: Record<string, number>;
  total: number;
}

function emptyFacets(): CountryFacets {
  return {
    property_types: {},
    price_histogram: [],
    bedrooms: {},
    top_cities: [],
    portals: {},
    total: 0,
  };
}

function parseRows(rows: any[]): CountryFacets {
  const facets = emptyFacets();

  for (const row of rows) {
    const count = parseInt(row.cnt, 10);
    switch (row.facet) {
      case 'type':
        facets.property_types[row.val] = count;
        break;
      case 'price':
        facets.price_histogram.push({
          label: row.val,
          min: row.bucket_min != null ? parseInt(row.bucket_min, 10) : 0,
          max: row.bucket_max != null ? parseInt(row.bucket_max, 10) : null,
          count,
        });
        break;
      case 'bedrooms':
        facets.bedrooms[row.val] = count;
        break;
      case 'city':
        facets.top_cities.push({ city: row.val, count });
        break;
      case 'portal':
        facets.portals[row.val] = count;
        break;
      case 'total':
        facets.total = count;
        break;
    }
  }

  // Sort price histogram by bucket order
  facets.price_histogram.sort(
    (a, b) => (PRICE_BUCKET_ORDER[a.label] ?? 99) - (PRICE_BUCKET_ORDER[b.label] ?? 99)
  );

  return facets;
}

// ─── Merge per-country facets into global rollup ────────────────────

function mergeFacets(countryFacetsMap: Map<string, CountryFacets>): FacetAggregations {
  const merged: FacetAggregations = {
    property_types: {},
    price_histogram: [],
    bedrooms: {},
    top_cities: [],
    portals: {},
    total: 0,
    by_country: {},
  };

  // Accumulators for merging
  const priceMap = new Map<string, PriceHistogramBucket>();
  const cityMap = new Map<string, number>();

  for (const [country, facets] of countryFacetsMap) {
    merged.by_country[country] = {
      property_types: facets.property_types,
      price_histogram: facets.price_histogram,
      bedrooms: facets.bedrooms,
      top_cities: facets.top_cities,
      portals: facets.portals,
      total: facets.total,
    };

    merged.total += facets.total;

    // Merge property types
    for (const [type, count] of Object.entries(facets.property_types)) {
      merged.property_types[type] = (merged.property_types[type] || 0) + count;
    }

    // Merge price histogram
    for (const bucket of facets.price_histogram) {
      const existing = priceMap.get(bucket.label);
      if (existing) {
        existing.count += bucket.count;
      } else {
        priceMap.set(bucket.label, { ...bucket });
      }
    }

    // Merge bedrooms
    for (const [beds, count] of Object.entries(facets.bedrooms)) {
      merged.bedrooms[beds] = (merged.bedrooms[beds] || 0) + count;
    }

    // Merge cities
    for (const { city, count } of facets.top_cities) {
      cityMap.set(city, (cityMap.get(city) || 0) + count);
    }

    // Merge portals
    for (const [portal, count] of Object.entries(facets.portals)) {
      merged.portals[portal] = (merged.portals[portal] || 0) + count;
    }
  }

  // Finalize price histogram (sorted)
  merged.price_histogram = Array.from(priceMap.values()).sort(
    (a, b) => (PRICE_BUCKET_ORDER[a.label] ?? 99) - (PRICE_BUCKET_ORDER[b.label] ?? 99)
  );

  // Top 20 cities globally
  merged.top_cities = Array.from(cityMap.entries())
    .map(([city, count]) => ({ city, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  return merged;
}

// ─── Route registration ─────────────────────────────────────────────

export async function aggregationRoutes(fastify: FastifyInstance) {
  fastify.get<{ Querystring: AggregationQuery }>(
    '/api/v1/aggregations',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            countries: { type: 'string', description: 'Comma-separated country codes or "*" for all' },
            property_type: { type: 'string' },
            transaction_type: { type: 'string' },
            city: { type: 'string' },
            region: { type: 'string' },
            price_min: { type: 'number' },
            price_max: { type: 'number' },
            bedrooms: { type: 'number' },
            bedrooms_min: { type: 'number' },
            bedrooms_max: { type: 'number' },
            bathrooms_min: { type: 'number' },
            sqm_min: { type: 'number' },
            sqm_max: { type: 'number' },
            has_parking: { type: 'boolean' },
            has_garden: { type: 'boolean' },
            has_pool: { type: 'boolean' },
            has_balcony: { type: 'boolean' },
            has_terrace: { type: 'boolean' },
            has_elevator: { type: 'boolean' },
            has_garage: { type: 'boolean' },
            portal: { type: 'string' },
            search_query: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            description: 'Faceted aggregation results',
          },
        },
      },
    },
    async (request: FastifyRequest<{ Querystring: AggregationQuery }>, reply: FastifyReply) => {
      const { countries: countriesParam, ...filterParams } = request.query;

      const countries =
        countriesParam === '*' || !countriesParam
          ? getAllCountryCodes()
          : countriesParam.split(',');

      // Build filters object (strip undefined values from query parsing)
      const filters: Partial<SearchFilters> = {};
      for (const [key, value] of Object.entries(filterParams)) {
        if (value !== undefined) {
          (filters as any)[key] = value;
        }
      }

      try {
        // ── Cache check ──────────────────────────────────────
        const cachePayload = { countries, filters };
        const cacheKey = generateCacheKey('facets', cachePayload);
        const cached = await cacheGet<FacetAggregations>(cacheKey);
        if (cached) {
          routeLog.debug('Cache hit for faceted aggregations');
          cacheHitsTotal.inc();
          return reply.status(200).send(cached);
        }
        cacheMissesTotal.inc();

        // ── Build SQL ────────────────────────────────────────
        const { clause: whereClause, params } = buildWhereClause(filters);
        const sql = buildAggregationSQL(whereClause);

        // ── Query all requested countries in parallel ────────
        const results = await queryCountries(countries, sql, params);

        const countryFacetsMap = new Map<string, CountryFacets>();
        results.forEach((queryResult, country) => {
          if (queryResult.result && queryResult.result.rows.length > 0) {
            countryFacetsMap.set(country, parseRows(queryResult.result.rows));
          } else {
            countryFacetsMap.set(country, emptyFacets());
          }
        });

        // ── Merge across countries ───────────────────────────
        const aggregations = mergeFacets(countryFacetsMap);

        // ── Cache result (5 min TTL) ─────────────────────────
        await cacheSet(cacheKey, aggregations, FACETS_CACHE_TTL);

        return reply.status(200).send(aggregations);
      } catch (error) {
        routeLog.error({ err: error }, 'Error computing faceted aggregations');
        return reply.status(500).send({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  );
}
