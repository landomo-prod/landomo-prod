/**
 * Adresowo.pl API Discovery Script
 * Uses Playwright to capture network requests and discover API endpoints
 */

import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

interface NetworkLog {
  timestamp: string;
  method: string;
  url: string;
  status?: number;
  statusText?: string;
  requestHeaders?: any;
  requestBody?: any;
  responseHeaders?: any;
  responseBody?: any;
}

async function discoverAPI() {
  const networkLogs: NetworkLog[] = [];

  console.log('🔍 Starting Adresowo.pl API discovery...\n');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 500
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'pl-PL'
  });

  const page = await context.newPage();

  // Listen to all network requests
  page.on('request', request => {
    const log: NetworkLog = {
      timestamp: new Date().toISOString(),
      method: request.method(),
      url: request.url(),
      requestHeaders: request.headers()
    };

    // Capture request body for POST requests
    if (request.method() === 'POST') {
      try {
        log.requestBody = request.postData();
      } catch (e) {
        // Some requests may not have postData
      }
    }

    // Log interesting API calls
    if (request.url().includes('/api/') ||
        request.url().includes('adresowo.pl') && request.resourceType() === 'xhr') {
      console.log(`📤 ${request.method()} ${request.url()}`);
      networkLogs.push(log);
    }
  });

  // Listen to all responses
  page.on('response', async response => {
    const url = response.url();

    // Only log API responses
    if (url.includes('/api/') ||
        (url.includes('adresowo.pl') && response.request().resourceType() === 'xhr')) {
      console.log(`📥 ${response.status()} ${url}`);

      // Find the matching request log
      const log = networkLogs.find(l => l.url === url && !l.status);
      if (log) {
        log.status = response.status();
        log.statusText = response.statusText();
        log.responseHeaders = response.headers();

        try {
          const contentType = response.headers()['content-type'] || '';
          if (contentType.includes('application/json')) {
            log.responseBody = await response.json();
            console.log(`   ✅ JSON response captured (${JSON.stringify(log.responseBody).length} chars)`);
          } else {
            const text = await response.text();
            log.responseBody = text.substring(0, 1000); // First 1000 chars
            console.log(`   ⚠️  Non-JSON response (${text.length} chars)`);
          }
        } catch (e: any) {
          console.log(`   ❌ Failed to parse response: ${e.message}`);
        }
      }
    }
  });

  try {
    // Step 1: Visit homepage
    console.log('\n📍 Step 1: Loading homepage...');
    await page.goto('https://www.adresowo.pl', {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    await page.waitForTimeout(2000);

    // Step 2: Search for apartments in Warsaw
    console.log('\n📍 Step 2: Searching for apartments in Warsaw...');

    // Click on "Mieszkania na sprzedaż" link
    const apartmentLink = await page.locator('a[href*="mieszkania"]').first();
    if (await apartmentLink.count() > 0) {
      await apartmentLink.click();
      await page.waitForTimeout(3000);
      console.log('   Clicked apartment link');
    } else {
      // Alternative: Navigate directly to Warsaw apartments
      console.log('   Direct navigation to Warsaw apartments');
      await page.goto('https://www.adresowo.pl/mieszkania/warszawa/', {
        waitUntil: 'networkidle',
        timeout: 30000
      });
    }

    await page.waitForTimeout(3000);

    // Step 3: Try to load more results or paginate
    console.log('\n📍 Step 3: Looking for pagination or load more...');

    // Look for pagination buttons
    const nextButton = page.locator('button:has-text("Następna"), a:has-text("Następna"), a:has-text("›"), button:has-text("›")');
    if (await nextButton.count() > 0) {
      console.log('   Found pagination button, clicking...');
      await nextButton.first().click();
      await page.waitForTimeout(3000);
    }

    // Step 4: Click on a listing detail
    console.log('\n📍 Step 4: Opening a listing detail...');
    const listingLink = page.locator('a[href*="/ogloszenie/"], article a, .listing a').first();
    if (await listingLink.count() > 0) {
      await listingLink.click();
      await page.waitForTimeout(3000);
      console.log('   Opened listing detail');
    }

    // Step 5: Try different cities
    console.log('\n📍 Step 5: Testing other cities...');
    await page.goto('https://www.adresowo.pl/mieszkania/krakow/', {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    await page.waitForTimeout(2000);

    console.log('\n✅ API discovery complete!\n');

  } catch (error: any) {
    console.error('❌ Error during discovery:', error.message);
  }

  // Save network logs
  const outputPath = path.join(__dirname, 'network-logs.json');
  fs.writeFileSync(outputPath, JSON.stringify(networkLogs, null, 2));
  console.log(`📁 Network logs saved to: ${outputPath}`);
  console.log(`📊 Total API calls captured: ${networkLogs.length}`);

  // Generate summary
  const apiEndpoints = [...new Set(networkLogs.map(l => l.url))];
  const summaryPath = path.join(__dirname, 'api-summary.txt');
  const summary = [
    'Adresowo.pl API Discovery Summary',
    '='.repeat(50),
    '',
    `Total API calls: ${networkLogs.length}`,
    `Unique endpoints: ${apiEndpoints.length}`,
    '',
    'Discovered Endpoints:',
    '---',
    ...apiEndpoints.map((url, i) => `${i + 1}. ${url}`),
    '',
    'Next Steps:',
    '---',
    '1. Review network-logs.json for API structure',
    '2. Identify listing search endpoint',
    '3. Identify listing detail endpoint',
    '4. Document request/response formats',
    '5. Implement scraper with discovered APIs'
  ].join('\n');

  fs.writeFileSync(summaryPath, summary);
  console.log(`📄 Summary saved to: ${summaryPath}`);

  await browser.close();
}

// Run discovery
discoverAPI().catch(console.error);
