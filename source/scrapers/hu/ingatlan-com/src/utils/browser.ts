import { Browser, BrowserContext, Page, chromium } from 'playwright';
import { getRandomUserAgent } from './userAgents';

/**
 * Browser utilities for Playwright-based scraping with anti-detection features
 * Based on working German scraper implementation
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
    timeout = 60000
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
export async function createStealthContext(
  browser: Browser,
  options: BrowserOptions = {}
): Promise<BrowserContext> {
  const { userAgent = getRandomUserAgent() } = options;

  const context = await browser.newContext({
    userAgent,
    viewport: { width: 1920, height: 1080 },
    locale: 'hu-HU',
    timezoneId: 'Europe/Budapest',
    extraHTTPHeaders: {
      'Accept-Language': 'hu-HU,hu;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1'
    }
  });

  // Add stealth scripts to avoid detection
  await context.addInitScript(() => {
    // Override navigator.webdriver (CRITICAL for anti-bot bypass)
    Object.defineProperty(Object.getPrototypeOf(navigator), 'webdriver', {
      get: () => undefined
    });

    // Override plugins to look real
    Object.defineProperty(Object.getPrototypeOf(navigator), 'plugins', {
      get: () => [1, 2, 3, 4, 5]
    });

    // Override languages
    Object.defineProperty(Object.getPrototypeOf(navigator), 'languages', {
      get: () => ['hu-HU', 'hu', 'en-US', 'en']
    });

    // Add Chrome runtime
    (window as any).chrome = {
      runtime: {}
    };

    // Remove automation flags
    delete (window as any).cdc_adoQpoasnfa76pfcZLmcfl_Array;
    delete (window as any).cdc_adoQpoasnfa76pfcZLmcfl_Promise;
    delete (window as any).cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
  });

  return context;
}

/**
 * Navigate to a page with retry logic and Cloudflare challenge handling
 */
export async function navigateWithRetry(
  page: Page,
  url: string,
  maxRetries: number = 3,
  timeout: number = 60000
): Promise<void> {
  let lastError: Error | null = null;

  for (let i = 0; i < maxRetries; i++) {
    try {
      // Navigate to page
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout
      });

      // Check if we hit a Cloudflare challenge page
      const isChallengePage = await page.evaluate(() => {
        return document.title.includes('pillanat') ||
               document.title.includes('moment') ||
               document.body.innerHTML.includes('cloudflare') ||
               document.body.innerHTML.includes('turnstile') ||
               document.body.innerHTML.includes('challenge-platform');
      });

      if (isChallengePage) {
        console.log(`   🔐 Cloudflare challenge detected, waiting for completion...`);

        // Wait longer for challenge to process
        await page.waitForTimeout(8000);

        // Try waiting for navigation with longer timeout
        try {
          await Promise.race([
            page.waitForNavigation({ waitUntil: 'networkidle', timeout: 45000 }),
            page.waitForFunction(() => {
              return !document.title.includes('pillanat') && !document.title.includes('moment');
            }, { timeout: 45000 })
          ]);
          console.log(`   ✅ Challenge completed`);
        } catch (navError) {
          console.log(`   ⏳ Extended wait for content...`);
          await page.waitForTimeout(10000);
        }

        // Final check - if still on challenge page, this might not work
        const finalCheck = await page.evaluate(() => {
          const title = document.title;
          const bodyText = document.body.innerText || '';
          return {
            title,
            hasListings: bodyText.length > 50000, // Real page should have lots of content
            hasBudapest: bodyText.includes('Budapest'),
            stillChallenge: title.includes('pillanat') || title.includes('moment')
          };
        });

        console.log(`   📊 Page check: title="${finalCheck.title}", content=${finalCheck.hasListings}, hasBudapest=${finalCheck.hasBudapest}`);

        if (finalCheck.stillChallenge) {
          throw new Error('Cloudflare challenge did not complete - site may require manual interaction');
        }
      }

      return;
    } catch (error: any) {
      lastError = error;
      console.log(`   ⚠️  Navigation attempt ${i + 1}/${maxRetries} failed: ${error.message}`);

      if (i < maxRetries - 1) {
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
      }
    }
  }

  throw lastError || new Error('Navigation failed after retries');
}

/**
 * Handle cookie consent banners (Hungarian sites)
 */
export async function handleCookieConsent(page: Page): Promise<void> {
  try {
    // Common consent button selectors for Hungarian sites
    const consentSelectors = [
      'button:has-text("Elfogadom")',  // "Accept" in Hungarian
      'button:has-text("Egyetértek")',  // "Agree" in Hungarian
      'button:has-text("Rendben")',  // "OK" in Hungarian
      'button[data-testid="uc-accept-all-button"]',
      'button[id*="accept"]',
      'button[class*="accept"]',
      'button[class*="consent"]',
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
 * Rate limiting with jitter - longer pause every N pages
 */
export async function rateLimitedDelay(pageNumber: number, pagesInterval: number = 5): Promise<void> {
  // Base delay between requests
  const baseDelay = getRandomDelay(1000, 3000);
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
 * Extract __NEXT_DATA__ from Next.js pages (if applicable)
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
