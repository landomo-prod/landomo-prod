'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { searchProperties } from '@/lib/api/client';
import { type SearchFilters, type SearchResponse, type SortByPreset, type PropertyResult } from '@/lib/api/types';
import { adaptProperties, type Property } from '@/types/property';
import { type FilterState } from '@/components/desktop/DesktopFilterSheet';

// ============================================================================
// Types
// ============================================================================

type SortOption = 'newest' | 'price-low' | 'price-high' | 'area-large' | 'area-small';

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

interface SearchContextValue {
  // Results
  results: Property[];
  rawResults: PropertyResult[];
  total: number;
  isLoading: boolean;
  error: Error | null;

  // Filters
  filterState: FilterState;
  setFilterState: (filters: FilterState | ((prev: FilterState) => FilterState)) => void;

  // Pagination
  page: number;
  setPage: (page: number) => void;
  hasNextPage: boolean;
  allResults: Property[]; // accumulated across pages for infinite scroll

  // Sort
  sortBy: SortOption;
  setSortBy: (sort: SortOption) => void;

  // Search query
  searchQuery: string;
  setSearchQuery: (query: string) => void;

  // Map bounds (viewport sync)
  mapBounds: MapBounds | null;
  setMapBounds: (bounds: MapBounds | null) => void;

  // Selected property for detail view
  selectedPropertyId: string | null;
  setSelectedPropertyId: (id: string | null) => void;

  // Actions
  refetch: () => void;
}

// ============================================================================
// Defaults
// ============================================================================

export const defaultFilterState: FilterState = {
  minPrice: 0,
  maxPrice: 200000,
  selectedDispositions: [],
  selectedType: 'rent',
  selectedCategory: 'flat',
  selectedSubCategory: '',
  selectedEnergyRatings: [],
  minArea: 0,
  maxArea: 500,
  selectedFloors: [],
  selectedConditions: [],
  selectedFeatures: [],
  selectedFurnished: 'any',
  selectedOwnership: '',
  selectedConstructionTypes: [],
  selectedYearBuiltMin: 0,
  selectedYearBuiltMax: 0,
  selectedPlotAreaMin: 0,
  selectedPlotAreaMax: 0,
};

// ============================================================================
// URL Param Serialization
// ============================================================================

export function filterStateToParams(state: FilterState, sortBy: SortOption, propertyId?: string | null): Record<string, string> {
  const params: Record<string, string> = {};
  const d = defaultFilterState;

  if (state.selectedCategory && state.selectedCategory !== d.selectedCategory) params.cat = state.selectedCategory;
  if (state.selectedType) params.type = state.selectedType;
  if (state.minPrice > d.minPrice) params.pmin = String(state.minPrice);
  if (state.maxPrice < d.maxPrice) params.pmax = String(state.maxPrice);
  if (state.selectedDispositions.length > 0) params.disp = state.selectedDispositions.join(',');
  if (state.minArea > d.minArea) params.amin = String(state.minArea);
  if (state.maxArea < d.maxArea) params.amax = String(state.maxArea);
  if (state.selectedSubCategory) params.subcat = state.selectedSubCategory;
  if (state.selectedEnergyRatings.length > 0) params.energy = state.selectedEnergyRatings.join(',');
  if (state.selectedFloors.length > 0) params.floors = state.selectedFloors.join(',');
  if (state.selectedConditions.length > 0) params.cond = state.selectedConditions.join(',');
  if (state.selectedFeatures.length > 0) params.feat = state.selectedFeatures.join(',');
  if (state.selectedFurnished && state.selectedFurnished !== 'any') params.furn = state.selectedFurnished;
  if (state.selectedOwnership) params.own = state.selectedOwnership;
  if (state.selectedConstructionTypes.length > 0) params.constr = state.selectedConstructionTypes.join(',');
  if (state.selectedYearBuiltMin > 0) params.ybmin = String(state.selectedYearBuiltMin);
  if (state.selectedYearBuiltMax > 0) params.ybmax = String(state.selectedYearBuiltMax);
  if (state.selectedPlotAreaMin > 0) params.pamin = String(state.selectedPlotAreaMin);
  if (state.selectedPlotAreaMax > 0) params.pamax = String(state.selectedPlotAreaMax);
  if (sortBy !== 'newest') params.sort = sortBy;
  if (propertyId) params.property = propertyId;

  return params;
}

export function paramsToFilterState(params: URLSearchParams): { filterState: FilterState; sortBy: SortOption; propertyId: string | null } {
  const state: FilterState = { ...defaultFilterState };

  if (params.get('cat')) state.selectedCategory = params.get('cat')!;
  if (params.get('type')) state.selectedType = params.get('type')!;
  if (params.get('pmin')) state.minPrice = Number(params.get('pmin'));
  if (params.get('pmax')) state.maxPrice = Number(params.get('pmax'));
  if (params.get('disp')) state.selectedDispositions = params.get('disp')!.split(',');
  if (params.get('amin')) state.minArea = Number(params.get('amin'));
  if (params.get('amax')) state.maxArea = Number(params.get('amax'));
  if (params.get('subcat')) state.selectedSubCategory = params.get('subcat')!;
  if (params.get('energy')) state.selectedEnergyRatings = params.get('energy')!.split(',');
  if (params.get('floors')) state.selectedFloors = params.get('floors')!.split(',');
  if (params.get('cond')) state.selectedConditions = params.get('cond')!.split(',');
  if (params.get('feat')) state.selectedFeatures = params.get('feat')!.split(',');
  if (params.get('furn')) state.selectedFurnished = params.get('furn')!;
  if (params.get('own')) state.selectedOwnership = params.get('own')!;
  if (params.get('constr')) state.selectedConstructionTypes = params.get('constr')!.split(',');
  if (params.get('ybmin')) state.selectedYearBuiltMin = Number(params.get('ybmin'));
  if (params.get('ybmax')) state.selectedYearBuiltMax = Number(params.get('ybmax'));
  if (params.get('pamin')) state.selectedPlotAreaMin = Number(params.get('pamin'));
  if (params.get('pamax')) state.selectedPlotAreaMax = Number(params.get('pamax'));

  const sortBy = (params.get('sort') as SortOption) || 'newest';
  const propertyId = params.get('property');

  return { filterState: state, sortBy, propertyId };
}

// ============================================================================
// Filter Mapping
// ============================================================================

const categoryMap: Record<string, string> = {
  flat: 'apartment',
  house: 'house',
  land: 'land',
  commercial: 'commercial',
};

const featureMap: Record<string, keyof SearchFilters> = {
  Parking: 'has_parking',
  Balcony: 'has_balcony',
  Terrace: 'has_terrace',
  Garden: 'has_garden',
  Elevator: 'has_elevator',
  Cellar: 'has_basement',
  Garage: 'has_garage',
};

function mapSortToAPI(sort: SortOption): { sort_by?: SortByPreset; sort?: { field: string; order: 'asc' | 'desc' } } {
  switch (sort) {
    case 'newest':     return { sort_by: 'date_newest' };
    case 'price-low':  return { sort_by: 'price_asc' };
    case 'price-high': return { sort_by: 'price_desc' };
    case 'area-large': return { sort: { field: 'sqm', order: 'desc' } };
    case 'area-small': return { sort: { field: 'sqm', order: 'asc' } };
    default:           return { sort_by: 'date_newest' };
  }
}

export function mapFiltersToAPI(filterState: FilterState, searchQuery?: string, bounds?: MapBounds | null): SearchFilters {
  const filters: SearchFilters = {};

  // Price
  if (filterState.minPrice > 0) filters.price_min = filterState.minPrice;
  if (filterState.maxPrice < 50000000) filters.price_max = filterState.maxPrice;

  // Category (single select)
  if (filterState.selectedCategory) {
    const mapped = categoryMap[filterState.selectedCategory.toLowerCase()];
    if (mapped) {
      filters.property_category = mapped as SearchFilters['property_category'];
    }
  }

  // Sub-category (property_type)
  if (filterState.selectedSubCategory) {
    filters.property_type = filterState.selectedSubCategory;
  }

  // Transaction type
  if (filterState.selectedType) {
    filters.transaction_type = filterState.selectedType.toLowerCase() as SearchFilters['transaction_type'];
  }

  // Disposition (comma-separated for multi-select)
  if (filterState.selectedDispositions.length > 0) {
    filters.disposition = filterState.selectedDispositions.join(',');
  }

  // Area
  if (filterState.minArea > 0) filters.sqm_min = filterState.minArea;
  if (filterState.maxArea < 500) filters.sqm_max = filterState.maxArea;

  // Features (map to boolean flags)
  for (const feature of filterState.selectedFeatures) {
    const apiField = featureMap[feature];
    if (apiField) {
      (filters as any)[apiField] = true;
    }
  }

  // Conditions (comma-separated for multi-select)
  if (filterState.selectedConditions.length > 0) {
    filters.condition = filterState.selectedConditions.join(',');
  }

  // Energy rating → energy_class
  if (filterState.selectedEnergyRatings.length > 0) {
    filters.energy_class = filterState.selectedEnergyRatings.join(',');
  }

  // Floor level → floor_min / floor_max
  if (filterState.selectedFloors.length > 0) {
    const floorRanges: { min: number; max?: number }[] = [];
    for (const floor of filterState.selectedFloors) {
      switch (floor) {
        case 'Ground':   floorRanges.push({ min: 0, max: 0 }); break;
        case '1-3':      floorRanges.push({ min: 1, max: 3 }); break;
        case '4-7':      floorRanges.push({ min: 4, max: 7 }); break;
        case '8+':       floorRanges.push({ min: 8 }); break;
        case 'Top floor': floorRanges.push({ min: 8 }); break;
      }
    }
    if (floorRanges.length > 0) {
      filters.floor_min = Math.min(...floorRanges.map(r => r.min));
      const maxValues = floorRanges.filter(r => r.max !== undefined).map(r => r.max!);
      if (maxValues.length > 0 && !floorRanges.some(r => r.max === undefined)) {
        filters.floor_max = Math.max(...maxValues);
      }
    }
  }

  // Furnished
  if (filterState.selectedFurnished && filterState.selectedFurnished !== 'any') {
    const furnishedMap: Record<string, string> = {
      furnished: 'furnished',
      unfurnished: 'not_furnished',
      partially: 'partially_furnished',
    };
    const mapped = furnishedMap[filterState.selectedFurnished];
    if (mapped) filters.furnished = mapped;
  }

  // Ownership
  if (filterState.selectedOwnership) {
    filters.ownership = filterState.selectedOwnership;
  }

  // Construction type
  if (filterState.selectedConstructionTypes.length > 0) {
    filters.construction_type = filterState.selectedConstructionTypes[0];
  }

  // Year built
  if (filterState.selectedYearBuiltMin > 0) filters.year_built_min = filterState.selectedYearBuiltMin;
  if (filterState.selectedYearBuiltMax > 0) filters.year_built_max = filterState.selectedYearBuiltMax;

  // Plot area
  if (filterState.selectedPlotAreaMin > 0) filters.sqm_plot_min = filterState.selectedPlotAreaMin;
  if (filterState.selectedPlotAreaMax > 0) filters.sqm_plot_max = filterState.selectedPlotAreaMax;

  // Search query
  if (searchQuery) {
    filters.search_query = searchQuery;
  }

  // Bounding box (map viewport sync)
  if (bounds) {
    filters.bounds_north = bounds.north;
    filters.bounds_south = bounds.south;
    filters.bounds_east = bounds.east;
    filters.bounds_west = bounds.west;
  }

  return filters;
}

// ============================================================================
// Context
// ============================================================================

const SearchContext = createContext<SearchContextValue | null>(null);

export function useSearchContext() {
  const ctx = useContext(SearchContext);
  if (!ctx) throw new Error('useSearchContext must be used within SearchProvider');
  return ctx;
}

// ============================================================================
// Provider
// ============================================================================

interface SearchProviderProps {
  children: ReactNode;
  initialFilterState?: FilterState;
  initialSortBy?: SortOption;
  onParamsChange?: (params: Record<string, string>) => void;
}

export function SearchProvider({ children, initialFilterState, initialSortBy, onParamsChange }: SearchProviderProps) {
  const [filterState, setFilterState] = useState<FilterState>(initialFilterState ?? defaultFilterState);
  const [sortBy, setSortBy] = useState<SortOption>(initialSortBy ?? 'newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [mapBounds, setMapBoundsRaw] = useState<MapBounds | null>(null);

  // Stable bounds setter: snap to 3 decimal places (~111m) to avoid refetching on sub-pixel pans
  const setMapBounds = useCallback((bounds: MapBounds | null) => {
    if (!bounds) { setMapBoundsRaw(null); return; }
    const snap = (v: number) => Math.round(v * 1000) / 1000;
    const snapped: MapBounds = {
      north: snap(bounds.north),
      south: snap(bounds.south),
      east: snap(bounds.east),
      west: snap(bounds.west),
    };
    setMapBoundsRaw(prev => {
      if (prev &&
        prev.north === snapped.north &&
        prev.south === snapped.south &&
        prev.east === snapped.east &&
        prev.west === snapped.west
      ) return prev;
      return snapped;
    });
  }, []);

  const [results, setResults] = useState<Property[]>([]);
  const [rawResults, setRawResults] = useState<PropertyResult[]>([]);
  const [allResults, setAllResults] = useState<Property[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [hasNextPage, setHasNextPage] = useState(false);

  // Track whether this is a page append or a fresh search
  const prevFiltersRef = useRef<string>('');

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const apiFilters = mapFiltersToAPI(filterState, searchQuery, mapBounds);
      const sortConfig = mapSortToAPI(sortBy);

      const response = await searchProperties({
        countries: ['czech'],
        filters: apiFilters,
        page,
        limit: 40,
        ...sortConfig,
      });

      const adapted = adaptProperties(response.results);

      setResults(adapted);
      setRawResults(response.results);
      setTotal(response.total);
      setHasNextPage(response.pagination.hasNext);

      // Determine if this is a new search or page append
      const filterKey = JSON.stringify({ apiFilters, sortBy, searchQuery, mapBounds });
      if (page === 1 || filterKey !== prevFiltersRef.current) {
        setAllResults(adapted);
        prevFiltersRef.current = filterKey;
      } else {
        setAllResults(prev => [...prev, ...adapted]);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Search failed'));
    } finally {
      setIsLoading(false);
    }
  }, [filterState, sortBy, searchQuery, page, mapBounds]);

  // Reset to page 1 when filters, sort, or bounds change
  useEffect(() => {
    setPage(1);
  }, [filterState, sortBy, searchQuery, mapBounds]);

  // Fetch when any search param changes
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Sync filter state to URL params
  useEffect(() => {
    onParamsChange?.(filterStateToParams(filterState, sortBy));
  }, [filterState, sortBy, onParamsChange]);

  const value: SearchContextValue = {
    results,
    rawResults,
    total,
    isLoading,
    error,
    filterState,
    setFilterState,
    page,
    setPage,
    hasNextPage,
    allResults,
    sortBy,
    setSortBy,
    searchQuery,
    setSearchQuery,
    mapBounds,
    setMapBounds,
    selectedPropertyId,
    setSelectedPropertyId,
    refetch: fetchData,
  };

  return (
    <SearchContext.Provider value={value}>
      {children}
    </SearchContext.Provider>
  );
}
