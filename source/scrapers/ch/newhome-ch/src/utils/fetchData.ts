import axios, { AxiosError } from 'axios';
import { getRandomUserAgent } from './userAgents';

function getHeaders(): Record<string, string> {
  return {
    'User-Agent': getRandomUserAgent(),
    'Accept': 'application/json',
    'Accept-Language': 'de-CH,de;q=0.9,en;q=0.8,fr;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Referer': 'https://www.newhome.ch/',
    'Origin': 'https://www.newhome.ch',
  };
}

export async function fetchWithRetry(
  url: string,
  options: { method?: string; data?: any; headers?: Record<string, string> } = {},
  retries: number = 3
): Promise<any> {
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await axios({
        url,
        method: options.method || 'GET',
        data: options.data,
        headers: { ...getHeaders(), ...options.headers },
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
      console.log(JSON.stringify({ level: 'info', service: 'newhome-ch', msg: 'Retrying request', attempt: attempt + 1, retries, delayMs }));
      await delay(delayMs);
    }
  }
}

/**
 * Fetch listing search results from Newhome API
 *
 * TODO: Verify actual Newhome API endpoint structure after deployment.
 * Newhome.ch likely uses an internal API for search results.
 */
export async function fetchListingPage(
  offerType: 'buy' | 'rent',
  propertyType: string,
  page: number,
  pageSize: number = 50
): Promise<{ results: any[]; totalCount: number }> {
  // TODO: Verify actual Newhome search API endpoint
  const url = `https://api.newhome.ch/api/v1/search`;

  const payload = {
    offerType,
    propertyTypes: [propertyType],
    page,
    pageSize,
    sortBy: 'date',
    sortOrder: 'desc',
  };

  const data = await fetchWithRetry(url, {
    method: 'POST',
    data: payload,
    headers: { 'Content-Type': 'application/json' },
  });

  return {
    results: data?.items || data?.results || data?.objects || [],
    totalCount: data?.totalCount || data?.total || 0,
  };
}

/**
 * Fetch detail page for a single listing
 *
 * TODO: Verify actual detail endpoint URL pattern
 */
export async function fetchListingDetail(listingId: string): Promise<any> {
  // TODO: Verify actual Newhome detail API endpoint
  const url = `https://api.newhome.ch/api/v1/objects/${listingId}`;
  return fetchWithRetry(url);
}

/**
 * Fetch all listing pages for a given offer type and property type
 */
export async function fetchAllListingPages(
  offerType: 'buy' | 'rent',
  propertyType: string,
  maxPages?: number
): Promise<any[]> {
  const CONCURRENT_PAGES = parseInt(process.env.CONCURRENT_PAGES || '5');
  const allListings: any[] = [];
  let currentPage = 1;
  let hasMore = true;
  const pageSize = 50;

  while (hasMore && (!maxPages || currentPage <= maxPages)) {
    const batchEndPage = maxPages
      ? Math.min(currentPage + CONCURRENT_PAGES - 1, maxPages)
      : currentPage + CONCURRENT_PAGES - 1;

    const pageNumbers = Array.from(
      { length: batchEndPage - currentPage + 1 },
      (_, i) => currentPage + i
    );

    const pageResults = await Promise.allSettled(
      pageNumbers.map(p => fetchListingPage(offerType, propertyType, p, pageSize))
    );

    let pagesWithData = 0;
    for (let i = 0; i < pageResults.length; i++) {
      const result = pageResults[i];

      if (result.status === 'fulfilled') {
        const { results, totalCount } = result.value;

        if (results.length > 0) {
          pagesWithData++;
          allListings.push(...results);

          if (results.length < pageSize || allListings.length >= totalCount) {
            hasMore = false;
            break;
          }
        } else {
          hasMore = false;
          break;
        }
      } else {
        console.error(JSON.stringify({ level: 'error', service: 'newhome-ch', msg: 'Failed to fetch page', page: pageNumbers[i], err: result.reason?.message }));
      }
    }

    if (pagesWithData === 0) hasMore = false;

    currentPage = batchEndPage + 1;

    if (hasMore) {
      await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500));
    }
  }

  console.log(JSON.stringify({ level: 'info', service: 'newhome-ch', msg: 'Fetched total listings', totalListings: allListings.length, offerType, propertyType }));
  return allListings;
}
