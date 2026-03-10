/**
 * Geo Enrichment Service
 *
 * Reverse-geocodes lat/lon via Pelias (primary) or polygon service (fallback).
 * Returns district, region, neighbourhood, and address label.
 * Never throws. Caches results in-process Map (~11m precision).
 */

import axios from 'axios';

export interface GeoEnrichment {
  district: string | null;
  region: string | null;
  neighbourhood: string | null;
  municipality: string | null;
  address: string | null;
}

const EMPTY: GeoEnrichment = { district: null, region: null, neighbourhood: null, municipality: null, address: null };

const enrichmentCache = new Map<string, GeoEnrichment>();

function cacheKey(lat: number, lon: number) {
  return `${lat.toFixed(4)},${lon.toFixed(4)}`;
}

/**
 * Full geo enrichment via Pelias reverse geocode with polygon service fallback.
 */
export async function lookupGeoEnrichment(lat: number | string, lon: number | string): Promise<GeoEnrichment> {
  const numLat = typeof lat === 'string' ? parseFloat(lat) : lat;
  const numLon = typeof lon === 'string' ? parseFloat(lon) : lon;
  if (!numLat || !numLon || isNaN(numLat) || isNaN(numLon)) return EMPTY;

  const key = cacheKey(numLat, numLon);
  const cached = enrichmentCache.get(key);
  if (cached !== undefined) return cached;

  let result: GeoEnrichment = { district: null, region: null, neighbourhood: null, municipality: null, address: null };

  // Try Pelias first — provides neighbourhood, region, address
  const peliasUrl = process.env.PELIAS_URL;
  if (peliasUrl) {
    try {
      const res = await axios.get(`${peliasUrl}/v1/reverse`, {
        params: { 'point.lat': numLat, 'point.lon': numLon, size: 1 },
        timeout: 3000,
      });
      const features: any[] = res.data?.features || [];
      if (features.length > 0) {
        const props = features[0].properties || {};
        result.district = props.county || props.localadmin || null;
        result.region = props.region || null;
        result.neighbourhood = props.neighbourhood || props.borough || null;
        result.address = props.label || null;
      }
    } catch {
      // Pelias failed — continue to polygon service
    }
  }

  // Polygon service PIP — supplements missing district/neighbourhood from boundary polygons
  // Always called when district is still null (Czech Pelias WOF data lacks county/localadmin)
  const polygonUrl = process.env.POLYGON_SERVICE_URL || 'http://cz-polygon-service:3100';
  const polygonKey = process.env.POLYGON_SERVICE_API_KEY || '';
  if (polygonKey && (!result.district || !result.neighbourhood || !result.municipality)) {
    try {
      const res = await axios.post(
        `${polygonUrl}/api/v1/boundaries/point-in-polygon`,
        { lat: numLat, lon: numLon },
        { headers: { 'X-API-Key': polygonKey }, timeout: 3000 }
      );
      const areas: any[] = res.data?.data || [];
      if (!result.district) {
        result.district = areas.find((a: any) => a.adminLevel === 6)?.name || null;
      }
      if (!result.region) {
        result.region = areas.find((a: any) => a.adminLevel === 4)?.name || null;
      }
      if (!result.neighbourhood) {
        result.neighbourhood = areas.find((a: any) => a.adminLevel === 9)?.name
                            || areas.find((a: any) => a.adminLevel === 10)?.name || null;
      }
      if (!result.municipality) {
        result.municipality = areas.find((a: any) => a.adminLevel === 8)?.name || null;
      }
    } catch {
      // Polygon service also failed
    }
  }

  if (result.district || result.region || result.neighbourhood || result.municipality || result.address) {
    enrichmentCache.set(key, result);
    return result;
  }

  enrichmentCache.set(key, EMPTY);
  return EMPTY;
}

/**
 * Backward-compatible: returns just the district name.
 */
export async function lookupDistrict(lat: number, lon: number): Promise<string | null> {
  const result = await lookupGeoEnrichment(lat, lon);
  return result.district;
}
