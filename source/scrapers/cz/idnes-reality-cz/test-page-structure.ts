import { chromium } from 'playwright';

async function testPageStructure() {
  console.log('🔍 Testing iDNES Reality page structure...\n');

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    console.log('1. Navigating to page...');
    await page.goto('https://reality.idnes.cz/s/prodej/byty/', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    console.log('2. Waiting for content...');
    await page.waitForTimeout(3000);

    console.log('3. Taking screenshot...');
    await page.screenshot({ path: 'test-screenshot.png', fullPage: true });

    console.log('4. Checking selectors...');
    const selectors = [
      '.c-products',
      '.c-products__list',
      '.c-products__item',
      '.c-products__title',
      '.c-products__price',
      '.estate-item',
      '[data-dot="hp_product"]'
    ];

    for (const selector of selectors) {
      const count = await page.locator(selector).count();
      console.log(`   ${selector}: ${count} elements`);
    }

    console.log('\n5. Extracting first listing...');
    const firstListing = await page.evaluate(() => {
      const item = document.querySelector('.c-products__item');
      if (!item) return null;

      return {
        html: item.innerHTML.substring(0, 500),
        title: item.querySelector('.c-products__title')?.textContent?.trim(),
        price: item.querySelector('.c-products__price')?.textContent?.trim(),
        info: item.querySelector('.c-products__info')?.textContent?.trim(),
      };
    });

    console.log('First listing:', JSON.stringify(firstListing, null, 2));

    console.log('\n✅ Test complete! Check test-screenshot.png');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
  }
}

testPageStructure();
