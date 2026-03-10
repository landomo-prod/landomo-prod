/**
 * API Client
 *
 * HTTP client for communicating with the Landomo search-service API.
 */

import {
  SearchRequest,
  SearchResponse,
  GeoSearchRequest,
  GeoSearchResponse,
  PropertyDetailsResponse,
  FilterOptionsResponse,
  MapClusterRequest,
  MapClusterResponse,
  PriceHistoryResponse,
  LocationSuggestion,
} from './types';

// ============================================================================
// Configuration
// ============================================================================

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? '';
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || '';

// ============================================================================
// HTTP Client
// ============================================================================

class APIError extends Error {
  constructor(
    message: string,
    public status: number,
    public errors?: any
  ) {
    super(message);
    this.name = 'APIError';
  }
}

async function fetchAPI<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (API_KEY) {
    headers['X-API-Key'] = API_KEY;
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new APIError(
        error.message || `API request failed: ${response.statusText}`,
        response.status,
        error.errors
      );
    }

    return await response.json();
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }

    // Network error or JSON parse error
    throw new APIError(
      error instanceof Error ? error.message : 'Network request failed',
      0
    );
  }
}

// ============================================================================
// API Methods
// ============================================================================

/**
 * Search for properties
 */
export async function searchProperties(
  request: SearchRequest
): Promise<SearchResponse> {
  return fetchAPI<SearchResponse>('/api/v1/search', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

/**
 * Geographic search (find properties near a location)
 */
export async function geoSearchProperties(
  request: GeoSearchRequest
): Promise<GeoSearchResponse> {
  return fetchAPI<GeoSearchResponse>('/api/v1/search/geo', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

/**
 * Get property details by ID
 */
export async function getPropertyById(id: string, country: string = 'czech'): Promise<PropertyDetailsResponse> {
  return fetchAPI<PropertyDetailsResponse>(`/api/v1/properties/${id}?country=${encodeURIComponent(country)}`, {
    method: 'GET',
  });
}

/**
 * Get available filter options with counts
 */
export async function getFilterOptions(params: {
  country?: string;
  property_category?: string;
  transaction_type?: string;
} = {}): Promise<FilterOptionsResponse> {
  const query = new URLSearchParams();
  if (params.country) query.set('country', params.country);
  if (params.property_category) query.set('property_category', params.property_category);
  if (params.transaction_type) query.set('transaction_type', params.transaction_type);
  return fetchAPI<FilterOptionsResponse>(`/api/v1/filters?${query}`, { method: 'GET' });
}

/**
 * Get map clusters for a viewport
 */
export async function getMapClusters(
  request: MapClusterRequest
): Promise<MapClusterResponse> {
  return fetchAPI<MapClusterResponse>('/api/v1/map/clusters', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

/**
 * Get price history for a property
 */
export async function getPropertyPriceHistory(id: string, country: string = 'czech'): Promise<PriceHistoryResponse> {
  return fetchAPI<PriceHistoryResponse>(`/api/v1/properties/${id}/price-history?country=${encodeURIComponent(country)}`, {
    method: 'GET',
  });
}

/**
 * Get location autocomplete suggestions
 */
export async function getLocationSuggestions(text: string, country: string = 'czech'): Promise<LocationSuggestion[]> {
  const params = new URLSearchParams({ text, country, limit: '8' });
  const response = await fetch(`${API_BASE_URL}/api/v1/locations/autocomplete?${params}`);
  if (!response.ok) return [];
  const data = await response.json();
  // API returns { suggestions: [...] }, extract the array
  return Array.isArray(data) ? data : (data.suggestions || []);
}

/**
 * Health check
 */
export async function healthCheck(): Promise<{ status: string; timestamp: string }> {
  return fetchAPI('/health', {
    method: 'GET',
  });
}

// ============================================================================
// Export
// ============================================================================

export const api = {
  search: searchProperties,
  geoSearch: geoSearchProperties,
  getProperty: getPropertyById,
  getPriceHistory: getPropertyPriceHistory,
  getFilterOptions: getFilterOptions,
  getMapClusters: getMapClusters,
  getLocationSuggestions: getLocationSuggestions,
  health: healthCheck,
};

export default api;
