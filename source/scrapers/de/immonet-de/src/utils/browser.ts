import { Browser, BrowserContext, Page } from 'playwright';
import { getRandomUserAgent, getRandomAcceptLanguage } from './userAgents';

/**
 * Browser utility functions for Playwright
 */

export interface BrowserOptions {
  headless?: boolean;
  userAgent?: string;
  viewport?: { width: number; height: number };
  timeout?: number;
}

/**
 * Get random delay between requests (human-like behavior)
 */
export function getRandomDelay(min: number = 300, max: number = 2000): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Sleep for random duration with jitter
 */
export async function randomDelay(min: number = 300, max: number = 2000): Promise<void> {
  const delay = getRandomDelay(min, max);
  return new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Rate limiting with jitter - longer pause every N pages
 */
export async function rateLimitedDelay(pageNumber: number, pagesInterval: number = 5): Promise<void> {
  // Base delay between requests
  const baseDelay = getRandomDelay(500, 2500);
  console.log(`   ⏳ Waiting ${(baseDelay / 1000).toFixed(2)}s before next page...`);
  await new Promise(resolve => setTimeout(resolve, baseDelay));

  // Longer pause every N pages (simulate human behavior)
  if (pageNumber > 0 && pageNumber % pagesInterval === 0) {
    const longPause = getRandomDelay(3000, 6000);
    console.log(`   ☕ Taking a break (${(longPause / 1000).toFixed(1)}s) after ${pageNumber} pages...`);
    await new Promise(resolve => setTimeout(resolve, longPause));
  }
}

/**
 * Create a new browser context with stealth settings and rotation
 */
export async function createStealthContext(
  browser: Browser,
  options: BrowserOptions = {}
): Promise<BrowserContext> {
  // Rotate user agent on each context creation
  const userAgent = options.userAgent || getRandomUserAgent();

  const context = await browser.newContext({
    userAgent,
    viewport: options.viewport || { width: 1920, height: 1080 },
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    permissions: [],
    extraHTTPHeaders: {
      'Accept-Language': getRandomAcceptLanguage(),
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1'
    }
  });

  // Add stealth scripts to avoid detection
  await context.addInitScript(() => {
    // Override navigator.webdriver
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined
    });

    // Override plugins
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5]
    });

    // Override languages
    Object.defineProperty(navigator, 'languages', {
      get: () => ['de-DE', 'de', 'en-US', 'en']
    });

    // Chrome runtime
    (window as any).chrome = {
      runtime: {}
    };

    // Permissions
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters: any) => (
      parameters.name === 'notifications' ?
        Promise.resolve({ state: 'denied' } as PermissionStatus) :
        originalQuery(parameters)
    );
  });

  return context;
}

/**
 * Wait for network to be idle with retry logic
 */
export async function waitForNetworkIdle(
  page: Page,
  timeout: number = 30000,
  maxAttempts: number = 3
): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await page.waitForLoadState('networkidle', { timeout });
      return;
    } catch (error) {
      if (attempt === maxAttempts) {
        console.log(`   ⚠️  Network did not become idle after ${maxAttempts} attempts`);
        return;
      }
      await page.waitForTimeout(1000);
    }
  }
}

/**
 * Scroll page to load lazy-loaded content
 */
export async function scrollPage(page: Page, scrolls: number = 3): Promise<void> {
  // Scroll down incrementally to trigger lazy loading
  for (let i = 0; i < scrolls; i++) {
    await page.evaluate(() => window.scrollBy(0, window.innerHeight));
    await page.waitForTimeout(500);
  }

  // Scroll back to top
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
}

/**
 * Extract __NEXT_DATA__ JSON from page (common in AVIV Group sites)
 */
export async function extractNextData(page: Page): Promise<any | null> {
  try {
    const nextData = await page.evaluate(() => {
      const scriptTag = document.querySelector('#__NEXT_DATA__');
      if (scriptTag && scriptTag.textContent) {
        try {
          return JSON.parse(scriptTag.textContent);
        } catch (e) {
          return null;
        }
      }
      return null;
    });

    return nextData;
  } catch (error) {
    console.error('Error extracting __NEXT_DATA__:', error);
    return null;
  }
}

/**
 * Rotate headers on page for each request
 */
export async function rotateHeadersOnPage(page: Page): Promise<void> {
  await page.setExtraHTTPHeaders({
    'Accept-Language': getRandomAcceptLanguage(),
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'DNT': '1',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Cache-Control': 'max-age=0'
  });
}
