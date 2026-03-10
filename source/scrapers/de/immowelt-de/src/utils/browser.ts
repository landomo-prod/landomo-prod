import { Browser, BrowserContext, Page, chromium } from 'playwright';
import { getRandomUserAgent, getRandomAcceptLanguage, getImmoweltHeaders } from './userAgents';

/**
 * Browser utilities for Playwright-based scraping with anti-detection features
 */

export interface BrowserOptions {
  headless?: boolean;
  userAgent?: string;
  timeout?: number;
}

/**
 * Launch a browser instance with stealth settings
 */
export async function launchBrowser(options: BrowserOptions = {}): Promise<Browser> {
  const {
    headless = true,
    userAgent = getRandomUserAgent(),
    timeout = 60000 // Increased from 30s to 60s to prevent premature timeouts
  } = options;

  const browser = await chromium.launch({
    headless,
    timeout,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process'
    ]
  });

  return browser;
}

/**
 * Create a new browser context with stealth settings
 */
export async function createContext(
  browser: Browser,
  options: BrowserOptions = {}
): Promise<BrowserContext> {
  const { userAgent = getRandomUserAgent() } = options;

  // Get rotating headers
  const headers = getImmoweltHeaders();

  const context = await browser.newContext({
    userAgent,
    viewport: { width: 1920, height: 1080 },
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    extraHTTPHeaders: headers
  });

  // Add stealth scripts to avoid detection
  await context.addInitScript(() => {
    // Overwrite the navigator.webdriver property
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined
    });

    // Overwrite the navigator.plugins to make it look real
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5]
    });

    // Overwrite the navigator.languages property
    Object.defineProperty(navigator, 'languages', {
      get: () => ['de-DE', 'de', 'en']
    });

    // Remove automation flags
    delete (window as any).cdc_adoQpoasnfa76pfcZLmcfl_Array;
    delete (window as any).cdc_adoQpoasnfa76pfcZLmcfl_Promise;
    delete (window as any).cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
  });

  return context;
}

/**
 * Navigate to a page with retry logic
 */
export async function navigateWithRetry(
  page: Page,
  url: string,
  maxRetries: number = 3,
  timeout: number = 60000 // Increased from 30s to 60s
): Promise<void> {
  let lastError: Error | null = null;

  for (let i = 0; i < maxRetries; i++) {
    try {
      // Check if page is still attached before navigation
      if (page.isClosed()) {
        throw new Error('Page is closed');
      }

      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout
      });
      return;
    } catch (error: any) {
      lastError = error;
      console.log(`   ⚠️  Navigation attempt ${i + 1}/${maxRetries} failed: ${error.message}`);

      // Don't retry if page/context/browser is closed
      if (error.message.includes('closed') || error.message.includes('detached')) {
        throw error;
      }

      if (i < maxRetries - 1) {
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
      }
    }
  }

  throw lastError || new Error('Navigation failed after retries');
}

/**
 * Wait for selector with timeout
 */
export async function waitForSelector(
  page: Page,
  selector: string,
  timeout: number = 10000
): Promise<boolean> {
  try {
    await page.waitForSelector(selector, { timeout });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Extract __NEXT_DATA__ from Next.js pages
 */
export async function extractNextData(page: Page): Promise<any | null> {
  try {
    const nextData = await page.evaluate(() => {
      const scriptTag = document.getElementById('__NEXT_DATA__');
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
 * Handle cookie consent banners
 */
export async function handleCookieConsent(page: Page): Promise<void> {
  try {
    // Common consent button selectors for German sites
    const consentSelectors = [
      'button[data-testid="uc-accept-all-button"]',
      'button[id*="accept"]',
      'button[class*="accept"]',
      'button[class*="consent"]',
      'button:has-text("Akzeptieren")',
      'button:has-text("Alle akzeptieren")',
      'button:has-text("Einverstanden")',
      'button:has-text("Zustimmen")',
      '.consent-accept',
      '#didomi-notice-agree-button',
      '.didomi-button-highlight'
    ];

    for (const selector of consentSelectors) {
      try {
        const button = await page.$(selector);
        if (button) {
          console.log(`   ✓ Found consent button: ${selector}`);
          await button.click();
          await page.waitForTimeout(1000);
          return;
        }
      } catch (e) {
        // Continue to next selector
      }
    }

    console.log('   ℹ️  No consent banner detected');
  } catch (error) {
    console.log('   ⚠️  Error handling consent:', error);
  }
}

/**
 * Random delay to simulate human behavior
 */
export async function randomDelay(minMs: number = 500, maxMs: number = 2000): Promise<void> {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  await new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Get random delay value (human-like behavior)
 */
export function getRandomDelay(min: number = 300, max: number = 2000): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Scroll page to load lazy-loaded content
 */
export async function scrollPage(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      let totalHeight = 0;
      const distance = 100;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  });
}

/**
 * Backward compatibility alias
 */
export async function launchStealthBrowser(options: BrowserOptions = {}): Promise<Browser> {
  return launchBrowser(options);
}

/**
 * Backward compatibility alias
 */
export async function createStealthContext(
  browser: Browser,
  options: BrowserOptions = {}
): Promise<BrowserContext> {
  return createContext(browser, options);
}

/**
 * Backward compatibility alias
 */
export async function naturalScroll(page: Page): Promise<void> {
  return scrollPage(page);
}
