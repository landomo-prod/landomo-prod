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
        console.log(JSON.stringify({ level: 'warn', service: 'immovlan-scraper', msg: 'Rate limited (429)', retryAfter }));
        await delay(retryAfter * 1000);
        continue;
      }
      if (axiosError.response?.status && axiosError.response.status >= 400 && axiosError.response.status < 500) throw error;
      if (attempt === retries - 1) throw error;
      const delayMs = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 1000, 10000);
      console.log(JSON.stringify({ level: 'info', service: 'immovlan-scraper', msg: 'Retrying', attempt: attempt + 1, delayMs }));
      await delay(delayMs);
    }
  }
};

export interface DetailFetchResult {
  data?: any;
  isInactive: boolean;
  inactiveReason?: string;
}

export const fetchListingDetail = async (id: string | number): Promise<DetailFetchResult> => {
  const url = `https://www.immovlan.be/en/property/${id}`;
  const headers = getRealisticHeaders('https://www.immovlan.be/');

  try {
    const response = await axios.get(url, {
      headers: { ...headers, 'Accept': 'text/html,application/xhtml+xml' },
      timeout: 30000,
    });

    const html = response.data as string;

    const nextDataMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
    if (nextDataMatch) {
      try {
        const parsed = JSON.parse(nextDataMatch[1]);
        return { data: parsed.props?.pageProps?.property || parsed, isInactive: false };
      } catch { /* fall through */ }
    }

    const jsonMatch = html.match(/window\.__INITIAL_DATA__\s*=\s*({.*?});/s) ||
                      html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s);
    if (jsonMatch) {
      try { return { data: JSON.parse(jsonMatch[1]), isInactive: false }; } catch { /* fall through */ }
    }

    return { data: response.data, isInactive: false };
  } catch (error) {
    const axiosError = error as AxiosError;
    if (axiosError.response?.status === 410 || axiosError.response?.status === 404) {
      return { isInactive: true, inactiveReason: `http_${axiosError.response.status}` };
    }
    throw error;
  }
};

export const fetchAllListingPages = async (
  category: string,
  transactionType: string,
  maxPages?: number
): Promise<any[]> => {
  const CONCURRENT_PAGES = parseInt(process.env.CONCURRENT_PAGES || '3');
  const allListings: any[] = [];
  const seenIds = new Set<string>();
  let currentPage = 1;
  let hasMore = true;

  const typeSlug = transactionType === 'sale' ? 'a-vendre' : 'a-louer';
  const categorySlug = getCategorySlug(category);

  console.log(JSON.stringify({ level: 'info', service: 'immovlan-scraper', msg: 'Fetching listings', category, transactionType }));

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
        await delay(getRandomDelay(500, 1500));
        return fetchSearchPage(categorySlug, typeSlug, pageNum);
      })
    );

    let pagesWithData = 0;
    for (let i = 0; i < pageResults.length; i++) {
      const result = pageResults[i];
      if (result.status === 'fulfilled' && result.value && result.value.length > 0) {
        const newListings = result.value.filter((l: any) => {
          const id = l.id?.toString();
          if (!id || seenIds.has(id)) return false;
          seenIds.add(id);
          return true;
        });
        if (newListings.length === 0) { hasMore = false; break; }
        pagesWithData++;
        allListings.push(...newListings);
        if (result.value.length < 20) { hasMore = false; break; }
      } else if (result.status === 'fulfilled') { hasMore = false; break; }
    }

    if (pagesWithData === 0) hasMore = false;
    currentPage = batchEndPage + 1;
    if (hasMore) await delay(1500);
  }

  console.log(JSON.stringify({ level: 'info', service: 'immovlan-scraper', msg: 'Fetched total', total: allListings.length }));
  return allListings;
};

async function fetchSearchPage(categorySlug: string, typeSlug: string, page: number): Promise<any[]> {
  const url = `https://www.immovlan.be/fr/biens-immobiliers/${typeSlug}/${categorySlug}?page=${page}`;
  const headers = getRealisticHeaders('https://www.immovlan.be/');

  try {
    const response = await axios.get(url, {
      headers: { ...headers, 'Accept': 'text/html,application/xhtml+xml' },
      timeout: 30000,
    });

    const html = response.data as string;

    const nextDataMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
    if (nextDataMatch) {
      try {
        const data = JSON.parse(nextDataMatch[1]);
        return data.props?.pageProps?.results?.items || data.props?.pageProps?.properties || [];
      } catch { /* fall through */ }
    }

    const ldMatches = html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs);
    for (const m of ldMatches) {
      try {
        const parsed = JSON.parse(m[1]);
        if (Array.isArray(parsed)) return parsed;
        if (parsed.itemListElement) return parsed.itemListElement.map((e: any) => e.item || e);
      } catch { /* continue */ }
    }

    const listings: any[] = [];
    const idMatches = html.matchAll(/data-property-id="(\d+)"/g);
    for (const m of idMatches) {
      listings.push({ id: parseInt(m[1]) });
    }

    return listings;
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', service: 'immovlan-scraper', msg: 'Search page failed', page, err: (error as any).message }));
    return [];
  }
}

function getCategorySlug(category: string): string {
  switch (category.toLowerCase()) {
    case 'apartment': return 'appartements';
    case 'house': return 'maisons';
    case 'land': return 'terrains';
    case 'commercial': return 'commerces';
    default: return 'appartements';
  }
}

function getRandomDelay(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
