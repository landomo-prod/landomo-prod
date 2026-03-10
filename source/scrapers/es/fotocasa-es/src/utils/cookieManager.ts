/**
 * CloudFront cookie manager using Playwright
 * Visits the site with a real browser to pass CF JS challenge and cache cookies
 */

import { chromium, Browser, BrowserContext } from 'playwright';

const FOTOCASA_URL = 'https://www.fotocasa.es/';
const COOKIE_TTL_MS = 30 * 60 * 1000; // 30 minutes

// Fixed UA that matches what Playwright/Chromium sends
export const PLAYWRIGHT_USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

interface CookieCache {
  cookieHeader: string;
  expiresAt: number;
}

let cache: CookieCache | null = null;
let refreshPromise: Promise<string> | null = null;

export async function getCFCookies(): Promise<string> {
  const now = Date.now();

  if (cache && cache.expiresAt > now) {
    return cache.cookieHeader;
  }

  // Deduplicate concurrent calls
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    console.log(JSON.stringify({ level: 'info', service: 'fotocasa-scraper', msg: 'Launching Playwright to get CF cookies' }));

    let browser: Browser | null = null;
    try {
      browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
      const context: BrowserContext = await browser.newContext({
        userAgent: PLAYWRIGHT_USER_AGENT,
        locale: 'es-ES',
        extraHTTPHeaders: { 'Accept-Language': 'es-ES,es;q=0.9' },
      });

      const page = await context.newPage();

      // Visit homepage and wait for CF challenge to resolve (network idle)
      await page.goto(FOTOCASA_URL, { waitUntil: 'networkidle', timeout: 30000 });

      // Also hit the API base to get any API-specific cookies
      await page.goto('https://web.gw.fotocasa.es/', { waitUntil: 'load', timeout: 15000 }).catch(() => {});
      await page.goto(FOTOCASA_URL, { waitUntil: 'networkidle', timeout: 15000 });

      const cookies = await context.cookies();
      const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');

      const cfCookies = cookies.filter(c => c.name.startsWith('cf_') || c.name === '__cf_bm');
      console.log(JSON.stringify({
        level: 'info',
        service: 'fotocasa-scraper',
        msg: 'CF cookies obtained',
        cfCookieNames: cfCookies.map(c => c.name),
        totalCookies: cookies.length,
      }));

      cache = { cookieHeader, expiresAt: Date.now() + COOKIE_TTL_MS };
      return cookieHeader;
    } finally {
      if (browser) await browser.close();
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export function invalidateCFCookies(): void {
  cache = null;
}
