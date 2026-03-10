import { chromium } from 'playwright';

async function quickTest() {
  console.log('🧪 Testing updated idnes-reality selectors...\n');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto('https://reality.idnes.cz/s/prodej/byty/', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    await page.waitForTimeout(2000);

    const listings = await page.evaluate(() => {
      const items: any[] = [];
      const elements = document.querySelectorAll('.c-products__item');

      elements.forEach((item, index) => {
        if (index >= 5) return; // Only test first 5

        const titleEl = item.querySelector('.c-products__title, h2, .title');
        const linkEl = item.querySelector('a.c-products__link, a[href*="/detail/"]');
        const priceEl = item.querySelector('.c-products__price, .price');
        const locationEl = item.querySelector('.c-products__info, .location');
        const imageEl = item.querySelector('img');

        const title = titleEl?.textContent?.trim() || '';
        const url = linkEl?.getAttribute('href') || '';
        const priceText = priceEl?.textContent?.trim() || '';
        const location = locationEl?.textContent?.trim() || '';
        const imageUrl = imageEl?.getAttribute('src') || imageEl?.getAttribute('data-src') || '';

        const areaMatch = title.match(/(\d+)\s*m²/);
        const area = areaMatch ? parseInt(areaMatch[1]) : undefined;

        const priceMatch = priceText.match(/[\d\s]+/);
        const price = priceMatch ? parseInt(priceMatch[0].replace(/\s/g, '')) : undefined;

        const idMatch = url.match(/\/([a-f0-9]{24})\/?$/);
        const id = idMatch?.[1] || '';

        if (title && url) {
          items.push({
            id,
            title,
            url: url.startsWith('http') ? url : `https://reality.idnes.cz${url}`,
            price,
            priceText,
            location,
            area,
            imageUrl
          });
        }
      });

      return items;
    });

    console.log(`✅ Found ${listings.length} listings:\n`);
    listings.forEach((listing, i) => {
      console.log(`${i + 1}. ${listing.title}`);
      console.log(`   Price: ${listing.priceText}`);
      console.log(`   Location: ${listing.location}`);
      console.log(`   Area: ${listing.area} m²`);
      console.log(`   ID: ${listing.id}`);
      console.log(`   URL: ${listing.url}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
  }
}

quickTest();
