/**
 * Location Autocomplete Routes
 *
 * GET /api/v1/locations/autocomplete - Search for locations by name
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Pool } from 'pg';
import { routeLog } from '../logger';

interface LocationSuggestion {
  id: string;
  label: string;
  type: 'region' | 'district' | 'municipality' | 'neighbourhood' | 'street' | 'address';
  coordinates: { lat: number; lon: number };
  bounds?: { north: number; south: number; east: number; west: number };
  boundary_id?: string;
  admin_level?: number;
}

let geocodingPool: Pool | null = null;

function getGeocodingPool(): Pool {
  if (!geocodingPool) {
    geocodingPool = new Pool({
      host: process.env.GEOCODING_DB_HOST || process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.GEOCODING_DB_PORT || process.env.DB_PORT || '5432', 10),
      user: process.env.GEOCODING_DB_USER || process.env.DB_USER || 'landomo',
      password: process.env.GEOCODING_DB_PASSWORD || process.env.DB_PASSWORD || '',
      database: process.env.GEOCODING_DB_NAME || 'landomo_geocoding',
      max: 5,
    });
  }
  return geocodingPool;
}

function adminLevelToType(level: number): LocationSuggestion['type'] {
  switch (level) {
    case 4: return 'region';
    case 6: return 'district';
    case 8: return 'municipality';
    case 9:
    case 10: return 'neighbourhood';
    default: return 'municipality';
  }
}

interface PelasFeature {
  properties: {
    id?: string;
    label?: string;
    layer?: string;
    name?: string;
  };
  geometry: {
    coordinates: [number, number];
  };
  bbox?: [number, number, number, number];
}

function pelasLayerToType(layer: string): LocationSuggestion['type'] {
  switch (layer) {
    case 'street': return 'street';
    case 'address': return 'address';
    case 'neighbourhood': return 'neighbourhood';
    case 'locality':
    case 'localadmin': return 'municipality';
    case 'county': return 'district';
    case 'region':
    case 'macroregion': return 'region';
    default: return 'address';
  }
}

export async function locationRoutes(fastify: FastifyInstance) {
  fastify.get<{
    Querystring: {
      text: string;
      country?: string;
      limit?: number;
    };
  }>(
    '/api/v1/locations/autocomplete',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            text: { type: 'string', minLength: 1 },
            country: { type: 'string' },
            limit: { type: 'number', minimum: 1, maximum: 20 },
          },
          required: ['text'],
        },
      },
    },
    async (
      request: FastifyRequest<{ Querystring: { text: string; country?: string; limit?: number } }>,
      reply: FastifyReply
    ) => {
      const { text, limit = 8 } = request.query;
      const suggestions: LocationSuggestion[] = [];

      // Query boundaries table in geocoding DB
      // Join parent region (admin_level 4) for disambiguation of same-name places
      try {
        const pool = getGeocodingPool();
        const result = await pool.query(
          `SELECT b.id, b.name, b.admin_level,
                  ST_YMin(Box2D(b.geometry_full)) as south, ST_YMax(Box2D(b.geometry_full)) as north,
                  ST_XMin(Box2D(b.geometry_full)) as west, ST_XMax(Box2D(b.geometry_full)) as east,
                  ST_Y(ST_Centroid(b.geometry_full)) as lat, ST_X(ST_Centroid(b.geometry_full)) as lon,
                  COALESCE(
                    (SELECT r.name FROM boundaries r
                     WHERE r.admin_level = 6 AND r.id != b.id
                       AND ST_Intersects(r.geometry_full, ST_Centroid(b.geometry_full))
                     LIMIT 1),
                    (SELECT r.name FROM boundaries r
                     WHERE r.admin_level = 4 AND r.id != b.id
                       AND ST_Intersects(r.geometry_full, ST_Centroid(b.geometry_full))
                     LIMIT 1)
                  ) AS parent_region
           FROM boundaries b
           WHERE b.name ILIKE '%' || $1 || '%'
           ORDER BY b.admin_level ASC, length(b.name) ASC
           LIMIT $2`,
          [text, limit]
        );

        for (const row of result.rows) {
          // Build label with parent region/district for disambiguation
          let label = row.name;
          if (row.parent_region && row.admin_level > 4 && row.parent_region !== row.name) {
            label = `${row.name}, ${row.parent_region}`;
          }

          suggestions.push({
            id: row.id,
            label,
            type: adminLevelToType(row.admin_level),
            coordinates: { lat: parseFloat(row.lat), lon: parseFloat(row.lon) },
            bounds: {
              north: parseFloat(row.north),
              south: parseFloat(row.south),
              east: parseFloat(row.east),
              west: parseFloat(row.west),
            },
            boundary_id: row.id,
            admin_level: row.admin_level,
          });
        }
      } catch (error) {
        routeLog.error({ err: error, text }, 'Location autocomplete boundary query error');
      }

      // Optionally query Pelias for streets/addresses (fills gaps boundaries don't cover)
      const pelasUrl = process.env.PELIAS_URL;
      if (pelasUrl) {
        try {
          // Request more than needed, then filter — Pelias doesn't rank well for partial matches
          const pelasLimit = Math.max(3, limit - suggestions.length);
          const params = new URLSearchParams({
            text,
            'boundary.country': 'CZ',
            size: String(pelasLimit),
            layers: 'address,street,neighbourhood,locality,localadmin,county,region',
          });
          const response = await fetch(`${pelasUrl}/v1/autocomplete?${params.toString()}`, {
            signal: AbortSignal.timeout(3000),
          });
          if (response.ok) {
            const data = await response.json() as { features?: PelasFeature[] };
            // Build a set of boundary names (normalized) for dedup
            const boundaryNames = new Set(
              suggestions.map(s => s.label.split(',')[0].trim().toLowerCase())
            );

            for (const feature of data.features || []) {
              const layer = feature.properties.layer || 'address';
              const name = feature.properties.name || '';

              // Skip Pelias results that duplicate a boundary result (same base name)
              if (boundaryNames.has(name.toLowerCase())) continue;

              // Skip low-quality results (evidenční číslo entries like "Vinohrady ev.9999")
              if (/\bev\.\d+/.test(name)) continue;

              const suggestion: LocationSuggestion = {
                id: feature.properties.id || `pelias-${suggestions.length}`,
                label: feature.properties.label || name || text,
                type: pelasLayerToType(layer),
                coordinates: {
                  lat: feature.geometry.coordinates[1],
                  lon: feature.geometry.coordinates[0],
                },
              };
              if (feature.bbox) {
                suggestion.bounds = {
                  west: feature.bbox[0],
                  south: feature.bbox[1],
                  east: feature.bbox[2],
                  north: feature.bbox[3],
                };
              }
              suggestions.push(suggestion);
            }
          }
        } catch (error) {
          routeLog.warn({ err: error, text }, 'Pelias autocomplete query failed, skipping');
        }
      }

      return reply.send({ suggestions: suggestions.slice(0, limit) });
    }
  );
}
