import { Browser, BrowserContext, Page, chromium } from 'playwright';
import { getRandomUserAgent, getRandomAcceptLanguage } from './userAgents';

/**
 * Browser utilities with Cloudflare bypass capabilities and anti-detection features
 */

export interface BrowserOptions {
  headless?: boolean;
  timeout?: number;
  useStealthMode?: boolean;
}

/**
 * Rate limiting tracker
 */
let lastRequestTime = 0;
let requestCount = 0;

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
 * Rate limiting with jitter to avoid detection
 */
async function applyRateLimit(): Promise<void> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  const baseDelay = 300;

  // Ensure minimum delay between requests
  if (timeSinceLastRequest < baseDelay) {
    await new Promise(resolve => setTimeout(resolve, baseDelay - timeSinceLastRequest));
  }

  // Add random jitter (300ms-2000ms)
  await randomDelay(300, 2000);

  requestCount++;
  lastRequestTime = Date.now();

  // Occasional longer pause every 5 requests (simulate human behavior)
  if (requestCount > 0 && requestCount % 5 === 0) {
    const longPause = getRandomDelay(3000, 6000);
    console.log(`   ☕ Taking a break (${(longPause / 1000).toFixed(1)}s) after ${requestCount} requests...`);
    await new Promise(resolve => setTimeout(resolve, longPause));
  }
}

/**
 * Launch browser with stealth mode and Cloudflare bypass settings
 */
export async function launchStealthBrowser(options: BrowserOptions = {}): Promise<Browser> {
  const {
    headless = true,
    useStealthMode = true
  } = options;

  const launchOptions: any = {
    headless,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-site-isolation-trials',
      // Additional Cloudflare bypass
      '--disable-blink-features=AutomationControlled',
      '--exclude-switches=enable-automation',
      '--disable-extensions',
      '--disable-plugins-discovery',
      '--start-maximized'
    ]
  };

  const browser = await chromium.launch(launchOptions);

  return browser;
}

/**
 * Create stealth context with Austrian locale and anti-detection measures
 * Headers are rotated on each context creation
 */
export async function createStealthContext(browser: Browser): Promise<BrowserContext> {
  // Rotate user agent and headers for each context
  const userAgent = getRandomUserAgent();
  const acceptLanguage = getRandomAcceptLanguage();

  const context = await browser.newContext({
    userAgent,
    viewport: { width: 1920, height: 1080 },
    locale: 'de-AT',
    timezoneId: 'Europe/Vienna',
    permissions: ['geolocation'],
    geolocation: { latitude: 48.2082, longitude: 16.3738 }, // Vienna coordinates
    colorScheme: 'light',
    deviceScaleFactor: 1,
    hasTouch: false,
    isMobile: false,
    javaScriptEnabled: true,
    extraHTTPHeaders: {
      'Accept-Language': acceptLanguage,
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-User': '?1',
      'Sec-Fetch-Dest': 'document',
      'Upgrade-Insecure-Requests': '1',
      'DNT': '1',
      'Cache-Control': 'max-age=0'
    }
  });

  return context;
}

/**
 * Apply anti-detection scripts to page
 */
export async function applyStealthScripts(page: Page): Promise<void> {
  // Override navigator.webdriver
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined
    });
  });

  // Override plugins
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5]
    });
  });

  // Override languages
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'languages', {
      get: () => ['de-AT', 'de', 'en-US', 'en']
    });
  });

  // Chrome specific
  await page.addInitScript(() => {
    (window as any).chrome = {
      runtime: {}
    };
  });

  // Permissions
  await page.addInitScript(() => {
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters: any) => (
      parameters.name === 'notifications' ?
        Promise.resolve({ state: Notification.permission } as PermissionStatus) :
        originalQuery(parameters)
    );
  });
}

/**
 * Wait for Cloudflare challenge to complete
 */
export async function waitForCloudflareChallenge(page: Page, timeout: number = 30000): Promise<boolean> {
  try {
    console.log('   ⏳ Checking for Cloudflare challenge...');

    // Wait for either challenge to appear or page to load normally
    const challengeSelector = '#challenge-running, .cf-browser-verification, #cf-wrapper';

    // Check if challenge exists
    const hasChallenge = await page.$(challengeSelector).catch(() => null);

    if (!hasChallenge) {
      console.log('   ✓ No Cloudflare challenge detected');
      return true;
    }

    console.log('   🔄 Cloudflare challenge detected, waiting for completion...');

    // Wait for challenge to disappear
    await page.waitForSelector(challengeSelector, { state: 'hidden', timeout });

    // Additional wait for page to stabilize
    await page.waitForLoadState('networkidle', { timeout: 10000 });

    console.log('   ✓ Cloudflare challenge completed');
    return true;
  } catch (error) {
    console.warn('   ⚠️  Cloudflare challenge timeout - attempting to continue');
    return false;
  }
}

/**
 * Navigate to URL with Cloudflare bypass and rate limiting
 */
export async function navigateWithCloudflareBypass(
  page: Page,
  url: string,
  options: { timeout?: number; waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' } = {}
): Promise<void> {
  const { timeout = 30000, waitUntil = 'networkidle' } = options;

  // Apply rate limiting before navigation
  await applyRateLimit();

  // Apply stealth scripts before navigation
  await applyStealthScripts(page);

  // Navigate
  await page.goto(url, { waitUntil, timeout });

  // Wait for Cloudflare challenge if present
  await waitForCloudflareChallenge(page, timeout);

  // Additional random delay to appear more human-like
  await randomDelay(1000, 3000);
}

/**
 * Navigate with header rotation - creates new context with rotated headers
 */
export async function navigateWithRotatedHeaders(
  browser: Browser,
  url: string,
  options: { timeout?: number; waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' } = {}
): Promise<{ context: BrowserContext; page: Page }> {
  // Create new context with rotated headers
  const context = await createStealthContext(browser);
  const page = await context.newPage();

  // Navigate with anti-detection
  await navigateWithCloudflareBypass(page, url, options);

  return { context, page };
}

/**
 * Reset rate limiting counter (useful for testing or after long pauses)
 */
export function resetRateLimiting(): void {
  lastRequestTime = 0;
  requestCount = 0;
}
