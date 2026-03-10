/**
 * Cookie Extraction Script
 *
 * Run this manually to extract valid cookies from immobilienscout24.de
 * These cookies can then be used by the scraper
 *
 * Usage:
 *   1. Run: npx ts-node extract-cookies.ts
 *   2. Browser will open - wait for page to load completely
 *   3. Cookies will be saved to cookies.json
 *   4. Use these cookies in the scraper
 */

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as fs from 'fs';

puppeteer.use(StealthPlugin());

async function extractCookies() {
  console.log('🍪 Cookie Extraction Tool\n');
  console.log('This will open a browser and extract valid cookies from immobilienscout24.de');
  console.log('The browser will stay open for 30 seconds - you can manually interact if needed\n');

  const browser = await puppeteer.launch({
    headless: false, // Show browser so you can see what's happening
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--window-size=1920,1080',
    ],
  });

  const page = await browser.newPage();

  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );

  console.log('📍 Navigating to immobilienscout24.de...');

  await page.goto('https://www.immobilienscout24.de/Suche/de/deutschland/wohnung-mieten', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });

  console.log('✅ Page loaded');
  console.log('\n⏳ Waiting 30 seconds...');
  console.log('   (If you see a CAPTCHA, please solve it manually)');
  console.log('   (The page should show listings, not "Ich bin kein Roboter")\n');

  // Wait 30 seconds to allow:
  // 1. Page to fully load
  // 2. Any challenges to be presented
  // 3. User to manually solve if needed
  await new Promise(resolve => setTimeout(resolve, 30000));

  // Check if blocked
  const title = await page.title();
  const content = await page.content();

  if (title.includes('Ich bin kein Roboter') || content.includes('Challenge')) {
    console.error('❌ Page is still blocked by anti-bot');
    console.error('   Try again, or solve the challenge manually');
    await browser.close();
    process.exit(1);
  }

  // Extract cookies
  const cookies = await page.cookies();

  console.log(`✅ Extracted ${cookies.length} cookies`);

  // Save to file
  const cookieData = {
    extractedAt: new Date().toISOString(),
    url: page.url(),
    cookies: cookies,
    // Also save as simple key-value for easy use
    cookieString: cookies.map(c => `${c.name}=${c.value}`).join('; ')
  };

  fs.writeFileSync('cookies.json', JSON.stringify(cookieData, null, 2));

  console.log('💾 Saved to cookies.json');
  console.log('\nCookie summary:');
  cookies.forEach(c => {
    console.log(`   - ${c.name}: ${c.value.substring(0, 20)}...`);
  });

  console.log('\n✅ Done! You can now use these cookies in the scraper');
  console.log('   Note: Cookies may expire after 24-48 hours');

  await browser.close();
}

extractCookies().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
