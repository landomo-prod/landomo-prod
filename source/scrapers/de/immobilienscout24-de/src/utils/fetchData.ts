import https from 'https';
import http from 'http';

const BASE_URL = 'https://www.immobilienscout24.de';

/**
 * URL of the cloudflare-bypass service (FastAPI on port 8888).
 * Falls back to disabled if not set.
 */
const BYPASS_SERVICE_URL = process.env.BYPASS_SERVICE_URL || '';

/**
 * Search type URL segments for ImmobilienScout24 DE SSR pages
 */
export const SEARCH_TYPES = {
  'apartment-sale': 'wohnung-kaufen',
  'apartment-rent': 'wohnung-mieten',
  'house-sale': 'haus-kaufen',
  'house-rent': 'haus-mieten',
  'land-sale': 'grundstueck-kaufen',
  'commercial-sale': 'gewerbe-kaufen',
} as const;

export type SearchCategory = keyof typeof SEARCH_TYPES;

/**
 * Sitemap real estate type mapping for each search category.
 * The DE site publishes active expose IDs at:
 * /Suche/sitemap/activeExposes.xml?realEstateType={TYPE}&page={N}
 */
const SITEMAP_TYPES: Record<SearchCategory, string[]> = {
  'apartment-sale': ['APARTMENT_BUY'],
  'apartment-rent': ['APARTMENT_RENT'],
  'house-sale': ['HOUSE_BUY'],
  'house-rent': ['HOUSE_RENT'],
  'land-sale': ['LIVING_BUY_SITE'],
  'commercial-sale': ['OFFICE', 'STORE', 'GASTRONOMY', 'INDUSTRY', 'SPECIAL_PURPOSE'],
};

/**
 * Listing summary from search page JSON
 */
export interface SearchListing {
  expose_id: string;
  title: string;
  price: string;
  address: {
    quarter?: string;
    postcode?: string;
    city?: string;
    street?: string;
    house_number?: string;
  };
  living_space?: string;
  number_of_rooms?: string;
  energy_efficiency_class?: string;
}

/**
 * No-op stubs kept for compatibility with callers that import closeBrowser / getBrowser.
 * The bypass service replaces Playwright entirely.
 */
export async function getBrowser(): Promise<never> {
  throw new Error('getBrowser() is disabled — bypass service is used instead');
}

export async function closeBrowser(): Promise<void> {
  // No browser to close — bypass service handles fetching
}

/**
 * POST a fetch request to the cloudflare-bypass service.
 * Returns the raw HTML body, or null on failure.
 */
function callBypassService(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    if (!BYPASS_SERVICE_URL) {
      resolve(null);
      return;
    }

    const payload = JSON.stringify({ url, method: 'GET' });
    const parsed = new URL(`${BYPASS_SERVICE_URL}/fetch`);
    const isHttps = parsed.protocol === 'https:';
    const mod = isHttps ? https : http;

    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    const req = mod.request(options, (res) => {
      let data = '';
      res.on('data', (chunk: Buffer) => (data += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) {
            console.warn(`   Bypass service error: ${json.error}`);
            resolve(null);
          } else if (json.status && json.status >= 200 && json.status < 400) {
            resolve(json.body || null);
          } else {
            console.warn(`   Bypass service returned status ${json.status} for ${url}`);
            resolve(null);
          }
        } catch (e) {
          console.warn(`   Failed to parse bypass service response: ${e}`);
          resolve(null);
        }
      });
    });

    req.on('error', (e) => {
      console.warn(`   Bypass service request failed: ${e.message}`);
      resolve(null);
    });

    req.setTimeout(90000, () => {
      req.destroy();
      console.warn('   Bypass service request timed out');
      resolve(null);
    });

    req.write(payload);
    req.end();
  });
}

/**
 * Fetch XML content from a URL via plain HTTPS (no browser needed)
 */
function fetchXml(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Accept': 'application/xml, text/xml, */*',
      },
    }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchXml(res.headers.location).then(resolve, reject);
        return;
      }
      let data = '';
      res.on('data', (chunk: Buffer) => data += chunk);
      res.on('end', () => resolve(data));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

/**
 * Extract expose IDs from a sitemap XML page
 */
function extractExposeIds(xml: string): string[] {
  const ids: string[] = [];
  const regex = /\/expose\/(\d+)/g;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    ids.push(match[1]);
  }
  return ids;
}

/**
 * Fetch all search listings for a category using the sitemap.
 * DE site publishes all active expose IDs at:
 * /Suche/sitemap/activeExposes.xml?realEstateType={TYPE}&page={N}
 * This avoids captcha entirely since sitemaps are public XML.
 */
export async function fetchSearchListings(
  category: SearchCategory,
  _maxPages: number = 100
): Promise<SearchListing[]> {
  const sitemapTypes = SITEMAP_TYPES[category];
  const allListings: SearchListing[] = [];

  for (const realEstateType of sitemapTypes) {
    // First, discover how many pages exist for this type from the index
    console.log(`   Fetching sitemap index for ${category} (${realEstateType})`);
    const indexUrl = `${BASE_URL}/Suche/sitemap/activeExposes.xml`;

    try {
      const indexXml = await fetchXml(indexUrl);
      // Find all pages for this real estate type
      const pageRegex = new RegExp(
        `realEstateType=${realEstateType}&amp;page=(\\d+)`,
        'g'
      );
      const pages: number[] = [];
      let match;
      while ((match = pageRegex.exec(indexXml)) !== null) {
        pages.push(parseInt(match[1], 10));
      }

      if (pages.length === 0) {
        console.log(`   No sitemap pages found for ${realEstateType}`);
        continue;
      }

      console.log(`   Found ${pages.length} sitemap page(s) for ${realEstateType}`);

      for (const pageNum of pages) {
        const pageUrl = `${BASE_URL}/Suche/sitemap/activeExposes.xml?realEstateType=${realEstateType}&page=${pageNum}`;
        console.log(`   Fetching sitemap page ${pageNum}: ${pageUrl}`);

        const pageXml = await fetchXml(pageUrl);
        const exposeIds = extractExposeIds(pageXml);

        const listings: SearchListing[] = exposeIds.map((id) => ({
          expose_id: id,
          title: '',
          price: '',
          address: {},
        }));

        allListings.push(...listings);
        console.log(`   Sitemap page ${pageNum}: ${exposeIds.length} expose IDs (${allListings.length} total)`);

        // Small delay between sitemap fetches
        await new Promise((r) => setTimeout(r, 500));
      }
    } catch (err: any) {
      console.error(`   Failed to fetch sitemap for ${realEstateType}: ${err.message}`);
    }
  }

  return allListings;
}

/**
 * Extract IS24 expose data from raw HTML returned by the bypass service.
 * Tries multiple patterns that IS24 uses to embed data in the page.
 */
function extractExposeDataFromHtml(html: string, exposeId: string): any | null {
  // Check for anti-bot block
  if (html.includes('Ich bin kein Roboter') || html.includes('captcha')) {
    console.warn(`   Anti-bot page detected for expose ${exposeId}`);
    return null;
  }

  // Strategy 1: __NEXT_DATA__ JSON blob (Next.js)
  const nextDataMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>(\{.+?\})<\/script>/s);
  if (nextDataMatch) {
    try {
      const nextData = JSON.parse(nextDataMatch[1]);
      const expose = nextData?.props?.pageProps?.expose ||
        nextData?.props?.pageProps?.listing ||
        nextData?.props?.pageProps?.property;
      if (expose) return { ...expose, id: exposeId, exposeId, _source: '__NEXT_DATA__' };
    } catch { /* continue */ }
  }

  // Strategy 2: window.IS24 = {...} or IS24.expose = {...}
  const is24Match = html.match(/window\.IS24\s*=\s*(\{.+?\});/s) ||
    html.match(/var IS24\s*=\s*(\{.+?\});/s);
  if (is24Match) {
    try {
      const is24 = JSON.parse(is24Match[1]);
      const expose = is24?.expose || is24;
      if (expose?.id || expose?.title) return { ...expose, id: exposeId, exposeId, _source: 'IS24' };
    } catch { /* continue */ }
  }

  // Strategy 3: keyValues embedded JSON
  const keyValuesMatch = html.match(/keyValues\s*=\s*(\{.+?\});/s);
  if (keyValuesMatch) {
    try {
      const kv = JSON.parse(keyValuesMatch[1]);
      if (kv) return { keyValues: kv, id: exposeId, exposeId, _source: 'keyValues' };
    } catch { /* continue */ }
  }

  // Strategy 4: application/json script tags with expose data
  const jsonScriptRegex = /<script[^>]+type="application\/json"[^>]*>(\{.+?\})<\/script>/gs;
  let jsonMatch;
  while ((jsonMatch = jsonScriptRegex.exec(html)) !== null) {
    try {
      const data = JSON.parse(jsonMatch[1]);
      if (data?.expose || data?.objectData) {
        return { ...(data.expose || data), id: exposeId, exposeId, _source: 'json-script' };
      }
    } catch { /* continue */ }
  }

  // Strategy 5: Look for expose ID embedded with price/area data as fallback
  const titleMatch = html.match(/<title>([^<]+)<\/title>/);
  const priceMatch = html.match(/(\d[\d.,]+)\s*(?:€|EUR)/);
  if (titleMatch || priceMatch) {
    // Return minimal stub so transformer can extract HTML-level data
    return {
      id: exposeId,
      exposeId,
      _source: 'html-stub',
      _rawHtml: html.length > 500000 ? html.substring(0, 500000) : html,
    };
  }

  return null;
}

/**
 * Fetch property detail from expose page via the cloudflare-bypass service.
 * The service tries curl_cffi (Chrome TLS) first, then falls back to a full
 * Camoufox browser session if blocked (403/429/503).
 */
export async function fetchPropertyDetail(exposeId: string): Promise<any> {
  if (!BYPASS_SERVICE_URL) {
    console.error('   BYPASS_SERVICE_URL is not set — cannot fetch property detail');
    return null;
  }

  const url = `${BASE_URL}/expose/${exposeId}`;
  console.log(`   Fetching via bypass service: ${url}`);

  const html = await callBypassService(url);
  if (!html) {
    console.warn(`   Bypass service returned no content for ${exposeId}`);
    return null;
  }

  const data = extractExposeDataFromHtml(html, exposeId);
  if (!data) {
    console.warn(`   No expose data found in bypass response for ${exposeId}`);
  }
  return data;
}

/**
 * Parse German price string to number (e.g. "586.194,84 EUR" -> 586194.84)
 */
export function parseGermanPrice(priceStr: string): number {
  if (!priceStr) return 0;
  // Remove currency symbols and whitespace
  const cleaned = priceStr.replace(/[^\d.,]/g, '');
  // German format: 586.194,84 -> remove dots, replace comma with dot
  const normalized = cleaned.replace(/\./g, '').replace(',', '.');
  return parseFloat(normalized) || 0;
}

/**
 * Parse German area string to number (e.g. "119,7 m2" -> 119.7)
 */
export function parseGermanArea(areaStr?: string): number | undefined {
  if (!areaStr) return undefined;
  const cleaned = areaStr.replace(/[^\d.,]/g, '');
  const normalized = cleaned.replace(/\./g, '').replace(',', '.');
  const val = parseFloat(normalized);
  return isNaN(val) ? undefined : val;
}
