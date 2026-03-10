import axios, { AxiosError } from 'axios';
import { getHomegateHeaders } from './userAgents';

/**
 * Homegate.ch does not expose a REST API. Data is embedded in HTML as
 * window.__INITIAL_STATE__ JSON. We fetch the HTML and extract the JSON.
 *
 * Search URL pattern: https://www.homegate.ch/{lang}/{rent|buy}/real-estate/{location}/matching-list?ep={page}
 * Detail URL pattern: https://www.homegate.ch/{lang}/{rent|buy}/{id}
 */

const BASE_URL = 'https://www.homegate.ch';

function getRandomDelay(min: number = 300, max: number = 2000): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Extract __INITIAL_STATE__ JSON from HTML response
 */
function extractInitialState(html: string): any {
  // Look for window.__INITIAL_STATE__= pattern
  const match = html.match(/window\.__INITIAL_STATE__\s*=\s*({.+?})\s*;?\s*<\/script>/s);
  if (!match) {
    // Try alternative pattern
    const altMatch = html.match(/<script[^>]*>window\.__INITIAL_STATE__\s*=\s*(.+?)<\/script>/s);
    if (!altMatch) {
      throw new Error('Could not find __INITIAL_STATE__ in page HTML');
    }
    return JSON.parse(altMatch[1].trim().replace(/;$/, ''));
  }
  return JSON.parse(match[1]);
}

/**
 * Fetch with retry and backoff
 */
async function fetchWithRetry(url: string, retries: number = 3): Promise<string> {
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      if (attempt > 0) {
        await delay(getRandomDelay(500, 2000));
      }

      const response = await axios.get(url, {
        headers: getHomegateHeaders(),
        timeout: 30000,
        validateStatus: (status) => status < 500,
      });

      if (response.status === 200) {
        await delay(getRandomDelay(300, 800));
        return response.data;
      }

      if (response.status === 404) {
        throw new Error(`Resource not found: ${url}`);
      }

      if (response.status === 429) {
        const backoffMs = Math.min(5000 * Math.pow(2, attempt) + Math.random() * 2000, 30000);
        console.log(JSON.stringify({ level: 'warn', service: 'homegate-ch', msg: 'Rate limited', backoffMs: Math.round(backoffMs) }));
        await delay(backoffMs);
        continue;
      }

      throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      const axiosError = error as AxiosError;
      if (axiosError.response?.status && axiosError.response.status >= 400 && axiosError.response.status < 500 && axiosError.response.status !== 429) {
        throw error;
      }
      if (attempt === retries - 1) throw error;
      await delay(1000 * Math.pow(2, attempt) + Math.random() * 1000);
    }
  }
  throw new Error('All retries exhausted');
}

/**
 * Fetch search results page and extract listings
 */
export async function fetchSearchResults(params: {
  offerType: 'rent' | 'buy';
  location?: string;
  page?: number;
}): Promise<{ listings: any[]; pageCount: number; totalCount: number }> {
  const location = params.location || 'switzerland';
  const page = params.page || 1;
  const url = `${BASE_URL}/en/${params.offerType}/real-estate/${location}/matching-list?ep=${page}`;

  const html = await fetchWithRetry(url);
  const state = extractInitialState(html);

  const result = state?.resultList?.search?.fullSearch?.result || {};
  return {
    listings: result.listings || [],
    pageCount: result.pageCount || 0,
    totalCount: result.totalCount || 0,
  };
}

/**
 * Fetch property detail page and extract data
 */
export async function fetchPropertyDetail(propertyId: string, offerType: 'rent' | 'buy'): Promise<any> {
  const url = `${BASE_URL}/en/${offerType}/${propertyId}`;
  const html = await fetchWithRetry(url);
  const state = extractInitialState(html);

  // The detail page has the listing data in a different path
  return state?.listing || state;
}

/**
 * Fetch all properties with pagination
 */
export async function fetchAllProperties(params: {
  offerType: 'rent' | 'buy';
  location?: string;
  maxPages?: number;
}): Promise<{ items: any[]; total: number }> {
  const allItems: any[] = [];
  let page = 1;
  const maxPages = params.maxPages || 100;
  let totalCount = 0;

  while (page <= maxPages) {
    const result = await fetchSearchResults({
      offerType: params.offerType,
      location: params.location,
      page,
    });

    if (result.listings.length === 0) break;

    allItems.push(...result.listings);
    totalCount = result.totalCount;

    console.log(JSON.stringify({
      level: 'info', service: 'homegate-ch',
      msg: 'Page fetched', page, count: result.listings.length,
      total: `${allItems.length}/${totalCount}`,
    }));

    if (page >= result.pageCount) break;

    page++;

    await new Promise(resolve => setTimeout(resolve, getRandomDelay(500, 2500)));

    if (page % 5 === 0) {
      await new Promise(resolve => setTimeout(resolve, getRandomDelay(3000, 6000)));
    }
  }

  return { items: allItems, total: totalCount };
}
