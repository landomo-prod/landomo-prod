/**
 * Price Trends Routes
 *
 * GET /api/v1/properties/:id/price-history - Price history for a single property
 * GET /api/v1/market/trends - Aggregate monthly avg price/m2 for a city/property_type
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { queryCountry } from '../database/multi-db-manager';
import { cacheGet, cacheSet } from '../cache/redis-manager';
import { routeLog } from '../logger';

interface PriceHistoryParams {
  id: string;
}

interface PriceHistoryQuery {
  country?: string;
}

interface MarketTrendsQuery {
  country?: string;
  city?: string;
  property_type?: string;
}

export async function priceTrendsRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/v1/properties/:id/price-history
   *
   * Returns the full price history for a property plus a summary with
   * current_price, initial_price, price_change_pct, and trend direction.
   */
  fastify.get<{ Params: PriceHistoryParams; Querystring: PriceHistoryQuery }>(
    '/api/v1/properties/:id/price-history',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' }
          },
          required: ['id']
        },
        querystring: {
          type: 'object',
          properties: {
            country: { type: 'string', description: 'Country code' }
          },
          required: ['country']
        },
        response: {
          200: {
            type: 'object',
            properties: {
              property_id: { type: 'string' },
              history: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    price: { type: 'number' },
                    currency: { type: 'string' },
                    recorded_at: { type: 'string' }
                  }
                }
              },
              summary: {
                type: 'object',
                properties: {
                  current_price: { type: 'number' },
                  initial_price: { type: 'number' },
                  price_change_pct: { type: 'number' },
                  trend: { type: 'string', enum: ['up', 'down', 'stable'] }
                }
              }
            }
          },
          404: {
            type: 'object',
            properties: { error: { type: 'string' } }
          }
        }
      }
    },
    async (
      request: FastifyRequest<{ Params: PriceHistoryParams; Querystring: PriceHistoryQuery }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;
      const { country } = request.query;

      if (!country) {
        return reply.status(400).send({ error: 'Missing required query parameter: country' });
      }

      try {
        // Check cache (10 min TTL)
        const cacheKey = `price-history:${country}:${id}`;
        const cached = await cacheGet<any>(cacheKey);
        if (cached) {
          return reply.status(200).send(cached);
        }

        const sql = `
          SELECT price, currency, recorded_at
          FROM price_history
          WHERE property_id = $1
          ORDER BY recorded_at ASC
        `;

        const result = await queryCountry(country, sql, [id]);

        if (result.rows.length === 0) {
          // Fall back to current property price as a single data point
          const propSql = `
            SELECT price, currency, first_seen_at AS recorded_at
            FROM properties
            WHERE id = $1
          `;
          const propResult = await queryCountry(country, propSql, [id]);
          if (propResult.rows.length === 0) {
            return reply.status(404).send({ error: 'Property not found' });
          }

          const row = propResult.rows[0];
          const response = {
            property_id: id,
            history: [{
              price: parseFloat(row.price),
              currency: row.currency,
              recorded_at: row.recorded_at
            }],
            summary: {
              current_price: parseFloat(row.price),
              initial_price: parseFloat(row.price),
              price_change_pct: 0,
              trend: 'stable' as const
            }
          };

          await cacheSet(cacheKey, response, 600);
          return reply.status(200).send(response);
        }

        const history = result.rows.map(row => ({
          price: parseFloat(row.price),
          currency: row.currency,
          recorded_at: row.recorded_at
        }));

        const initialPrice = history[0].price;
        const currentPrice = history[history.length - 1].price;
        const changePct = initialPrice > 0
          ? ((currentPrice - initialPrice) / initialPrice) * 100
          : 0;

        const trend = changePct > 1 ? 'up' : changePct < -1 ? 'down' : 'stable';

        const response = {
          property_id: id,
          history,
          summary: {
            current_price: currentPrice,
            initial_price: initialPrice,
            price_change_pct: Math.round(changePct * 100) / 100,
            trend
          }
        };

        await cacheSet(cacheKey, response, 600);
        return reply.status(200).send(response);
      } catch (error) {
        routeLog.error({ err: error, country, propertyId: id }, 'Error fetching price history');
        return reply.status(500).send({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );

  /**
   * GET /api/v1/market/trends
   *
   * Returns monthly average price per m2 for the last 12 months,
   * filterable by country, city, and property_type.
   */
  fastify.get<{ Querystring: MarketTrendsQuery }>(
    '/api/v1/market/trends',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            country: { type: 'string', description: 'Country code (required)' },
            city: { type: 'string', description: 'City name filter' },
            property_type: { type: 'string', description: 'Property type filter' }
          },
          required: ['country']
        },
        response: {
          200: {
            type: 'object',
            properties: {
              country: { type: 'string' },
              city: { type: 'string' },
              property_type: { type: 'string' },
              months: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    month: { type: 'string' },
                    avg_price_per_sqm: { type: 'number' },
                    listing_count: { type: 'number' }
                  }
                }
              }
            }
          }
        }
      }
    },
    async (
      request: FastifyRequest<{ Querystring: MarketTrendsQuery }>,
      reply: FastifyReply
    ) => {
      const { country, city, property_type } = request.query;

      if (!country) {
        return reply.status(400).send({ error: 'Missing required query parameter: country' });
      }

      try {
        // Cache key includes all filter params (1h TTL)
        const cacheKey = `market-trends:${country}:${city || '*'}:${property_type || '*'}`;
        const cached = await cacheGet<any>(cacheKey);
        if (cached) {
          return reply.status(200).send(cached);
        }

        // Build dynamic WHERE clause
        const conditions: string[] = [
          "p.status = 'active'",
          'p.price IS NOT NULL',
          'p.price > 0',
          'p.sqm IS NOT NULL',
          'p.sqm > 0'
        ];
        const params: any[] = [];
        let paramIdx = 1;

        if (city) {
          conditions.push(`p.city = $${paramIdx++}`);
          params.push(city);
        }
        if (property_type) {
          conditions.push(`p.property_type = $${paramIdx++}`);
          params.push(property_type);
        }

        const whereClause = conditions.join(' AND ');

        // Query monthly averages from price_history joined with properties
        // for the last 12 months. Falls back to properties table if
        // price_history is sparse.
        const sql = `
          WITH monthly_data AS (
            SELECT
              date_trunc('month', ph.recorded_at) AS month,
              AVG(ph.price / p.sqm) AS avg_price_per_sqm,
              COUNT(*) AS listing_count
            FROM price_history ph
            JOIN properties p ON p.id = ph.property_id
            WHERE ${whereClause}
              AND ph.recorded_at >= NOW() - INTERVAL '12 months'
            GROUP BY date_trunc('month', ph.recorded_at)
            ORDER BY month ASC
          ),
          current_data AS (
            SELECT
              date_trunc('month', p.last_seen_at) AS month,
              AVG(p.price / p.sqm) AS avg_price_per_sqm,
              COUNT(*) AS listing_count
            FROM properties p
            WHERE ${whereClause}
              AND p.last_seen_at >= NOW() - INTERVAL '12 months'
            GROUP BY date_trunc('month', p.last_seen_at)
            ORDER BY month ASC
          )
          SELECT * FROM monthly_data
          UNION ALL
          SELECT * FROM current_data
          WHERE NOT EXISTS (SELECT 1 FROM monthly_data)
        `;

        const result = await queryCountry(country, sql, params);

        const months = result.rows.map(row => ({
          month: row.month,
          avg_price_per_sqm: Math.round(parseFloat(row.avg_price_per_sqm) * 100) / 100,
          listing_count: parseInt(row.listing_count)
        }));

        const response = {
          country,
          city: city || null,
          property_type: property_type || null,
          months
        };

        await cacheSet(cacheKey, response, 3600);
        return reply.status(200).send(response);
      } catch (error) {
        routeLog.error({ err: error, country, city, property_type }, 'Error fetching market trends');
        return reply.status(500).send({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );
}
