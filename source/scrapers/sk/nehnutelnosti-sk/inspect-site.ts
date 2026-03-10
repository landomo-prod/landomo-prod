/**
 * Inspect Nehnuteľnosti.sk site structure to find correct selectors
 */
import { chromium } from 'playwright';

async function inspect() {
  console.log('🔍 Inspecting Nehnuteľnosti.sk site structure...\n');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'sk-SK',
    timezoneId: 'Europe/Bratislava'
  });

  const page = await context.newPage();

  try {
    // Navigate to listings page
    const url = 'https://www.nehnutelnosti.sk/bratislavsky-kraj/byty/predaj/';
    console.log(`Navigating to: ${url}`);

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Try to accept cookies
    try {
      const acceptButton = page.locator('button:has-text("Prijať"), button:has-text("Accept"), button[class*="accept"]').first();
      if (await acceptButton.count() > 0) {
        await acceptButton.click();
        await page.waitForTimeout(1000);
        console.log('✅ Accepted cookies\n');
      }
    } catch (e) {
      console.log('⚠️  No cookie banner\n');
    }

    // Take screenshot for inspection
    await page.screenshot({ path: 'nehnutelnosti-page.png', fullPage: true });
    console.log('📸 Screenshot saved to nehnutelnosti-page.png\n');

    // Find all possible article/listing containers
    const possibleSelectors = [
      'article',
      '[class*="advertisement"]',
      '[class*="listing"]',
      '[class*="property"]',
      '[class*="offer"]',
      '[class*="card"]',
      '[data-test*="listing"]',
      '[data-id]',
      '.list-item',
      '.search-result',
      'div[itemtype*="Product"]'
    ];

    console.log('Testing selectors:');
    console.log('='.repeat(60));

    for (const selector of possibleSelectors) {
      const count = await page.locator(selector).count();
      if (count > 0) {
        console.log(`✓ "${selector}" → ${count} elements found`);

        // Get first element's HTML preview
        if (count > 0) {
          const firstEl = page.locator(selector).first();
          const html = await firstEl.evaluate(el => {
            const clone = el.cloneNode(false) as HTMLElement;
            return `<${clone.tagName.toLowerCase()} ${Array.from(clone.attributes).map(a => `${a.name}="${a.value}"`).join(' ')}>`;
          });
          console.log(`  Example: ${html}`);
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('\nExtracting sample listing data...\n');

    // Try to extract from first article
    const firstArticle = page.locator('article').first();
    if (await firstArticle.count() > 0) {
      const title = await firstArticle.locator('h2, h3, .title, [class*="title"]').first().textContent().catch(() => null);
      const price = await firstArticle.locator('[class*="price"], [class*="cena"]').first().textContent().catch(() => null);
      const location = await firstArticle.locator('[class*="location"], [class*="lokalita"]').first().textContent().catch(() => null);

      console.log('Sample extraction from first <article>:');
      console.log(`  Title: ${title}`);
      console.log(`  Price: ${price}`);
      console.log(`  Location: ${location}`);
    }

    console.log('\n✅ Inspection complete');
    console.log('\nKeeping browser open for 30 seconds for manual inspection...');
    await page.waitForTimeout(30000);

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

inspect();
