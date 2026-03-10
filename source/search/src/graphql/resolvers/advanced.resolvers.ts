/**
 * Advanced GraphQL Resolvers
 *
 * Implements: radiusSearch, property, propertyStats, searchProperties
 */

import { getCountryPool } from '../../database/multi-db-manager';
import { getAllCountries } from '../../countries';
import { radiusSearch, getPropertyDetail, getPropertyStats } from '../../database/advanced-queries';
import { getIndividualProperties } from '../../database/cluster-queries';
import type { PropertyFilters } from '../../database/filter-builder';
import type { BoundingBox } from '../../database/cluster-queries';

function validateCountries(countries: string[]): string[] {
  const allCountries = getAllCountries();
  const countryMap = new Map(allCountries.map((c) => [c.code, c]));
  const valid = countries.filter((code) => countryMap.has(code));
  if (valid.length === 0) {
    throw new Error(`No valid countries. Available: ${Array.from(countryMap.keys()).join(', ')}`);
  }
  return valid;
}

/**
 * property(id, country) resolver
 */
export async function propertyResolver(
  _: any,
  args: { id: string; country: string }
) {
  const pool = getCountryPool(args.country);
  const property = await getPropertyDetail(pool, args.id);
  if (!property) return null;
  return property;
}

/**
 * radiusSearch resolver
 */
export async function radiusSearchResolver(
  _: any,
  args: {
    center: { lat: number; lon: number };
    radiusKm: number;
    countries: string[];
    filters?: PropertyFilters;
    sortBy?: string;
    limit?: number;
    offset?: number;
  }
) {
  const startTime = Date.now();
  const validCountries = validateCountries(args.countries);
  const limit = Math.min(args.limit || 100, 500);
  const offset = args.offset || 0;

  if (args.radiusKm <= 0 || args.radiusKm > 200) {
    throw new Error('radiusKm must be between 0 and 200');
  }

  const results = await Promise.allSettled(
    validCountries.map(async (countryCode) => {
      const pool = getCountryPool(countryCode);
      return radiusSearch(
        pool,
        args.center.lat,
        args.center.lon,
        args.radiusKm,
        args.filters,
        args.sortBy,
        limit,
        offset
      );
    })
  );

  const allResults: any[] = [];
  let totalCount = 0;

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      allResults.push(...result.value.results);
      totalCount += result.value.total;
    } else {
      console.error(`Radius search failed for ${validCountries[index]}:`, result.reason);
    }
  });

  // Re-sort merged results
  allResults.sort((a, b) => {
    switch (args.sortBy) {
      case 'PRICE_ASC': return a.price - b.price;
      case 'PRICE_DESC': return b.price - a.price;
      default: return a.distanceKm - b.distanceKm;
    }
  });

  return {
    results: allResults.slice(0, limit),
    total: totalCount,
    queryTimeMs: Date.now() - startTime,
  };
}

/**
 * propertyStats resolver
 */
export async function propertyStatsResolver(
  _: any,
  args: {
    bounds: BoundingBox;
    countries: string[];
    filters?: PropertyFilters;
  }
) {
  const validCountries = validateCountries(args.countries);

  const results = await Promise.allSettled(
    validCountries.map(async (countryCode) => {
      const pool = getCountryPool(countryCode);
      return getPropertyStats(pool, args.bounds, args.filters);
    })
  );

  // Merge stats from all countries
  let totalCount = 0;
  let totalPriceSum = 0;
  let minPrice = Infinity;
  let maxPrice = 0;
  const categoryTotals: Record<string, number> = {};
  const transactionTotals: Record<string, number> = {};
  results.forEach((result) => {
    if (result.status === 'fulfilled') {
      const s = result.value;
      totalCount += s.totalCount;
      totalPriceSum += s.avgPrice * s.totalCount;
      if (s.minPrice < minPrice) minPrice = s.minPrice;
      if (s.maxPrice > maxPrice) maxPrice = s.maxPrice;

      Object.entries(s.categoryDistribution).forEach(([k, v]) => {
        categoryTotals[k] = (categoryTotals[k] || 0) + v;
      });
      Object.entries(s.transactionDistribution).forEach(([k, v]) => {
        transactionTotals[k] = (transactionTotals[k] || 0) + v;
      });
    }
  });

  return {
    totalCount,
    avgPrice: totalCount > 0 ? totalPriceSum / totalCount : 0,
    minPrice: minPrice === Infinity ? 0 : minPrice,
    maxPrice,
    medianPrice: totalPriceSum / Math.max(totalCount, 1), // Approximation across DBs
    categoryDistribution: Object.entries(categoryTotals).map(([category, count]) => ({
      category,
      count,
    })),
    transactionDistribution: Object.entries(transactionTotals).map(([type, count]) => ({
      type,
      count,
    })),
  };
}

/**
 * searchProperties resolver - sorted property search within bounds
 */
export async function searchPropertiesResolver(
  _: any,
  args: {
    bounds: BoundingBox;
    countries: string[];
    filters?: PropertyFilters;
    sortBy?: string;
    limit?: number;
    offset?: number;
  }
) {
  const startTime = Date.now();
  const validCountries = validateCountries(args.countries);
  const limit = Math.min(args.limit || 50, 500);

  const results = await Promise.allSettled(
    validCountries.map(async (countryCode) => {
      const pool = getCountryPool(countryCode);
      return getIndividualProperties(pool, args.bounds, args.filters);
    })
  );

  const allProperties: any[] = [];
  results.forEach((result) => {
    if (result.status === 'fulfilled') {
      allProperties.push(...result.value);
    }
  });

  // Sort
  allProperties.sort((a, b) => {
    switch (args.sortBy) {
      case 'PRICE_ASC': return (a.price || 0) - (b.price || 0);
      case 'PRICE_DESC': return (b.price || 0) - (a.price || 0);
      default: return (b.price || 0) - (a.price || 0);
    }
  });

  const offset = args.offset || 0;
  const paged = allProperties.slice(offset, offset + limit);

  return {
    properties: paged,
    total: allProperties.length,
    queryTimeMs: Date.now() - startTime,
  };
}
