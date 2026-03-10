import axios, { AxiosError } from 'axios';
import { getRealisticHeaders } from './headers';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const fetchDataWithRetry = async (
  url: string,
  headers: Record<string, string>,
  retries: number = 3
): Promise<any> => {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await axios.get(url, { headers, timeout: 30000 });
      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;
      if (axiosError.response?.status === 429) {
        const retryAfter = parseInt(axiosError.response.headers['retry-after'] as string || '60');
        console.log(JSON.stringify({ level: 'warn', service: 'immoweb-scraper', msg: 'Rate limited (429)', retryAfter }));
        await delay(retryAfter * 1000);
        continue;
      }
      if (axiosError.response?.status && axiosError.response.status >= 400 && axiosError.response.status < 500) {
        throw error;
      }
      if (attempt === retries - 1) throw error;
      const delayMs = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 1000, 10000);
      console.log(JSON.stringify({ level: 'info', service: 'immoweb-scraper', msg: 'Retrying request', attempt: attempt + 1, retries, delayMs }));
      await delay(delayMs);
    }
  }
};

export interface DetailFetchResult {
  data?: any;
  isInactive: boolean;
  inactiveReason?: string;
}

export const fetchListingDetail = async (id: number): Promise<DetailFetchResult> => {
  const url = `https://www.immoweb.be/en/classified/${id}`;
  const headers = getRealisticHeaders('https://www.immoweb.be/');

  try {
    const response = await axios.get(url, { headers, timeout: 30000 });
    const html = response.data as string;

    // Extract JSON-LD or window.__INITIAL_STATE__ from HTML
    const jsonMatch = html.match(/window\.classified\s*=\s*({.*?});/s);
    if (jsonMatch) {
      return { data: JSON.parse(jsonMatch[1]), isInactive: false };
    }

    // Try alternate pattern
    const ldMatch = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s);
    if (ldMatch) {
      return { data: JSON.parse(ldMatch[1]), isInactive: false };
    }

    // If we got HTML but no data, return the raw response for the API approach
    return { data: response.data, isInactive: false };
  } catch (error) {
    const axiosError = error as AxiosError;
    if (axiosError.response?.status === 410 || axiosError.response?.status === 404) {
      return { isInactive: true, inactiveReason: `http_${axiosError.response.status}` };
    }
    throw error;
  }
};

export const fetchSearchPage = async (
  category: string,
  transactionType: string,
  page: number,
  pageSize: number = 30
): Promise<any> => {
  const url = `https://www.immoweb.be/en/search/${category.toLowerCase()}/for-${transactionType === 'FOR_SALE' ? 'sale' : 'rent'}?countries=BE&page=${page}&orderBy=relevance`;

  const headers = getRealisticHeaders('https://www.immoweb.be/');
  const response = await axios.get(url, { headers, timeout: 30000 });
  const html = response.data as string;

  // Extract search results from embedded JSON
  const match = html.match(/window\.__NUXT__\s*=\s*({.*?});/s) ||
                html.match(/hydration-data[^>]*>(.*?)<\/script>/s);

  if (match) {
    try {
      return JSON.parse(match[1]);
    } catch {
      // Fall through to API approach
    }
  }

  return null;
};

export const fetchSearchApi = async (
  category: string,
  transactionType: string,
  page: number,
  pageSize: number = 30
): Promise<any> => {
  const headers = getRealisticHeaders('https://www.immoweb.be/');

  // Strategy 1: Try the JSON search API endpoint
  try {
    const categoryParam = category.toUpperCase();
    const txParam = transactionType === 'FOR_SALE' ? 'FOR_SALE' : 'FOR_RENT';
    const jsonUrl = `https://search.immoweb.be/en/search/classifieds?categories[]=${categoryParam}&transactionTypes[]=${txParam}&page=${page}&size=${pageSize}&countries=BE`;

    const jsonResponse = await axios.get(jsonUrl, {
      headers: {
        ...headers,
        'Accept': 'application/json',
      },
      timeout: 30000,
    });

    if (jsonResponse.data && typeof jsonResponse.data === 'object') {
      return jsonResponse.data;
    }
  } catch (error) {
    const axiosError = error as AxiosError;
    // JSON API blocked/unavailable — fall through to HTML approach
    if (axiosError.response?.status !== 403) {
      console.log(JSON.stringify({ level: 'debug', service: 'immoweb-scraper', msg: 'JSON API failed, trying HTML', status: axiosError.response?.status }));
    }
  }

  // Strategy 2: Try HTML search page with embedded JSON extraction
  const htmlUrl = `https://www.immoweb.be/en/search/${category.toLowerCase()}/for-${transactionType === 'FOR_SALE' ? 'sale' : 'rent'}?countries=BE&page=${page}&orderBy=relevance`;

  try {
    const response = await axios.get(htmlUrl, {
      headers: {
        ...headers,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      timeout: 30000,
    });

    const html = response.data as string;

    // Immoweb embeds search results as JSON in the page
    const classifiedMatch = html.match(/<iw-search[^>]*:results="([^"]*)"/) ||
                            html.match(/data-classified-list="([^"]*)"/);

    if (classifiedMatch) {
      try {
        const decoded = classifiedMatch[1]
          .replace(/&quot;/g, '"')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>');
        return JSON.parse(decoded);
      } catch { /* fall through */ }
    }

    // Try to find JSON data in script tags
    const scriptMatches = html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g);
    for (const m of scriptMatches) {
      const content = m[1];
      if (content.includes('"classified"') || content.includes('"results"')) {
        try {
          const jsonStr = content.match(/(\{[\s\S]*"results"[\s\S]*\})/);
          if (jsonStr) return JSON.parse(jsonStr[1]);
        } catch { /* continue */ }
      }
    }

    return null;
  } catch (error) {
    const axiosError = error as AxiosError;
    if (axiosError.response?.status === 403) {
      // Both JSON API and HTML are Cloudflare-blocked without headless browser
      // WARNING: Immoweb requires Puppeteer/stealth plugin for search pages.
      // Simple HTTP requests are blocked by Cloudflare WAF.
      console.warn(JSON.stringify({
        level: 'warn',
        service: 'immoweb-scraper',
        msg: 'Cloudflare blocked — Immoweb search requires Puppeteer/stealth plugin. Returning empty results.',
        category,
        transactionType,
        page,
      }));
      return null;
    }
    console.error(JSON.stringify({ level: 'error', service: 'immoweb-scraper', msg: 'Search API failed', status: axiosError.response?.status }));
    throw error;
  }
};

export const fetchAllListingPages = async (
  category: string,
  transactionType: string,
  maxPages?: number
): Promise<any[]> => {
  const CONCURRENT_PAGES = parseInt(process.env.CONCURRENT_PAGES || '5');
  const allListings: any[] = [];
  const seenIds = new Set<string>();
  let currentPage = 1;
  let hasMore = true;

  console.log(JSON.stringify({ level: 'info', service: 'immoweb-scraper', msg: 'Fetching listings', category, transactionType }));

  while (hasMore && (!maxPages || currentPage <= maxPages)) {
    const batchEndPage = maxPages
      ? Math.min(currentPage + CONCURRENT_PAGES - 1, maxPages)
      : currentPage + CONCURRENT_PAGES - 1;

    const pageNumbers = Array.from(
      { length: batchEndPage - currentPage + 1 },
      (_, i) => currentPage + i
    );

    const pageResults = await Promise.allSettled(
      pageNumbers.map(async (pageNum) => {
        await delay(getRandomDelay(200, 500));
        return fetchSearchApi(category, transactionType, pageNum);
      })
    );

    let pagesWithData = 0;
    for (let i = 0; i < pageResults.length; i++) {
      const result = pageResults[i];
      if (result.status === 'fulfilled' && result.value) {
        const listings = Array.isArray(result.value) ? result.value : (result.value.results || []);
        const newListings = listings.filter((l: any) => {
          const id = (l.id ?? l.classified_id)?.toString();
          if (!id || seenIds.has(id)) return false;
          seenIds.add(id);
          return true;
        });
        if (newListings.length > 0) {
          pagesWithData++;
          allListings.push(...newListings);
          if (listings.length < 30 || newListings.length === 0) {
            hasMore = false;
            break;
          }
        } else {
          hasMore = false;
          break;
        }
      } else {
        console.error(JSON.stringify({ level: 'error', service: 'immoweb-scraper', msg: 'Failed to fetch page', page: pageNumbers[i] }));
      }
    }

    if (pagesWithData === 0) hasMore = false;
    currentPage = batchEndPage + 1;
    if (hasMore) await delay(1000);
  }

  console.log(JSON.stringify({ level: 'info', service: 'immoweb-scraper', msg: 'Fetched total listings', total: allListings.length, category, transactionType }));
  return allListings;
};

function getRandomDelay(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
