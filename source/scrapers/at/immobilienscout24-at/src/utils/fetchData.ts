import { chromium, Browser, BrowserContext, Page } from 'rebrowser-playwright';

const BASE_URL = 'https://www.immobilienscout24.at';

/**
 * Search type URL segments for ImmobilienScout24 AT
 * URL pattern: /regional/oesterreich/{segment}/seite-{N}
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
 * Listing summary from search page SSR data
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

// Singleton browser instance
let browser: Browser | null = null;
let context: BrowserContext | null = null;

/**
 * Get or create the shared browser instance
 */
export async function getBrowser(): Promise<BrowserContext> {
  if (context) return context;

  browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--disable-web-security',
    ],
    ignoreDefaultArgs: ['--enable-automation'],
  });

  context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'de-AT',
    viewport: { width: 1920, height: 1080 },
  });

  return context;
}

/**
 * Close the browser instance
 */
export async function closeBrowser(): Promise<void> {
  if (context) {
    await context.close();
    context = null;
  }
  if (browser) {
    await browser.close();
    browser = null;
  }
}

/**
 * Wait for captcha/bot challenge to resolve (up to 30s)
 */
async function waitForCaptcha(page: Page): Promise<boolean> {
  const maxWait = 30000;
  const start = Date.now();

  while (Date.now() - start < maxWait) {
    const challengeInfo = await page.evaluate(() => {
      const title = document.title || '';
      const isCaptcha = title.includes('Challenge') ||
        title.includes('Roboter') ||
        title.includes('captcha') ||
        document.querySelector('#challenge-running') !== null ||
        document.querySelector('#cf-challenge-running') !== null;
      return { isCaptcha, title };
    }).catch(() => ({ isCaptcha: false, title: '' }));

    if (!challengeInfo.isCaptcha) {
      return true;
    }

    console.log(`   Bot challenge detected (title: "${challengeInfo.title}"), waiting...`);
    await page.waitForTimeout(3000);
  }

  console.warn('   Bot challenge did not resolve within 30s');
  return false;
}

/**
 * Extract hits array from SSR HTML embedded Redux state.
 * The AT site embeds listing data as "hits":[{...},...] in the HTML.
 */
async function extractHitsFromPage(page: Page): Promise<any[]> {
  const html = await page.content();
  return extractHitsFromHtml(html);
}

/**
 * Extract hits array from raw HTML string
 */
function extractHitsFromHtml(html: string): any[] {
  const hitsIdx = html.indexOf('"hits":[{');
  if (hitsIdx < 0) {
    // Check if 404 page
    if (html.includes('react-404')) {
      console.warn('   Page returned 404');
    }
    return [];
  }

  // Parse the hits array by finding matching brackets
  const arrStart = hitsIdx + 7; // after "hits":
  let depth = 0;
  let end = arrStart;
  for (let i = arrStart; i < html.length && i < arrStart + 500000; i++) {
    if (html[i] === '[') depth++;
    if (html[i] === ']') {
      depth--;
      if (depth === 0) { end = i + 1; break; }
    }
  }

  const hitsJson = html.substring(arrStart, end);
  try {
    return JSON.parse(hitsJson);
  } catch (e: any) {
    console.warn(`   Failed to parse hits JSON: ${e.message}`);
    return [];
  }
}

/**
 * Convert a raw hit object to SearchListing
 */
function hitToSearchListing(hit: any): SearchListing | null {
  const exposeId = hit.exposeId;
  if (!exposeId) return null;

  // Parse address from addressString (e.g. "1020 Wien")
  const addrStr = hit.addressString || '';
  const addrMatch = addrStr.match(/^(\d{4})\s+(.+)$/);

  return {
    expose_id: String(exposeId),
    title: hit.headline || '',
    price: hit.primaryPrice != null ? String(hit.primaryPrice) : '',
    address: {
      postcode: addrMatch?.[1],
      city: addrMatch?.[2],
    },
    living_space: hit.primaryArea != null ? String(hit.primaryArea) : undefined,
    number_of_rooms: hit.numberOfRooms != null ? String(hit.numberOfRooms) : undefined,
  };
}

/**
 * Fetch all search listings for a given category by paginating SSR pages.
 * URL pattern: /regional/oesterreich/{segment}/seite-{N}
 */
export async function fetchSearchListings(
  category: SearchCategory,
  maxPages: number = 5000
): Promise<SearchListing[]> {
  const ctx = await getBrowser();
  const page = await ctx.newPage();
  const allListings: SearchListing[] = [];
  const urlSegment = SEARCH_TYPES[category];

  try {
    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      const pageSuffix = pageNum > 1 ? `/seite-${pageNum}` : '';
      const url = `${BASE_URL}/regional/oesterreich/${urlSegment}${pageSuffix}`;
      console.log(`   Fetching ${category} page ${pageNum}: ${url}`);

      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      const captchaPassed = await waitForCaptcha(page);

      if (!captchaPassed) {
        console.warn(`   Captcha blocked on page ${pageNum}, stopping pagination`);
        break;
      }

      const hits = await extractHitsFromPage(page);

      if (hits.length === 0) {
        console.log(`   No results on page ${pageNum}, stopping pagination`);
        break;
      }

      const listings = hits
        .map(hitToSearchListing)
        .filter((l): l is SearchListing => l !== null);

      allListings.push(...listings);
      console.log(`   Page ${pageNum}: ${listings.length} listings (${allListings.length} total)`);

      if (listings.length < 3) {
        console.log(`   Only ${listings.length} listings on page ${pageNum}, likely last page`);
        break;
      }

      const delay = 1000 + Math.random() * 2000;
      await page.waitForTimeout(delay);

      if (pageNum % 5 === 0) {
        const longPause = 3000 + Math.random() * 3000;
        console.log(`   Taking a break (${(longPause / 1000).toFixed(1)}s) after ${pageNum} pages...`);
        await page.waitForTimeout(longPause);
      }
    }
  } finally {
    console.log(`   ${category} pagination complete: ${allListings.length} total listings`);
    await page.close();
  }

  return allListings;
}

/**
 * Fetch property detail from expose page.
 * The AT site embeds expose data in the SSR HTML.
 */
export async function fetchPropertyDetail(exposeId: string): Promise<any> {
  const ctx = await getBrowser();
  const page = await ctx.newPage();

  try {
    const url = `${BASE_URL}/expose/${exposeId}`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const captchaPassed = await waitForCaptcha(page);

    if (!captchaPassed) {
      console.warn(`   Captcha blocked for expose ${exposeId}`);
      return null;
    }

    // Try window.IS24.expose first
    const exposeData = await page.evaluate(() => {
      return (window as any).IS24?.expose || null;
    });

    if (exposeData) {
      return { ...exposeData, id: exposeId, exposeId };
    }

    // Fallback: extract from SSR HTML
    const html = await page.content();

    // Look for expose data in script tags
    const scriptData = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script[type="application/json"], script[type="application/ld+json"]'));
      for (const script of scripts) {
        try {
          const data = JSON.parse(script.textContent || '');
          if (data.expose || data.objectData || data['@type'] === 'RealEstateListing') {
            return data.expose || data;
          }
        } catch { /* skip */ }
      }
      return null;
    });

    if (scriptData) {
      return { ...scriptData, id: exposeId, exposeId };
    }

    // Try extracting from Redux state in HTML
    const exposeMatch = html.match(/"exposeData"\s*:\s*(\{[^}]*"exposeId"[^}]*\})/);
    if (exposeMatch) {
      try {
        const data = JSON.parse(exposeMatch[1]);
        return { ...data, id: exposeId, exposeId };
      } catch { /* skip */ }
    }

    console.warn(`   No expose data found for ${exposeId}`);
    return null;
  } finally {
    await page.close();
  }
}

/**
 * Parse German price string to number (e.g. "586.194,84 EUR" -> 586194.84)
 */
export function parseGermanPrice(priceStr: string): number {
  if (!priceStr) return 0;
  const cleaned = priceStr.replace(/[^\d.,]/g, '');
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
