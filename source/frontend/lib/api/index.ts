/**
 * API Module
 *
 * Central export point for all API-related functionality.
 */

// Client
export { api, default } from './client';

// Types
export type {
  SearchFilters,
  SearchRequest,
  SearchResponse,
  GeoSearchRequest,
  GeoSearchResponse,
  PropertyResult,
  PropertyDetailsResponse,
  PaginationMetadata,
  SearchAggregations,
  SortByPreset,
  PropertyCoordinates,
  PropertyFeature,
  GeoSearchResult,
} from './types';

// Hooks
export {
  useSearch,
  useGeoSearch,
  useProperty,
  useProperties,
} from './hooks';

export type {
  UseSearchOptions,
  UseGeoSearchOptions,
  APIState,
} from './hooks';

// Helper functions
export {
  getPropertyCoordinates,
  getPropertyFeatures,
  getPropertyAddress,
  getPricePerSqm,
  getDisposition,
  formatPrice,
} from './types';
