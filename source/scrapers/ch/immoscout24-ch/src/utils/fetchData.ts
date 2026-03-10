import axios, { AxiosError } from 'axios';
import { getImmoScout24ChHeaders } from './userAgents';

/**
 * ImmoScout24.ch REST API base URL
 * Discovered via reverse engineering: rest-api.immoscout24.ch/v4
 */
const BASE_URL = 'https://rest-api.immoscout24.ch/v4';

function getRandomDelay(min: number = 300, max: number = 2000): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function randomDelay(min: number = 300, max: number = 2000): Promise<void> {
  const delay = getRandomDelay(min, max);
  return new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Fetch with retry and exponential backoff
 */
export async function fetchDataWithRetry(
  url: string,
  headers: Record<string, string>,
  params?: Record<string, any>,
  retries: number = 3
): Promise<any> {
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const rotatedHeaders = { ...getImmoScout24ChHeaders(), ...headers };

      if (attempt > 0) {
        await randomDelay(500, 2000);
      }

      const response = await axios.get(url, {
        headers: rotatedHeaders,
        params,
        timeout: 30000,
        validateStatus: (status) => status < 500,
      });

      if (response.status === 200) {
        await randomDelay(300, 800);
        return response.data;
      }

      if (response.status === 404) {
        throw new Error(`Resource not found: ${url}`);
      }

      if (response.status === 429) {
        const baseBackoff = 5000 * Math.pow(2, attempt);
        const jitter = Math.random() * 0.3 * baseBackoff;
        const backoffMs = Math.min(baseBackoff + jitter, 30000);
        console.log(JSON.stringify({ level: 'warn', service: 'immoscout24-ch', msg: 'Rate limited', backoffMs: Math.round(backoffMs) }));
        await delay(backoffMs);
        continue;
      }

      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (error) {
      const axiosError = error as AxiosError;
      if (
        axiosError.response?.status &&
        axiosError.response.status >= 400 &&
        axiosError.response.status < 500 &&
        axiosError.response.status !== 429
      ) {
        throw error;
      }
      if (attempt === retries - 1) throw error;

      const baseDelay = 1000 * Math.pow(2, attempt);
      const jitter = Math.random() * 1000;
      const delayMs = Math.min(baseDelay + jitter, 10000);
      console.log(JSON.stringify({ level: 'info', service: 'immoscout24-ch', msg: 'Retrying', attempt: attempt + 1, retries, delayMs: Math.round(delayMs) }));
      await delay(delayMs);
    }
  }
}

/**
 * Fetch search results from ImmoScout24.ch REST API
 * Endpoint: /v4/en/properties
 *
 * NOTE: The exact query parameters need verification against the live API.
 * Known params from research: s (offerType), t (propertyType), pn (page), inp (?)
 */
export async function fetchSearchResults(params: Record<string, any>): Promise<any> {
  const url = `${BASE_URL}/en/properties`;
  const headers = getImmoScout24ChHeaders();
  // ImmoScout24.ch uses custom pagination headers
  const paginationHeaders: Record<string, string> = {
    ...headers,
    'is24-meta-pagenumber': String(params.page || 1),
    'is24-meta-pagesize': String(params.pageSize || 24),
  };
  return fetchDataWithRetry(url, paginationHeaders, params, 3);
}

/**
 * Fetch property detail from ImmoScout24.ch
 * Endpoint: /v4/en/properties/{id}
 */
export async function fetchPropertyDetail(propertyId: string | number): Promise<any> {
  const url = `${BASE_URL}/en/properties/${propertyId}`;
  const headers = getImmoScout24ChHeaders();
  return fetchDataWithRetry(url, headers, undefined, 3);
}

/**
 * Fetch all properties with pagination
 */
export async function fetchAllProperties(
  searchParams: Record<string, any>,
  maxPages: number = 100
): Promise<{ items: any[]; total: number }> {
  const allItems: any[] = [];
  let page = 1;
  let totalHits = 0;
  const pageSize = searchParams.pageSize || 24;

  while (page <= maxPages) {
    const response = await fetchSearchResults({
      ...searchParams,
      page,
      pageSize,
    });

    const properties = response?.properties || response?.items || [];
    if (properties.length === 0) break;

    allItems.push(...properties);
    totalHits = response?.total || response?.numberOfHits || allItems.length;

    console.log(JSON.stringify({
      level: 'info', service: 'immoscout24-ch',
      msg: 'Page fetched', page, count: properties.length,
      total: `${allItems.length}/${totalHits}`,
    }));

    if (properties.length < pageSize || allItems.length >= totalHits) break;

    page++;

    const pageDelay = getRandomDelay(500, 2500);
    await new Promise(resolve => setTimeout(resolve, pageDelay));

    // Occasional longer pause every 5 pages
    if (page % 5 === 0) {
      const longPause = getRandomDelay(3000, 6000);
      await new Promise(resolve => setTimeout(resolve, longPause));
    }
  }

  return { items: allItems, total: totalHits };
}
