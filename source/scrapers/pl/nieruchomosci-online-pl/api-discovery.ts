/**
 * API Discovery Script for Nieruchomosci-Online.pl
 * Uses Playwright to capture network traffic and identify API endpoints
 */

import { chromium, Browser, Page } from 'playwright';
import * as fs from 'fs';

interface CapturedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  postData?: string;
  response?: {
    status: number;
    headers: Record<string, string>;
    body?: string;
  };
}

async function discoverAPI() {
  const capturedRequests: CapturedRequest[] = [];
  let browser: Browser | null = null;

  try {
    console.log('Launching browser...');
    browser = await chromium.launch({
      headless: false,
      slowMo: 500
    });

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'pl-PL',
      viewport: { width: 1920, height: 1080 }
    });

    const page = await context.newPage();

    // Capture all requests and responses
    page.on('request', request => {
      const url = request.url();

      // Filter for API-like requests
      if (url.includes('/api/') ||
          url.includes('.json') ||
          url.includes('/search') ||
          url.includes('/listing') ||
          url.includes('/properties') ||
          url.includes('/offer')) {

        const captured: CapturedRequest = {
          url: request.url(),
          method: request.method(),
          headers: request.headers(),
          postData: request.postData() || undefined
        };

        capturedRequests.push(captured);
        console.log(`📤 ${request.method()} ${url}`);
      }
    });

    page.on('response', async response => {
      const url = response.url();

      // Filter for API-like responses
      if (url.includes('/api/') ||
          url.includes('.json') ||
          url.includes('/search') ||
          url.includes('/listing') ||
          url.includes('/properties') ||
          url.includes('/offer')) {

        const request = capturedRequests.find(r => r.url === url && !r.response);

        if (request) {
          try {
            const body = await response.text();
            request.response = {
              status: response.status(),
              headers: response.headers(),
              body: body.substring(0, 5000) // First 5000 chars
            };
            console.log(`📥 ${response.status()} ${url}`);
          } catch (error) {
            console.log(`❌ Failed to capture response for ${url}:`, error);
          }
        }
      }
    });

    console.log('\n🔍 Navigating to Warsaw apartment search...');
    await page.goto('https://www.nieruchomosci-online.pl/szukaj.html?3,mieszkanie,sprzedaz,Warszawa', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    console.log('⏳ Waiting for content to load...');
    await page.waitForTimeout(3000);

    // Try to scroll to trigger lazy loading
    console.log('📜 Scrolling page...');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);

    // Try to navigate to page 2
    console.log('🔄 Looking for pagination...');
    const nextButton = await page.$('a[title*="strona"]');
    if (nextButton) {
      console.log('✅ Found pagination - clicking...');
      await nextButton.click();
      await page.waitForTimeout(3000);
    }

    // Try clicking a property to see detail page API calls
    console.log('🏠 Clicking first property listing...');
    const firstProperty = await page.$('a[href*="/nieruchomosci/"]');
    if (firstProperty) {
      await firstProperty.click();
      await page.waitForTimeout(3000);
    }

    console.log('\n📊 Captured Requests Summary:');
    console.log(`Total API-like requests: ${capturedRequests.length}`);

    // Save results
    const results = {
      timestamp: new Date().toISOString(),
      totalRequests: capturedRequests.length,
      requests: capturedRequests
    };

    fs.writeFileSync(
      '/Users/samuelseidel/Development/landomo-world/scrapers/Poland/nieruchomosci-online-pl/api-discovery-results.json',
      JSON.stringify(results, null, 2)
    );

    console.log('✅ Results saved to api-discovery-results.json');

    // Print summary
    console.log('\n📋 API Endpoints Found:');
    const uniqueUrls = [...new Set(capturedRequests.map(r => {
      const url = new URL(r.url);
      return `${r.method} ${url.pathname}`;
    }))];

    uniqueUrls.forEach(url => console.log(`  - ${url}`));

    console.log('\n⏸️  Browser will stay open for 10 seconds for manual inspection...');
    await page.waitForTimeout(10000);

  } catch (error) {
    console.error('❌ Error during API discovery:', error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run discovery
discoverAPI().catch(console.error);
