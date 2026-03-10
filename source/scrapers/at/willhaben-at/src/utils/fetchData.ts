import axios, { AxiosError } from 'axios';
import * as https from 'https';
import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { getWillhabenHeaders } from './userAgents';

/**
 * CSRF token cache with expiration
 */
let csrfTokenCache: {
  token: string | null;
  timestamp: number;
} = {
  token: null,
  timestamp: 0
};

const CSRF_TOKEN_TTL = 30 * 60 * 1000; // 30 minutes

/**
 * Get random delay between requests (human-like behavior)
 */
function getRandomDelay(min: number = 300, max: number = 2000): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Sleep for random duration
 */
async function randomDelay(min: number = 300, max: number = 2000): Promise<void> {
  const delay = getRandomDelay(min, max);
  return new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Cipher suite rotation to avoid TLS fingerprinting
 */
function getRandomCipherSuite(): string {
  const cipherSuites = [
    // Modern cipher suites (prioritize)
    'TLS_AES_128_GCM_SHA256:TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384',
    'TLS_AES_256_GCM_SHA384:TLS_AES_128_GCM_SHA256:TLS_CHACHA20_POLY1305_SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-GCM-SHA256',
    'TLS_CHACHA20_POLY1305_SHA256:TLS_AES_128_GCM_SHA256:TLS_AES_256_GCM_SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305',
    // Chrome-like
    'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305',
    // Firefox-like
    'TLS_AES_128_GCM_SHA256:TLS_CHACHA20_POLY1305_SHA256:TLS_AES_256_GCM_SHA384:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256'
  ];

  return cipherSuites[Math.floor(Math.random() * cipherSuites.length)];
}

/**
 * Create HTTPS agent with randomized TLS settings
 */
function createRandomizedHttpsAgent(): https.Agent {
  return new https.Agent({
    minVersion: 'TLSv1.2',
    maxVersion: 'TLSv1.3',
    ciphers: getRandomCipherSuite(),
    honorCipherOrder: Math.random() > 0.5,
    rejectUnauthorized: process.env.NODE_ENV === 'production',
    keepAlive: true,
    keepAliveMsecs: 1000,
    maxSockets: 10
  });
}

/**
 * Extract CSRF token from Willhaben by intercepting API requests made during page load.
 * Willhaben's frontend sends the x-bbx-csrf-token header with XHR requests to its
 * search API. We intercept these requests to capture the token.
 */
export async function extractCsrfToken(): Promise<string> {
  // Check cache first
  const now = Date.now();
  if (csrfTokenCache.token && (now - csrfTokenCache.timestamp) < CSRF_TOKEN_TTL) {
    console.log('Using cached CSRF token');
    return csrfTokenCache.token;
  }

  console.log('Extracting fresh CSRF token from Willhaben...');

  let browser: Browser | null = null;
  let context: BrowserContext | null = null;

  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 720 },
      locale: 'de-AT'
    });

    const page = await context.newPage();

    // Set up request interception BEFORE navigating
    let capturedToken: string | null = null;

    page.on('request', (request) => {
      const headers = request.headers();
      // Willhaben uses x-bbx-csrf-token in API calls
      const token = headers['x-bbx-csrf-token'] || headers['x-wh-csrf-token'];
      if (token && !capturedToken) {
        capturedToken = token;
        console.log('CSRF token captured from intercepted request');
      }
    });

    // Also intercept responses for Set-Cookie headers containing CSRF tokens
    page.on('response', async (response) => {
      if (capturedToken) return;
      try {
        const headers = response.headers();
        const setCookie = headers['set-cookie'] || '';
        const csrfMatch = setCookie.match(/(?:csrf|xsrf)[^=]*=([^;]+)/i);
        if (csrfMatch) {
          capturedToken = csrfMatch[1];
          console.log('CSRF token captured from response cookie');
        }
      } catch (_) {
        // ignore
      }
    });

    // Navigate to a real estate search page - this triggers API calls with the token
    await page.goto('https://www.willhaben.at/iad/immobilien/eigentumswohnung/eigentumswohnung-angebote', {
      waitUntil: 'networkidle',
      timeout: 45000
    });

    // If captured during page load, use it
    if (capturedToken) {
      csrfTokenCache = { token: capturedToken, timestamp: now };
      return capturedToken;
    }

    // Wait a bit longer for async API calls
    await page.waitForTimeout(3000);

    if (capturedToken) {
      csrfTokenCache = { token: capturedToken, timestamp: now };
      return capturedToken;
    }

    // Try scrolling to trigger lazy-loaded API calls
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(2000);

    if (capturedToken) {
      csrfTokenCache = { token: capturedToken, timestamp: now };
      return capturedToken;
    }

    // Try extracting from cookies as fallback
    const cookies = await context.cookies();
    const csrfCookie = cookies.find(c =>
      c.name.toLowerCase().includes('csrf') ||
      c.name.toLowerCase().includes('xsrf')
    );

    if (csrfCookie?.value) {
      csrfTokenCache = { token: csrfCookie.value, timestamp: now };
      console.log('CSRF token extracted from cookie: ' + csrfCookie.name);
      return csrfCookie.value;
    }

    // Try extracting from page JS variables (willhaben stores config in window objects)
    const jsToken = await page.evaluate(() => {
      // Check common JS variable locations
      const w = window as any;
      return w.__CSRF_TOKEN__ ||
             w.__BBX_CSRF__ ||
             w.willhabenConfig?.csrfToken ||
             w.__CONFIG__?.csrfToken ||
             w.__NEXT_DATA__?.props?.pageProps?.csrfToken ||
             null;
    });

    if (jsToken) {
      csrfTokenCache = { token: jsToken, timestamp: now };
      console.log('CSRF token extracted from JS variable');
      return jsToken;
    }

    // Check if the page actually loaded (bot detection may serve an empty/challenge page)
    const pageBodyLen = await page.evaluate(() => (document.body.textContent || '').length);
    const hasNextDiv = await page.evaluate(() => !!document.querySelector('#__next'));

    if (pageBodyLen < 2000 && !hasNextDiv) {
      throw new Error(
        'Willhaben bot protection is blocking this IP. ' +
        'Page did not render (body length: ' + pageBodyLen + ', #__next: false). ' +
        'Consider using a residential proxy or CAPTCHA-solving service.'
      );
    }

    throw new Error('Failed to extract CSRF token from Willhaben - page loaded but no token found');

  } catch (error: any) {
    console.error('Error extracting CSRF token:', error.message);
    throw error;
  } finally {
    if (context) await context.close();
    if (browser) await browser.close();
  }
}

/**
 * Fetch data from API with retry logic, exponential backoff, and rotating fingerprints
 */
export const fetchDataWithRetry = async (
  url: string,
  headers: Record<string, string>,
  retries: number = 3
): Promise<any> => {
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      // Add random delay before request (human-like behavior)
      if (attempt > 0) {
        await randomDelay(500, 2000);
      }

      const response = await axios.get(url, {
        headers,
        timeout: 30000, // 30 second timeout
        validateStatus: (status) => status < 500,
        httpsAgent: createRandomizedHttpsAgent() // Rotate TLS fingerprint
      });

      if (response.status === 200) {
        // Add small random delay after successful request
        await randomDelay(300, 800);
        return response.data;
      }

      // Handle specific error codes
      if (response.status === 404) {
        throw new Error(`Resource not found: ${url}`);
      }

      if (response.status === 429) {
        console.warn(`⚠️  Rate limited, backing off with jitter...`);
        const baseBackoff = 5000 * Math.pow(2, attempt);
        const jitter = Math.random() * 0.3 * baseBackoff; // 30% jitter
        const backoffMs = Math.min(baseBackoff + jitter, 30000);
        console.log(`   ⏳ Waiting ${(backoffMs / 1000).toFixed(2)}s before retry...`);
        await delay(backoffMs);
        continue;
      }

      throw new Error(`HTTP ${response.status}: ${response.statusText}`);

    } catch (error) {
      const axiosError = error as AxiosError;

      // Don't retry on 4xx errors (except 429)
      if (
        axiosError.response?.status &&
        axiosError.response.status >= 400 &&
        axiosError.response.status < 500 &&
        axiosError.response.status !== 429
      ) {
        throw error;
      }

      // On last attempt, throw the error
      if (attempt === retries - 1) {
        throw error;
      }

      // Exponential backoff with random jitter
      const baseDelay = 1000 * Math.pow(2, attempt);
      const jitter = Math.random() * 1000;
      const delayMs = Math.min(baseDelay + jitter, 10000);
      console.log(`🔄 Retrying request (${attempt + 1}/${retries}) in ${(delayMs / 1000).toFixed(2)}s: ${url}`);
      await delay(delayMs);
    }
  }
};

/**
 * Fetch listing detail from Willhaben API
 */
export const fetchListingDetail = async (
  listingId: string,
  csrfToken: string,
  userAgent: string
): Promise<any> => {
  const url = `https://www.willhaben.at/webapi/iad/search/atz/detail/${listingId}`;
  const headers = {
    'User-Agent': userAgent,
    'x-bbx-csrf-token': csrfToken,
    'x-wh-client': 'api@willhaben.at;responsive_web;server;1.0.0;desktop',
    'Accept': 'application/json',
    'Referer': 'https://www.willhaben.at/iad/immobilien/eigentumswohnung/eigentumswohnung-angebote'
  };

  return fetchDataWithRetry(url, headers, 3);
};

/**
 * Fetch search results from Willhaben API with pagination
 * Processes each page through the provided callback
 */
export const fetchSearchResults = async (
  csrfToken: string,
  userAgent: string,
  rowsPerPage: number,
  processPage: (listings: any[], pageNumber: number) => Promise<void>
): Promise<number> => {
  let page = 1;
  let totalProcessed = 0;
  const maxPages = 1000; // Reasonable limit

  // Try both API URL patterns - the SEO endpoint often works without CSRF
  const getSearchUrl = (pageNum: number) => {
    if (csrfToken === 'no-csrf-required') {
      return `https://www.willhaben.at/webapi/iad/search/atz/seo/immobilien/eigentumswohnung/eigentumswohnung-angebote?rows=${rowsPerPage}&page=${pageNum}`;
    }
    return `https://www.willhaben.at/webapi/iad/search/atz/seo/immobilien/eigentumswohnung/eigentumswohnung-angebote?rows=${rowsPerPage}&page=${pageNum}`;
  };

  while (page <= maxPages) {
    try {
      const url = getSearchUrl(page);

      const headers: Record<string, string> = {
        'User-Agent': userAgent,
        'x-wh-client': 'api@willhaben.at;responsive_web;server;1.0.0;desktop',
        'Accept': 'application/json',
        'Referer': 'https://www.willhaben.at/iad/immobilien/eigentumswohnung/eigentumswohnung-angebote',
        'Cache-Control': 'no-cache'
      };

      // Only include CSRF header if we actually have a token
      if (csrfToken && csrfToken !== 'no-csrf-required') {
        headers['x-bbx-csrf-token'] = csrfToken;
      }

      const data = await fetchDataWithRetry(url, headers, 3);

      const listings = data.advertSummary || [];
      if (listings.length === 0) {
        break; // No more results
      }

      await processPage(listings, page);

      totalProcessed += listings.length;

      // If we got less than requested, we're at the end
      if (listings.length < rowsPerPage) {
        break;
      }

      // Rate limiting with human-like random delays between pages
      const pageDelay = getRandomDelay(500, 2500);
      console.log(`   ⏳ Waiting ${(pageDelay / 1000).toFixed(2)}s before next page...`);
      await new Promise(resolve => setTimeout(resolve, pageDelay));

      page++;

      // Occasional longer pause (simulate human behavior - checking listings, reading details)
      if (page > 0 && page % 5 === 0) {
        const longPause = getRandomDelay(3000, 6000);
        console.log(`   ☕ Taking a break (${(longPause / 1000).toFixed(1)}s) after ${page} pages...`);
        await new Promise(resolve => setTimeout(resolve, longPause));
      }
    } catch (error: any) {
      console.error(`Error fetching page ${page}:`, error.message);

      // If CSRF token expired, try to refresh it
      if (error.response?.status === 403 || error.response?.status === 401) {
        console.log('CSRF token may have expired, attempting to refresh...');
        csrfTokenCache.token = null; // Clear cache
        const newToken = await extractCsrfToken();
        csrfToken = newToken;
        // Retry the same page with new token
        continue;
      }

      break; // Stop processing on other errors
    }
  }

  return totalProcessed;
};
