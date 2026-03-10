/**
 * Geocoding Service
 *
 * Uses self-hosted Pelias (http://localhost:4100) for address geocoding.
 * Falls back to public Nominatim if PELIAS_URL is not set.
 * Includes Redis caching (90-day TTL). No rate limiting needed for self-hosted.
 */

import { createClient, RedisClientType } from 'redis';

export interface GeocodingResult {
  latitude: number;
  longitude: number;
  accuracy: string;
}

interface PeliasFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    layer: string;
    confidence: number;
    match_type?: string;
  };
}

interface PeliasResponse {
  features: PeliasFeature[];
}

interface NominatimResponse {
  lat: string;
  lon: string;
  type: string;
}

const CACHE_TTL_SECONDS = 90 * 24 * 60 * 60; // 90 days
const NEGATIVE_CACHE_TTL = 7 * 24 * 60 * 60;  // 7 days
const REQUEST_TIMEOUT_MS = 5000;

// Public Nominatim fallback rate limit
const RATE_LIMIT_MS = 1100;
let lastRequestTime = 0;

let redisClient: RedisClientType | null = null;

function normalizeAddress(address: string): string {
  return address.toLowerCase().trim().replace(/\s+/g, ' ');
}

function cacheKey(address: string, country: string): string {
  return `geocode:${country.toLowerCase()}:${normalizeAddress(address)}`;
}

async function getRedisClient(redisConfig: { host: string; port: number; password?: string }): Promise<RedisClientType | null> {
  if (redisClient) return redisClient;
  try {
    redisClient = createClient({
      socket: { host: redisConfig.host, port: redisConfig.port },
      password: redisConfig.password,
    });
    redisClient.on('error', (err) => {
      console.warn('[geocoding] Redis error (non-fatal):', err.message);
    });
    await redisClient.connect();
    return redisClient;
  } catch (err) {
    console.warn('[geocoding] Failed to connect to Redis (non-fatal):', (err as Error).message);
    redisClient = null;
    return null;
  }
}

async function queryPelias(address: string, country: string, peliasUrl: string): Promise<GeocodingResult | null> {
  const query = encodeURIComponent(address);
  const countryCode = countryToCode(country).toUpperCase();
  const url = `${peliasUrl}/v1/search?text=${query}&boundary.country=${countryCode}&size=1`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn(`[geocoding] Pelias returned ${response.status} for "${address}"`);
      return null;
    }

    const data = (await response.json()) as PeliasResponse;

    if (!data.features || data.features.length === 0) return null;

    const feature = data.features[0];
    return {
      latitude: feature.geometry.coordinates[1],
      longitude: feature.geometry.coordinates[0],
      accuracy: feature.properties.layer || 'unknown',
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function queryNominatim(address: string, country: string): Promise<GeocodingResult | null> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < RATE_LIMIT_MS) {
    await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_MS - elapsed));
  }
  lastRequestTime = Date.now();

  const query = encodeURIComponent(address);
  const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&countrycodes=${countryToCode(country)}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Landomo/1.0 (contact@landomo.com)',
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    if (!response.ok) return null;

    const data = (await response.json()) as NominatimResponse[];
    if (!data || data.length === 0) return null;

    return {
      latitude: parseFloat(data[0].lat),
      longitude: parseFloat(data[0].lon),
      accuracy: data[0].type || 'unknown',
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Geocode an address using self-hosted Pelias (or Nominatim fallback).
 * Returns null on failure (never throws).
 *
 * @param address   Full address string
 * @param country   Country name (e.g. "czech")
 * @param redisConfig  Redis connection for caching
 * @param peliasUrl Self-hosted Pelias base URL (e.g. "http://localhost:4100")
 */
export async function geocodeAddress(
  address: string,
  country: string,
  redisConfig: { host: string; port: number; password?: string },
  peliasUrl?: string,
): Promise<GeocodingResult | null> {
  try {
    if (!address || address.trim().length < 3) return null;

    // Check cache
    const redis = await getRedisClient(redisConfig);
    if (redis) {
      const key = cacheKey(address, country);
      const cached = await redis.get(key).catch(() => null);
      if (cached) {
        if (cached === 'null') return null;
        try {
          return JSON.parse(cached) as GeocodingResult;
        } catch {
          // corrupted, fall through
        }
      }
    }

    // Query geocoder
    let result: GeocodingResult | null = null;
    if (peliasUrl) {
      result = await queryPelias(address, country, peliasUrl);
    } else {
      result = await queryNominatim(address, country);
    }

    // Cache result (or negative)
    if (redis) {
      const key = cacheKey(address, country);
      if (result) {
        await redis.set(key, JSON.stringify(result), { EX: CACHE_TTL_SECONDS }).catch(() => {});
      } else {
        await redis.set(key, 'null', { EX: NEGATIVE_CACHE_TTL }).catch(() => {});
      }
    }

    return result;
  } catch (err) {
    console.warn('[geocoding] Geocoding failed (non-fatal):', (err as Error).message);
    return null;
  }
}

/**
 * Map country names to ISO 3166-1 alpha-2 codes.
 */
function countryToCode(country: string): string {
  const map: Record<string, string> = {
    czech: 'cz',
    czech_republic: 'cz',
    slovakia: 'sk',
    austria: 'at',
    germany: 'de',
    hungary: 'hu',
    poland: 'pl',
    france: 'fr',
    spain: 'es',
    italy: 'it',
    uk: 'gb',
    australia: 'au',
    usa: 'us',
  };
  return map[country.toLowerCase()] || country.substring(0, 2).toLowerCase();
}

/**
 * Build an address string from property location data.
 */
export function buildAddressString(location: {
  address?: string;
  city?: string;
  region?: string;
  country?: string;
}): string | null {
  if (location.address) {
    return location.address;
  }
  const parts: string[] = [];
  if (location.city) parts.push(location.city);
  if (location.region) parts.push(location.region);
  if (location.country) parts.push(location.country);
  return parts.length > 0 ? parts.join(', ') : null;
}
