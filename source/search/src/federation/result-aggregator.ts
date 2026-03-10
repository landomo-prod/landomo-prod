/**
 * Result Aggregator
 *
 * Aggregates and merges search results from multiple countries.
 */

import { PropertyResult, SearchAggregations, SearchResponse, PaginationMetadata } from '../types/search';
import { getCountryModule } from '../countries';
import { CountryQueryResult } from '../database/multi-db-manager';
import { federationLog } from '../logger';

/**
 * Aggregate results from multiple countries
 */
export function aggregateResults(
  resultsByCountry: Map<string, CountryQueryResult>,
  _queriedCountries: string[]
): {
  results: PropertyResult[];
  aggregations: SearchAggregations;
  total: number;
} {
  const allResults: PropertyResult[] = [];
  const byCountry: Record<string, number> = {};
  const byPropertyType: Record<string, number> = {};
  const byTransactionType: Record<string, number> = {};
  let minPrice = Infinity;
  let maxPrice = -Infinity;
  let totalPrice = 0;
  let priceCount = 0;

  // Process results from each country
  resultsByCountry.forEach((queryResult, countryCode) => {
    if (queryResult.error) {
      federationLog.error({ err: queryResult.error, country: countryCode }, 'Error querying country');
      return;
    }

    if (!queryResult.result) {
      return;
    }

    const rows = queryResult.result.rows;
    byCountry[countryCode] = rows.length;

    // Get country module for transformations
    const countryModule = getCountryModule(countryCode);

    // Transform each result
    rows.forEach(row => {
      const transformed = countryModule.transformResult(row);
      allResults.push(transformed);

      // Aggregate by property type
      const propType = row.property_type || 'unknown';
      byPropertyType[propType] = (byPropertyType[propType] || 0) + 1;

      // Aggregate by transaction type
      const transType = row.transaction_type || 'unknown';
      byTransactionType[transType] = (byTransactionType[transType] || 0) + 1;

      // Track price range
      if (row.price) {
        minPrice = Math.min(minPrice, row.price);
        maxPrice = Math.max(maxPrice, row.price);
        totalPrice += row.price;
        priceCount++;
      }
    });
  });

  // Calculate aggregations
  const aggregations: SearchAggregations = {
    by_country: byCountry,
    by_property_type: byPropertyType,
    by_transaction_type: byTransactionType,
    price_range: {
      min: minPrice === Infinity ? 0 : minPrice,
      max: maxPrice === -Infinity ? 0 : maxPrice,
      avg: priceCount > 0 ? totalPrice / priceCount : 0
    },
    total_results: allResults.length
  };

  return {
    results: allResults,
    aggregations,
    total: allResults.length
  };
}

/**
 * Sort results globally (across countries)
 */
export function sortResults(
  results: PropertyResult[],
  sortField: string = 'created_at',
  sortOrder: 'asc' | 'desc' = 'desc'
): PropertyResult[] {
  return results.sort((a, b) => {
    const aVal = (a as any)[sortField];
    const bVal = (b as any)[sortField];

    if (aVal === undefined || aVal === null) return 1;
    if (bVal === undefined || bVal === null) return -1;

    let comparison = 0;
    if (typeof aVal === 'string') {
      comparison = aVal.localeCompare(bVal);
    } else if (typeof aVal === 'number') {
      comparison = aVal - bVal;
    } else if (aVal instanceof Date) {
      comparison = aVal.getTime() - bVal.getTime();
    }

    return sortOrder === 'asc' ? comparison : -comparison;
  });
}

/**
 * Apply pagination to results
 */
export function paginateResults(
  results: PropertyResult[],
  limit: number,
  offset: number
): PropertyResult[] {
  return results.slice(offset, offset + limit);
}

/**
 * Merge and rank results from multiple countries
 */
export function mergeAndRankResults(
  resultsByCountry: Map<string, CountryQueryResult>,
  queriedCountries: string[],
  sortField: string = 'created_at',
  sortOrder: 'asc' | 'desc' = 'desc',
  limit: number = 20,
  offset: number = 0,
  grandTotal?: number,
  page?: number
): SearchResponse {
  const startTime = Date.now();

  // Aggregate results
  const { results, aggregations, total } = aggregateResults(resultsByCountry, queriedCountries);

  // Use DB-counted grand total if available, otherwise fall back to in-memory count
  const actualTotal = grandTotal !== undefined ? grandTotal : total;

  // Sort globally
  const sorted = sortResults(results, sortField, sortOrder);

  // Paginate
  const paginated = paginateResults(sorted, limit, offset);

  const queryTime = Date.now() - startTime;

  const actualPage = page || Math.floor(offset / limit) + 1;
  const totalPages = Math.max(1, Math.ceil(actualTotal / limit));

  const pagination: PaginationMetadata = {
    page: actualPage,
    limit,
    total: actualTotal,
    totalPages,
    hasNext: actualPage < totalPages,
    hasPrev: actualPage > 1,
  };

  return {
    total: actualTotal,
    results: paginated,
    pagination,
    aggregations,
    query_time_ms: queryTime,
    countries_queried: queriedCountries
  };
}

/**
 * Calculate result statistics
 */
export interface ResultStatistics {
  total_properties: number;
  countries_with_results: number;
  avg_price: number;
  price_range: { min: number; max: number };
  most_common_type: string;
  most_common_transaction: string;
}

export function calculateStatistics(aggregations: SearchAggregations): ResultStatistics {
  const countriesWithResults = Object.values(aggregations.by_country)
    .filter(count => count > 0).length;

  // Find most common property type
  let mostCommonType = 'unknown';
  let maxTypeCount = 0;
  Object.entries(aggregations.by_property_type).forEach(([type, count]) => {
    if (count > maxTypeCount) {
      maxTypeCount = count;
      mostCommonType = type;
    }
  });

  // Find most common transaction type
  let mostCommonTransaction = 'unknown';
  let maxTransactionCount = 0;
  Object.entries(aggregations.by_transaction_type).forEach(([type, count]) => {
    if (count > maxTransactionCount) {
      maxTransactionCount = count;
      mostCommonTransaction = type;
    }
  });

  return {
    total_properties: aggregations.total_results,
    countries_with_results: countriesWithResults,
    avg_price: aggregations.price_range.avg,
    price_range: {
      min: aggregations.price_range.min,
      max: aggregations.price_range.max
    },
    most_common_type: mostCommonType,
    most_common_transaction: mostCommonTransaction
  };
}
