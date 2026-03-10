/**
 * Inspect Nehnuteľnosti.sk HTML structure
 */
import { chromium } from 'playwright';
import * as fs from 'fs';

async function inspect() {
  console.log('🔍 Inspecting Nehnuteľnosti.sk HTML structure...\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'sk-SK',
    timezoneId: 'Europe/Bratislava'
  });

  const page = await context.newPage();

  try {
    const url = 'https://www.nehnutelnosti.sk/bratislavsky-kraj/byty/predaj/';
    console.log(`Navigating to: ${url}\n`);

    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

    // Wait for content to load
    console.log('Waiting for content to load...');
    await page.waitForTimeout(5000);

    // Accept cookies
    try {
      await page.click('button:has-text("Prijať")', { timeout: 2000 });
      await page.waitForTimeout(1000);
      console.log('✅ Cookies accepted\n');
    } catch (e) {
      console.log('⚠️  No cookie button\n');
    }

    // Get full HTML
    const html = await page.content();
    fs.writeFileSync('nehnutelnosti-page.html', html);
    console.log('📄 HTML saved to nehnutelnosti-page.html\n');

    // Search for common patterns
    console.log('Analyzing HTML structure:');
    console.log('='.repeat(60));

    const patterns = [
      { name: '<article>', regex: /<article[\s>]/gi },
      { name: 'class="advertisement', regex: /class="[^"]*advertisement[^"]*"/gi },
      { name: 'class="listing', regex: /class="[^"]*listing[^"]*"/gi },
      { name: 'class="offer', regex: /class="[^"]*offer[^"]*"/gi },
      { name: 'class="card', regex: /class="[^"]*card[^"]*"/gi },
      { name: 'data-id=', regex: /data-id="[^"]+"/gi },
      { name: 'class="list', regex: /class="[^"]*list[^"]*"/gi },
      { name: 'href="/p/', regex: /href="\/p\/\d+"/gi }
    ];

    for (const pattern of patterns) {
      const matches = html.match(pattern.regex);
      if (matches && matches.length > 0) {
        console.log(`✓ ${pattern.name} → ${matches.length} matches`);
        console.log(`  Examples: ${matches.slice(0, 3).join(', ')}`);
      }
    }

    // Try to find listing links
    console.log('\n' + '='.repeat(60));
    console.log('Looking for listing links...\n');

    const links = await page.locator('a[href*="/p/"]').all();
    console.log(`Found ${links.length} links with /p/ pattern`);

    if (links.length > 0) {
      for (let i = 0; i < Math.min(3, links.length); i++) {
        const href = await links[i].getAttribute('href');
        const text = await links[i].textContent();
        console.log(`${i + 1}. ${href}`);
        console.log(`   Text: ${text?.substring(0, 60)}...`);
      }
    }

    // Check for specific div structures
    console.log('\n' + '='.repeat(60));
    console.log('Checking DOM structure...\n');

    const allDivs = await page.locator('div[class]').count();
    console.log(`Total divs with classes: ${allDivs}`);

    // Get first few div classes
    const divClasses = await page.evaluate(() => {
      const divs = Array.from(document.querySelectorAll('div[class]'));
      return divs.slice(0, 20).map(d => d.className).filter(c => c);
    });

    console.log('Sample div classes:');
    divClasses.forEach((cls, idx) => {
      console.log(`  ${idx + 1}. ${cls}`);
    });

    console.log('\n✅ Inspection complete');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

inspect();
