const { chromium } = require('playwright');
const fs = require('fs');

async function scrapeRealitySk() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();

  const allRequests = [];
  const apiResponses = [];

  // Intercept all requests
  await page.route('**/*', route => {
    const request = route.request();
    allRequests.push({
      url: request.url(),
      method: request.method(),
      headers: request.headers(),
      postData: request.postData()
    });
    route.continue();
  });

  // Capture responses
  page.on('response', async response => {
    const url = response.url();
    const request = response.request();

    // Save all JSON responses
    try {
      const contentType = response.headers()['content-type'] || '';
      if (contentType.includes('application/json')) {
        const body = await response.json();
        apiResponses.push({
          url,
          method: request.method(),
          status: response.status(),
          requestHeaders: request.headers(),
          responseHeaders: response.headers(),
          postData: request.postData(),
          responseBody: body
        });

        console.log(`[JSON] ${response.status()} ${url}`);
      }
    } catch (e) {
      // Not JSON or error parsing
    }
  });

  console.log('\n=== Opening Reality.sk ===\n');
  await page.goto('https://www.reality.sk', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  console.log('\n=== Navigating to apartments for sale ===\n');
  await page.goto('https://www.reality.sk/byty/predaj', { waitUntil: 'networkidle' });
  await page.waitForTimeout(5000);

  console.log('\n=== Extracting listing data from page ===\n');

  // Extract all visible listings
  const listings = await page.evaluate(() => {
    const results = [];

    // Find all article elements or listing containers
    const articles = document.querySelectorAll('article, [class*="listing"], [class*="result"], [data-gtm]');

    articles.forEach((article) => {
      const listing = {
        html_classes: article.className,
        dataset: { ...article.dataset }
      };

      // Try to extract title
      const titleEl = article.querySelector('h2, h3, .title, [class*="title"]');
      if (titleEl) listing.title = titleEl.textContent.trim();

      // Try to extract price
      const priceEl = article.querySelector('.price, [class*="price"]');
      if (priceEl) listing.price = priceEl.textContent.trim();

      // Try to extract location
      const locationEl = article.querySelector('.location, [class*="location"], [class*="address"]');
      if (locationEl) listing.location = locationEl.textContent.trim();

      // Try to extract URL
      const linkEl = article.querySelector('a[href]');
      if (linkEl) listing.url = linkEl.href;

      // Try to extract ID from URL or data attributes
      if (article.dataset.id) listing.id = article.dataset.id;
      if (linkEl && linkEl.href) {
        const idMatch = linkEl.href.match(/\/([A-Za-z0-9]+)\/?$/);
        if (idMatch) listing.id = idMatch[1];
      }

      // Extract all images
      const images = Array.from(article.querySelectorAll('img')).map(img => img.src);
      if (images.length > 0) listing.images = images;

      // Only add if we found some meaningful data
      if (listing.title || listing.price || listing.url) {
        results.push(listing);
      }
    });

    return results;
  });

  console.log(`Found ${listings.length} listings on page`);

  // Try to open first listing detail
  if (listings.length > 0 && listings[0].url) {
    console.log('\n=== Opening first listing detail ===\n');
    await page.goto(listings[0].url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(5000);

    // Extract detail data
    const detail = await page.evaluate(() => {
      const data = {};

      // Try to find structured data
      const ldJsonScripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
      data.structuredData = ldJsonScripts.map(script => {
        try {
          return JSON.parse(script.textContent);
        } catch {
          return null;
        }
      }).filter(d => d);

      // Extract meta tags
      data.meta = {};
      document.querySelectorAll('meta[property^="og:"], meta[name^="description"]').forEach(meta => {
        const property = meta.getAttribute('property') || meta.getAttribute('name');
        const content = meta.getAttribute('content');
        if (property && content) {
          data.meta[property] = content;
        }
      });

      // Try to find detail info
      const detailElements = document.querySelectorAll('[class*="detail"], [class*="info"], [class*="parameter"]');
      data.parameters = [];
      detailElements.forEach(el => {
        const text = el.textContent.trim();
        if (text && text.length < 200) {
          data.parameters.push(text);
        }
      });

      return data;
    });

    fs.writeFileSync(
      '/Users/samuelseidel/Development/landomo-world/reality_sk_listing_detail.json',
      JSON.stringify(detail, null, 2)
    );
  }

  // Save all data
  fs.writeFileSync(
    '/Users/samuelseidel/Development/landomo-world/reality_sk_scraped_listings.json',
    JSON.stringify(listings, null, 2)
  );

  fs.writeFileSync(
    '/Users/samuelseidel/Development/landomo-world/reality_sk_api_responses.json',
    JSON.stringify(apiResponses, null, 2)
  );

  fs.writeFileSync(
    '/Users/samuelseidel/Development/landomo-world/reality_sk_all_requests.json',
    JSON.stringify(allRequests, null, 2)
  );

  console.log('\n=== Summary ===');
  console.log(`Listings extracted: ${listings.length}`);
  console.log(`API responses captured: ${apiResponses.length}`);
  console.log(`Total requests captured: ${allRequests.length}`);

  console.log('\n=== Unique API endpoints ===');
  const apiUrls = [...new Set(apiResponses.map(r => {
    try {
      const url = new URL(r.url);
      return `${r.method} ${url.origin}${url.pathname}`;
    } catch {
      return r.url;
    }
  }))];
  apiUrls.forEach(url => console.log(`  - ${url}`));

  await page.waitForTimeout(2000);
  await browser.close();

  return { listings, apiResponses, allRequests };
}

scrapeRealitySk().catch(console.error);
