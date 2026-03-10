/**
 * API Hooks
 *
 * React hooks for fetching data from the Landomo API.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  SearchRequest,
  SearchResponse,
  GeoSearchRequest,
  GeoSearchResponse,
  PropertyResult,
  PropertyDetailsResponse,
  SearchFilters,
  SortByPreset,
  FilterOptionsResponse,
} from './types';
import { searchProperties, geoSearchProperties, getPropertyById, getFilterOptions } from './client';

// ============================================================================
// Hook Types
// ============================================================================

interface UseSearchOptions {
  filters: SearchFilters;
  page?: number;
  limit?: number;
  sort_by?: SortByPreset;
  countries?: string[];
  enabled?: boolean;
}

interface UseGeoSearchOptions {
  latitude: number;
  longitude: number;
  radius_km: number;
  filters?: SearchFilters;
  page?: number;
  limit?: number;
  sort_by?: SortByPreset;
  countries?: string[];
  enabled?: boolean;
}

interface APIState<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
}

// ============================================================================
// useSearch Hook
// ============================================================================

/**
 * Hook for searching properties
 *
 * @example
 * const { data, isLoading, error, refetch } = useSearch({
 *   filters: { city: 'Prague', price_max: 500000 },
 *   page: 1,
 *   limit: 20,
 *   sort_by: 'price_asc'
 * });
 */
export function useSearch(options: UseSearchOptions) {
  const [state, setState] = useState<APIState<SearchResponse>>({
    data: null,
    isLoading: true,
    error: null,
  });

  const { filters, page = 1, limit = 20, sort_by, countries, enabled = true } = options;

  const fetchData = useCallback(async () => {
    if (!enabled) {
      setState({ data: null, isLoading: false, error: null });
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const request: SearchRequest = {
        filters,
        page,
        limit,
        sort_by,
        countries,
      };

      const response = await searchProperties(request);
      setState({ data: response, isLoading: false, error: null });
    } catch (error) {
      setState({
        data: null,
        isLoading: false,
        error: error instanceof Error ? error : new Error('Search failed'),
      });
    }
  }, [filters, page, limit, sort_by, countries, enabled]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    ...state,
    refetch: fetchData,
  };
}

// ============================================================================
// useGeoSearch Hook
// ============================================================================

/**
 * Hook for geographic property search
 *
 * @example
 * const { data, isLoading, error } = useGeoSearch({
 *   latitude: 50.0755,
 *   longitude: 14.4378,
 *   radius_km: 5,
 *   filters: { property_category: 'apartment' }
 * });
 */
export function useGeoSearch(options: UseGeoSearchOptions) {
  const [state, setState] = useState<APIState<GeoSearchResponse>>({
    data: null,
    isLoading: true,
    error: null,
  });

  const {
    latitude,
    longitude,
    radius_km,
    filters,
    page = 1,
    limit = 20,
    sort_by,
    countries,
    enabled = true,
  } = options;

  const fetchData = useCallback(async () => {
    if (!enabled) {
      setState({ data: null, isLoading: false, error: null });
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const request: GeoSearchRequest = {
        latitude,
        longitude,
        radius_km,
        filters,
        page,
        limit,
        sort_by,
        countries,
      };

      const response = await geoSearchProperties(request);
      setState({ data: response, isLoading: false, error: null });
    } catch (error) {
      setState({
        data: null,
        isLoading: false,
        error: error instanceof Error ? error : new Error('Geo search failed'),
      });
    }
  }, [latitude, longitude, radius_km, filters, page, limit, sort_by, countries, enabled]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    ...state,
    refetch: fetchData,
  };
}

// ============================================================================
// useProperty Hook
// ============================================================================

/**
 * Hook for fetching property details
 *
 * @example
 * const { data, isLoading, error } = useProperty('prop-123');
 */
export function useProperty(id: string | null, country: string = 'czech') {
  const [state, setState] = useState<APIState<PropertyDetailsResponse>>({
    data: null,
    isLoading: !!id,
    error: null,
  });

  const fetchData = useCallback(async () => {
    if (!id) {
      setState({ data: null, isLoading: false, error: null });
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await getPropertyById(id, country);
      setState({ data: response, isLoading: false, error: null });
    } catch (error) {
      setState({
        data: null,
        isLoading: false,
        error: error instanceof Error ? error : new Error('Failed to fetch property'),
      });
    }
  }, [id, country]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // API may return { property: {...} } wrapper or flat PropertyResult
  const rawData = state.data as any;
  const resolvedProperty = rawData?.property ?? (rawData?.id ? rawData : null);

  return {
    ...state,
    property: resolvedProperty as import('../api/types').PropertyResult | null,
    similarProperties: rawData?.similar_properties,
    priceHistory: rawData?.price_history,
    marketData: rawData?.market_data,
    refetch: fetchData,
  };
}

// ============================================================================
// useProperties Hook (Simple)
// ============================================================================

/**
 * Simple hook for getting a list of properties
 *
 * @example
 * const { properties, isLoading } = useProperties({
 *   city: 'Prague',
 *   property_category: 'apartment'
 * });
 */
export function useProperties(filters: SearchFilters, limit = 20) {
  const { data, isLoading, error, refetch } = useSearch({
    filters,
    page: 1,
    limit,
  });

  return {
    properties: data?.results || [],
    total: data?.total || 0,
    isLoading,
    error,
    refetch,
  };
}

// ============================================================================
// useFilterOptions Hook
// ============================================================================

export function useFilterOptions(country: string = 'czech', category?: string, transactionType?: string) {
  const [state, setState] = useState<APIState<FilterOptionsResponse>>({
    data: null,
    isLoading: true,
    error: null,
  });

  const fetchData = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await getFilterOptions({
        country,
        property_category: category,
        transaction_type: transactionType,
      });
      setState({ data: response, isLoading: false, error: null });
    } catch (error) {
      setState({
        data: null,
        isLoading: false,
        error: error instanceof Error ? error : new Error('Failed to fetch filter options'),
      });
    }
  }, [country, category, transactionType]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    ...state,
    refetch: fetchData,
  };
}

// ============================================================================
// Export
// ============================================================================

export type { UseSearchOptions, UseGeoSearchOptions, APIState };
