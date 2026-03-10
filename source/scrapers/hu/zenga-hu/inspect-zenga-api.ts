/**
 * Inspect Zenga.hu to find actual API endpoints
 */
import { chromium } from 'playwright';

async function inspectZengaAPI() {
  console.log('🔍 Inspecting Zenga.hu API calls...\n');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Track all API requests
  const apiCalls: any[] = [];
  
  page.on('request', request => {
    const url = request.url();
    if (url.includes('/api/') || url.includes('zenga.hu')) {
      apiCalls.push({
        method: request.method(),
        url: url,
        headers: request.headers(),
        postData: request.postData()
      });
    }
  });
  
  page.on('response', async response => {
    const url = response.url();
    if (url.includes('/api/')) {
      try {
        const body = await response.text();
        console.log(`\n📡 API Call: ${response.request().method()} ${url}`);
        console.log(`   Status: ${response.status()}`);
        console.log(`   Response preview: ${body.substring(0, 200)}...`);
      } catch (e) {
        // Ignore errors
      }
    }
  });
  
  // Navigate to Budapest apartments search
  console.log('🌐 Loading Zenga.hu Budapest apartments search...\n');
  await page.goto('https://www.zenga.hu/budapest+elado+lakas', { 
    waitUntil: 'networkidle',
    timeout: 30000 
  });
  
  await page.waitForTimeout(5000);
  
  // Try searching
  console.log('\n🔍 Checking for search results on page...\n');
  
  // Check if listings are visible
  const listingsVisible = await page.evaluate(() => {
    const listings = document.querySelectorAll('[class*="advert"], [class*="listing"], [class*="card"]');
    return {
      count: listings.length,
      selectors: Array.from(listings).slice(0, 3).map(el => ({
        className: el.className,
        text: el.textContent?.substring(0, 100)
      }))
    };
  });
  
  console.log('Listings found on page:', JSON.stringify(listingsVisible, null, 2));
  
  console.log('\n📋 API Calls captured:', apiCalls.length);
  
  // Save API calls to file
  const fs = require('fs');
  fs.writeFileSync('zenga-api-calls.json', JSON.stringify(apiCalls, null, 2));
  console.log('✅ API calls saved to zenga-api-calls.json');
  
  await page.waitForTimeout(5000);
  await browser.close();
}

inspectZengaAPI().catch(console.error);
