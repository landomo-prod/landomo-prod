import axios, { AxiosError } from 'axios';
import { getRandomUserAgent } from './userAgents';
import { FlatfoxApiResponse, FlatfoxListing } from '../types/flatfoxTypes';

function getHeaders(): Record<string, string> {
  return {
    'User-Agent': getRandomUserAgent(),
    'Accept': 'application/json',
    'Accept-Language': 'de-CH,de;q=0.9,en;q=0.8,fr;q=0.7',
  };
}

export async function fetchWithRetry(
  url: string,
  retries: number = 3
): Promise<any> {
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await axios.get(url, {
        headers: getHeaders(),
        timeout: 30000,
      });
      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;

      if (axiosError.response?.status && axiosError.response.status >= 400 && axiosError.response.status < 500) {
        throw error;
      }

      if (attempt === retries - 1) throw error;

      const delayMs = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 1000, 10000);
      console.log(JSON.stringify({ level: 'info', service: 'flatfox-ch', msg: 'Retrying request', attempt: attempt + 1, retries, delayMs }));
      await delay(delayMs);
    }
  }
}

/**
 * Fetch a page of listings from Flatfox public API
 * Endpoint: GET https://flatfox.ch/api/v1/flat/?limit=100&offset=0
 *
 * Query params:
 *   - limit: page size (max 100)
 *   - offset: pagination offset
 *   - ordering: sort field
 *   - object_category: APARTMENT, HOUSE, COMMERCIAL, PARKING
 *   - offer_type: RENT, SALE
 */
export async function fetchListingPage(
  offset: number = 0,
  limit: number = 100,
  objectCategory?: string,
  offerType?: string
): Promise<FlatfoxApiResponse> {
  let url = `https://flatfox.ch/api/v1/flat/?limit=${limit}&offset=${offset}&ordering=-created`;

  if (objectCategory) url += `&object_category=${objectCategory}`;
  if (offerType) url += `&offer_type=${offerType}`;

  return fetchWithRetry(url);
}

/**
 * Fetch listing detail
 * Flatfox API returns full data in list results, so detail fetch is optional.
 */
export async function fetchListingDetail(pk: number): Promise<FlatfoxListing> {
  const url = `https://flatfox.ch/api/v1/flat/${pk}/`;
  return fetchWithRetry(url);
}

/**
 * Fetch all listings for a given category and offer type using pagination
 */
export async function fetchAllListingPages(
  objectCategory?: string,
  offerType?: string,
  maxPages?: number
): Promise<FlatfoxListing[]> {
  const allListings: FlatfoxListing[] = [];
  const LIMIT = 100;
  let offset = 0;
  let page = 0;
  let hasMore = true;

  while (hasMore && (!maxPages || page < maxPages)) {
    console.log(JSON.stringify({ level: 'info', service: 'flatfox-ch', msg: 'Fetching page', offset, objectCategory, offerType }));

    try {
      const response = await fetchListingPage(offset, LIMIT, objectCategory, offerType);

      if (response.results.length > 0) {
        allListings.push(...response.results);
      }

      hasMore = response.next !== null && response.results.length === LIMIT;
      offset += LIMIT;
      page++;

      // Respect rate limits
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 200));
      }
    } catch (error: any) {
      console.error(JSON.stringify({ level: 'error', service: 'flatfox-ch', msg: 'Failed to fetch page', offset, err: error.message }));
      hasMore = false;
    }
  }

  console.log(JSON.stringify({ level: 'info', service: 'flatfox-ch', msg: 'Fetched total listings', totalListings: allListings.length, objectCategory, offerType }));
  return allListings;
}
