/**
 * Fotocasa API data fetching utilities
 */

import axios from 'axios';
import { FotocasaSearchResponse, FotocasaListing } from '../types/fotocasaTypes';
import { PLAYWRIGHT_USER_AGENT } from './headers';
import { fotocasaRateLimiter } from './rateLimiter';
import { getCFCookies } from './cookieManager';

const API_BASE = 'https://web.gw.fotocasa.es/v2/propertysearch/search';
const PAGE_SIZE = 30; // Fotocasa returns ~30 results per page

interface SearchParams {
  propertyTypeId: number;
  transactionTypeId: number;
  pageNumber: number;
  combinedLocationIds?: string;
}

/**
 * Fetch a single search page from Fotocasa API
 */
export async function fetchSearchPage(params: SearchParams): Promise<FotocasaSearchResponse> {
  await fotocasaRateLimiter.throttle();

  const queryParams: Record<string, string> = {
    combinedLocationIds: params.combinedLocationIds || '0-EU-ES-0-0-0-0-0-0-0', // All Spain
    culture: 'es-ES',
    includePurchaseTypeFacets: 'true',
    isMap: 'false',
    isNewConstructionPromotions: 'false',
    latitude: '40.4168',
    longitude: '-3.7038',
    pageNumber: params.pageNumber.toString(),
    platformId: '1',
    propertyTypeId: params.propertyTypeId.toString(),
    transactionTypeId: params.transactionTypeId.toString(),
    sortOrderDesc: 'true',
    sortType: 'scoring',
  };

  const url = `${API_BASE}?${new URLSearchParams(queryParams).toString()}`;

  const cookieHeader = await getCFCookies();
  const headers = {
    'User-Agent': PLAYWRIGHT_USER_AGENT,
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'es-ES,es;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Origin': 'https://www.fotocasa.es',
    'Referer': 'https://www.fotocasa.es/',
    'Cookie': cookieHeader,
  };

  try {
    const response = await axios.get<FotocasaSearchResponse>(url, { headers, timeout: 30000 });
    fotocasaRateLimiter.onSuccess();
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 403) {
      // CF cookie expired — force refresh and retry once
      const { invalidateCFCookies } = await import('./cookieManager');
      invalidateCFCookies();
      const freshCookies = await getCFCookies();
      const retryResponse = await axios.get<FotocasaSearchResponse>(url, {
        headers: { ...headers, 'Cookie': freshCookies },
        timeout: 30000,
      });
      fotocasaRateLimiter.onSuccess();
      return retryResponse.data;
    }
    if (error.response?.status === 429) {
      fotocasaRateLimiter.onRateLimit();
      await new Promise(resolve => setTimeout(resolve, 5000));
      const retryResponse = await axios.get<FotocasaSearchResponse>(url, { headers, timeout: 30000 });
      fotocasaRateLimiter.onSuccess();
      return retryResponse.data;
    }
    throw error;
  }
}

/**
 * Fetch all listings for a given property type and transaction type
 * Paginates through all results
 */
export async function fetchAllListings(
  propertyTypeId: number,
  transactionTypeId: number,
  maxPages: number = 500,
): Promise<FotocasaListing[]> {
  const allListings: FotocasaListing[] = [];

  // First page to get total count
  const firstPage = await fetchSearchPage({
    propertyTypeId,
    transactionTypeId,
    pageNumber: 1,
  });

  if (!firstPage.realEstates || firstPage.realEstates.length === 0) {
    return [];
  }

  allListings.push(...firstPage.realEstates);
  const totalPages = Math.min(Math.ceil(firstPage.count / PAGE_SIZE), maxPages);

  console.log(JSON.stringify({
    level: 'info',
    service: 'fotocasa-scraper',
    msg: 'Fetching listings',
    propertyTypeId,
    transactionTypeId,
    totalCount: firstPage.count,
    totalPages,
  }));

  for (let page = 2; page <= totalPages; page++) {
    try {
      const response = await fetchSearchPage({
        propertyTypeId,
        transactionTypeId,
        pageNumber: page,
      });

      if (!response.realEstates || response.realEstates.length === 0) {
        break; // No more results
      }

      allListings.push(...response.realEstates);

      if (page % 50 === 0) {
        console.log(JSON.stringify({
          level: 'info',
          service: 'fotocasa-scraper',
          msg: 'Pagination progress',
          page,
          totalPages,
          collected: allListings.length,
        }));
      }
    } catch (error: any) {
      console.error(JSON.stringify({
        level: 'error',
        service: 'fotocasa-scraper',
        msg: 'Failed to fetch page',
        page,
        err: error.message,
      }));
      // Continue to next page on error
    }
  }

  return allListings;
}

/**
 * Fetch detail page for a specific listing
 * Fotocasa search results already contain most data, but detail has extra features
 */
export async function fetchListingDetail(detailPath: string): Promise<any> {
  await fotocasaRateLimiter.throttle();

  const url = `https://www.fotocasa.es${detailPath}`;

  try {
    const cookieHeader = await getCFCookies();
    const response = await axios.get(url, {
      headers: {
        'User-Agent': PLAYWRIGHT_USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9',
        'Referer': 'https://www.fotocasa.es/',
        'Cookie': cookieHeader,
      },
      timeout: 30000,
    });

    fotocasaRateLimiter.onSuccess();
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 429) {
      fotocasaRateLimiter.onRateLimit();
    }
    throw error;
  }
}
