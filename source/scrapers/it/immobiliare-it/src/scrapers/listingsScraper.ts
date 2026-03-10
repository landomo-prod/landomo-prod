import path from 'path';
import os from 'os';
import { chromium, BrowserContext, Page } from 'playwright';
import {
  ImmobiliareResponse,
  ImmobiliareResult,
  SearchConfig,
  CATEGORY_ID_MAP,
  REGIONS,
  ImmobiliareCategory,
  ImmobiliareContract,
} from '../types/immobiliareTypes';

const PROFILE_DIR = path.join(os.homedir(), '.landomo', 'immobiliare-profile');

/** Millisecond delay helper */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Random delay between min and max ms */
function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return delay(ms);
}

function log(level: string, msg: string, extra?: Record<string, unknown>): void {
  console.log(JSON.stringify({ level, service: 'immobiliare-scraper', msg, ...extra }));
}

// ---------------------------------------------------------------------------
// Browser lifecycle
// ---------------------------------------------------------------------------

let _context: BrowserContext | null = null;

/**
 * Launch (or reuse) a persistent Chromium context.
 * Headed so the user can solve the first Datadome CAPTCHA if required.
 * On subsequent runs the saved profile will carry the Datadome cookies.
 */
export async function launchBrowser(): Promise<BrowserContext> {
  if (_context) return _context;

  log('info', 'Launching persistent Chromium context', { profileDir: PROFILE_DIR });

  _context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ],
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
    locale: 'it-IT',
    timezoneId: 'Europe/Rome',
    // Persist cookies automatically via the profile directory
  });

  _context.on('close', () => {
    _context = null;
  });

  return _context;
}

export async function closeBrowser(): Promise<void> {
  if (_context) {
    await _context.close();
    _context = null;
  }
}

// ---------------------------------------------------------------------------
// Page fetching
// ---------------------------------------------------------------------------

/**
 * Build the HTML search URL for a given config + page number.
 */
function buildHtmlUrl(config: SearchConfig, page: number): string {
  const { urlSlug } = CATEGORY_ID_MAP[config.category][config.contract];
  return `https://www.immobiliare.it/${urlSlug}/${config.region}/?pag=${page}`;
}

/**
 * Navigate to a search page with Playwright, wait for `#__NEXT_DATA__`,
 * and extract the search results from the embedded JSON.
 *
 * Returns null when the page is blocked (no __NEXT_DATA__) so the caller
 * can decide whether to retry or abort.
 */
export async function fetchPage(
  context: BrowserContext,
  url: string,
): Promise<ImmobiliareResponse | null> {
  const page: Page = await context.newPage();

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });

    // Wait up to 15 s for Next.js to inject its data blob
    try {
      await page.waitForSelector('#__NEXT_DATA__', { timeout: 15000 });
    } catch {
      log('warn', 'Timed out waiting for #__NEXT_DATA__', { url });
      return null;
    }

    const rawJson = await page.$eval(
      '#__NEXT_DATA__',
      (el) => el.textContent || '',
    );

    if (!rawJson) {
      log('warn', 'Empty #__NEXT_DATA__', { url });
      return null;
    }

    let nextData: any;
    try {
      nextData = JSON.parse(rawJson);
    } catch {
      log('warn', 'Failed to parse #__NEXT_DATA__ JSON', { url });
      return null;
    }

    // immobiliare.it uses different keys depending on the Next.js version deployed
    const searchList =
      nextData?.props?.pageProps?.searchList ||
      nextData?.props?.pageProps?.searchData;

    if (!searchList) {
      log('warn', 'searchList/searchData not found in __NEXT_DATA__', { url });
      return null;
    }

    return searchList as ImmobiliareResponse;
  } finally {
    await page.close();
  }
}

// ---------------------------------------------------------------------------
// Detail page fetching
// ---------------------------------------------------------------------------

/**
 * Fetch a single listing detail page and return the enriched ImmobiliareResult.
 * Reuses the singleton Playwright context (no extra browser launch needed).
 *
 * Detail URL: https://www.immobiliare.it/annunci/{id}/
 * The __NEXT_DATA__ on detail pages has a much richer property object under
 * props.pageProps.detailData.realEstate
 */
export async function fetchDetailPage(
  context: BrowserContext,
  listingId: number,
): Promise<ImmobiliareResult | null> {
  const url = `https://www.immobiliare.it/annunci/${listingId}/`;
  const page: Page = await context.newPage();

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });

    try {
      await page.waitForSelector('#__NEXT_DATA__', { timeout: 15000 });
    } catch {
      log('warn', 'Detail page: timed out waiting for #__NEXT_DATA__', { listingId });
      return null;
    }

    const rawJson = await page.$eval('#__NEXT_DATA__', (el) => el.textContent || '');
    if (!rawJson) return null;

    let nextData: any;
    try {
      nextData = JSON.parse(rawJson);
    } catch {
      return null;
    }

    // Detail page stores the full listing under detailData.realEstate
    const detailData =
      nextData?.props?.pageProps?.detailData ||
      nextData?.props?.pageProps?.serverData;

    if (!detailData?.realEstate) return null;

    // Normalise into ImmobiliareResult shape so existing transformers work
    const re = detailData.realEstate;
    return {
      realEstate: re,
      seo: detailData.seo,
      // Detail page returns properties as the top-level `properties` array
      // or nested under realEstate.properties
      properties: re.properties || detailData.properties || [],
    } as ImmobiliareResult;
  } catch (err: any) {
    log('warn', 'Detail page fetch error', { listingId, err: err.message });
    return null;
  } finally {
    await page.close();
  }
}

// ---------------------------------------------------------------------------
// Region scraping
// ---------------------------------------------------------------------------

/** Pages sampled per minute must stay ≤ 5, so inter-page delay ≥ 12 s.
 * We use a random 12-18 s window and a longer pause every 20 pages. */
const PAGE_DELAY_MIN_MS = 1500;
const PAGE_DELAY_MAX_MS = 3000;
const LONG_PAUSE_EVERY = 20;
const LONG_PAUSE_MS = 30_000;

/**
 * Paginate through all pages for a single region / category / contract combo.
 * Calls `onBatch` with each page's results for immediate downstream processing.
 */
export async function scrapeRegion(
  context: BrowserContext,
  config: SearchConfig,
  onBatch: (batch: ImmobiliareResult[], config: SearchConfig) => Promise<void>,
): Promise<ImmobiliareResult[]> {
  const allResults: ImmobiliareResult[] = [];
  let page = 1;
  let maxPages = 1;

  const firstUrl = buildHtmlUrl(config, page);
  log('info', 'Fetching first page', {
    region: config.region,
    category: config.category,
    contract: config.contract,
    url: firstUrl,
  });

  const firstResponse = await fetchPage(context, firstUrl);
  if (!firstResponse) {
    log('error', 'First page blocked – skipping combo', {
      region: config.region,
      category: config.category,
      contract: config.contract,
    });
    return allResults;
  }

  maxPages = firstResponse.maxPages || 1;
  const firstBatch = firstResponse.results || [];
  allResults.push(...firstBatch);

  log('info', 'First page fetched', {
    region: config.region,
    category: config.category,
    contract: config.contract,
    totalAds: firstResponse.totalAds,
    maxPages,
    count: firstBatch.length,
  });

  if (firstBatch.length > 0) {
    await onBatch(firstBatch, config);
  }

  while (page < maxPages) {
    page++;

    // Rate limiting: pause between pages
    await randomDelay(PAGE_DELAY_MIN_MS, PAGE_DELAY_MAX_MS);

    // Extended pause every LONG_PAUSE_EVERY pages
    if (page % LONG_PAUSE_EVERY === 0) {
      log('info', `Pausing ${LONG_PAUSE_MS / 1000}s after ${page} pages`, {
        region: config.region,
        category: config.category,
      });
      await delay(LONG_PAUSE_MS);
    }

    const url = buildHtmlUrl(config, page);
    let response: ImmobiliareResponse | null = null;

    try {
      response = await fetchPage(context, url);
    } catch (err: any) {
      log('error', 'Page fetch threw', {
        region: config.region,
        category: config.category,
        page,
        err: err.message,
      });
      break;
    }

    if (!response) {
      log('warn', 'Page returned no data – stopping pagination', {
        region: config.region,
        category: config.category,
        page,
      });
      break;
    }

    const batch = response.results || [];
    if (batch.length === 0) break;

    allResults.push(...batch);
    await onBatch(batch, config);

    log('info', 'Page fetched', {
      region: config.region,
      category: config.category,
      contract: config.contract,
      page,
      count: batch.length,
      totalSoFar: allResults.length,
    });
  }

  return allResults;
}

// ---------------------------------------------------------------------------
// Orchestration – scrapeAll
// ---------------------------------------------------------------------------

/**
 * Iterate through all region × category × contract combinations sequentially.
 * Runs one combo at a time to avoid triggering Datadome rate limits.
 *
 * `onBatch` is called with each page's ImmobiliareResult[] and the SearchConfig
 * so downstream processing (checksum compare → ingest) can happen page-by-page.
 */
export async function scrapeAll(
  onBatch: (batch: ImmobiliareResult[], config: SearchConfig) => Promise<void>,
): Promise<ImmobiliareResult[]> {
  const context = await launchBrowser();
  const allResults: ImmobiliareResult[] = [];

  const categories: ImmobiliareCategory[] = ['apartments', 'houses', 'land', 'commercial'];
  const contracts: ImmobiliareContract[] = ['sale', 'rent'];

  for (const category of categories) {
    for (const contract of contracts) {
      // Land rent is extremely rare in Italy – skip
      if (category === 'land' && contract === 'rent') continue;

      for (const region of REGIONS) {
        const config: SearchConfig = { category, contract, region };

        try {
          const results = await scrapeRegion(context, config, onBatch);
          allResults.push(...results);
        } catch (err: any) {
          log('error', 'Region scrape failed', {
            region,
            category,
            contract,
            err: err.message,
          });
          // Continue with next combo instead of aborting the entire run
        }

        // Brief pause between combos
        await randomDelay(2000, 4000);
      }
    }
  }

  log('info', 'scrapeAll complete', { totalResults: allResults.length });
  return allResults;
}
