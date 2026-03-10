/**
 * Cookie Extraction with Rebrowser-Playwright
 *
 * Uses rebrowser-playwright which is specifically designed to bypass
 * browser fingerprinting and anti-bot detection
 */

import { chromium } from 'rebrowser-playwright';
import * as fs from 'fs';

async function extractCookiesWithRebrowser() {
  console.log('🍪 Cookie Extraction Tool (Rebrowser)\n');
  console.log('Using rebrowser-playwright for maximum stealth...\n');

  // Launch browser with rebrowser (automatically handles fingerprinting)
  const browser = await chromium.launch({
    headless: false, // Show browser
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ],
  });

  const context = await browser.newContext({
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();

  console.log('📍 Navigating to immobilienscout24.de...');

  await page.goto('https://www.immobilienscout24.de/Suche/de/deutschland/wohnung-mieten', {
    waitUntil: 'networkidle',
    timeout: 60000,
  });

  console.log('✅ Page loaded');
  console.log('\n⏳ Waiting 30 seconds for page to settle...');
  console.log('   Rebrowser should automatically handle anti-bot detection');
  console.log('   If you see a CAPTCHA, solve it manually\n');

  // Wait 30 seconds
  await page.waitForTimeout(30000);

  // Check if we're blocked
  const title = await page.title();
  const content = await page.content();

  console.log(`   Page title: "${title}"`);

  if (title.includes('Ich bin kein Roboter') || content.includes('Challenge')) {
    console.error('\n❌ Still blocked despite rebrowser');
    console.error('   This suggests very sophisticated detection');
    console.error('   Next steps:');
    console.error('   1. Try solving CAPTCHA manually during wait');
    console.error('   2. Use cloudflare-bypass service');
    console.error('   3. Try from different machine/network');
    await browser.close();
    process.exit(1);
  }

  // Extract cookies
  const cookies = await context.cookies();

  console.log(`\n✅ Extracted ${cookies.length} cookies`);

  // Save cookies
  const cookieData = {
    extractedAt: new Date().toISOString(),
    url: page.url(),
    cookies: cookies,
    cookieString: cookies.map(c => `${c.name}=${c.value}`).join('; '),
    method: 'rebrowser-playwright'
  };

  fs.writeFileSync('cookies.json', JSON.stringify(cookieData, null, 2));

  console.log('💾 Saved to cookies.json');
  console.log('\nCookie summary:');
  cookies.forEach(c => {
    console.log(`   - ${c.name}: ${c.value.substring(0, 20)}...`);
  });

  console.log('\n✅ Success! Cookies extracted with rebrowser');
  console.log('   Test with: npx ts-node test-v4.ts');

  await browser.close();
}

extractCookiesWithRebrowser().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
