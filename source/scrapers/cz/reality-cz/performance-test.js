#!/usr/bin/env node

const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Reality.cz Performance Test Script
 * Tests scraping capacity and speed
 */

const BASE_URL = 'https://www.reality.cz';
const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
];

let globalStats = {
  totalListings: 0,
  totalPages: 0,
  totalRequests: 0,
  totalTime: 0,
  startTime: Date.now(),
  errors: 0,
  successfulPages: 0,
  categoryResults: {}
};

function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

async function fetchPage(url) {
  try {
    const startTime = Date.now();
    const response = await axios.get(url, {
      headers: {
        'User-Agent': getRandomUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'cs,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      },
      timeout: 30000
    });
    const duration = Date.now() - startTime;

    globalStats.totalRequests++;
    globalStats.totalTime += duration;

    return {
      data: response.data,
      duration,
      status: response.status
    };
  } catch (error) {
    globalStats.errors++;
    throw error;
  }
}

function parseListingsFromPage(html) {
  const $ = cheerio.load(html);
  const listings = [];

  // Try multiple selectors to find listing containers
  const selectors = [
    '.property-item',
    '.offer-item',
    '.listing-item',
    'article.property',
    '[data-id]',
    '.advert',
    'a[href*="/L00-"]',
    'a[href*="/428-"]'
  ];

  let $items = null;
  for (const selector of selectors) {
    const items = $(selector);
    if (items.length > 0) {
      $items = items;
      break;
    }
  }

  if (!$items || $items.length === 0) {
    return [];
  }

  $items.each((i, element) => {
    try {
      const $item = $(element);

      // Extract listing ID
      let listingId = $item.attr('data-id') || '';
      if (!listingId) {
        const href = $item.attr('href') || $item.find('a').first().attr('href') || '';
        const idMatch = href.match(/\/(L00-|428-)(\d+)/);
        listingId = idMatch ? idMatch[2] : '';
      }

      // Extract URL
      let url = $item.attr('href') || $item.find('a').first().attr('href') || '';
      if (url && !url.startsWith('http')) {
        url = BASE_URL + url;
      }

      // Extract title
      const title = $item.find('.title, h2, h3, .property-title').first().text().trim() ||
                   $item.attr('title') || '';

      // Extract price
      const priceText = $item.find('.price, .property-price, .cena').first().text().trim();

      // Extract location
      const location = $item.find('.location, .property-location, .lokace, .address').first().text().trim();

      // Extract area
      const area = $item.find('.area, .property-area, .plocha').first().text().trim();

      if (listingId && url && title) {
        listings.push({
          id: listingId,
          title,
          url,
          price: priceText || 'N/A',
          location: location || 'N/A',
          area: area || 'N/A'
        });
      }
    } catch (error) {
      // Skip problematic items
    }
  });

  return listings;
}

async function testCategory(transaction, propertyType, categoryName) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`Testing: ${categoryName}`);
  console.log(`URL Pattern: /${transaction}/${propertyType}/Ceska-republika/`);
  console.log(`${'='.repeat(70)}\n`);

  let currentPage = 1;
  let totalListings = 0;
  let consecutiveEmpty = 0;
  const maxPages = 40;
  const maxConsecutiveEmpty = 3;
  const pageResults = [];

  while (currentPage <= maxPages) {
    try {
      const url = `${BASE_URL}/${transaction}/${propertyType}/Ceska-republika/?page=${currentPage}`;

      console.log(`Page ${currentPage}...`, { progress: true });
      const pageStart = Date.now();

      const pageResult = await fetchPage(url);
      const pageDuration = pageResult.duration;

      const listings = parseListingsFromPage(pageResult.data);
      const pageDuration2 = Date.now() - pageStart;

      pageResults.push({
        page: currentPage,
        listings: listings.length,
        duration: pageDuration,
        totalDuration: pageDuration2,
        listingsPerSecond: listings.length > 0 ? (listings.length / (pageDuration / 1000)).toFixed(2) : 0
      });

      if (listings.length === 0) {
        consecutiveEmpty++;
        console.log(`  ✗ Empty page (${consecutiveEmpty}/${maxConsecutiveEmpty})`);

        if (consecutiveEmpty >= maxConsecutiveEmpty) {
          console.log(`  Stopping after ${maxConsecutiveEmpty} consecutive empty pages\n`);
          break;
        }
      } else {
        consecutiveEmpty = 0;
        totalListings += listings.length;
        globalStats.successfulPages++;

        console.log(`  ✓ Found ${listings.length} listings (${pageDuration}ms)`);
        console.log(`    Total: ${totalListings}, Speed: ${(listings.length / (pageDuration / 1000)).toFixed(1)} listings/sec`);
      }

      currentPage++;

      // Respectful delay between requests
      if (currentPage <= maxPages) {
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 500));
      }

    } catch (error) {
      console.error(`  ✗ Error on page ${currentPage}: ${error.message}`);
      consecutiveEmpty++;

      if (consecutiveEmpty >= maxConsecutiveEmpty) {
        console.log(`  Too many errors, stopping\n`);
        break;
      }

      currentPage++;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  globalStats.totalPages += currentPage - 1;
  globalStats.totalListings += totalListings;
  globalStats.categoryResults[categoryName] = {
    totalListings,
    pagesScraped: currentPage - 1,
    pagesWithData: pageResults.filter(p => p.listings > 0).length,
    averagePageLoad: pageResults.length > 0
      ? (pageResults.reduce((sum, p) => sum + p.duration, 0) / pageResults.length).toFixed(0)
      : 0,
    averageListingsPerPage: totalListings > 0
      ? (totalListings / pageResults.filter(p => p.listings > 0).length).toFixed(1)
      : 0,
    pageResults
  };

  return {
    categoryName,
    totalListings,
    pagesScraped: currentPage - 1,
    successfulPages: pageResults.filter(p => p.listings > 0).length,
    pageResults
  };
}

async function runPerformanceTest() {
  console.log('\n');
  console.log('██████╗ ███████╗ █████╗ ██╗     ██╗████████╗██╗   ██╗    ███╗   ███╗████████╗███████╗████████╗');
  console.log('██╔══██╗██╔════╝██╔══██╗██║     ██║╚══██╔══╝╚██╗ ██╔╝    ████╗ ████║╚══██╔══╝██╔════╝╚══██╔══╝');
  console.log('██████╔╝█████╗  ███████║██║     ██║   ██║    ╚████╔╝     ██╔████╔██║   ██║   █████╗     ██║   ');
  console.log('██╔══██╗██╔══╝  ██╔══██║██║     ██║   ██║     ╚██╔╝      ██║╚██╔╝██║   ██║   ██╔══╝     ██║   ');
  console.log('██║  ██║███████╗██║  ██║███████╗██║   ██║      ██║       ██║ ╚═╝ ██║   ██║   ███████╗   ██║   ');
  console.log('╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚══════╝╚═╝   ╚═╝      ╚═╝       ╚═╝     ╚═╝   ╚═╝   ╚══════╝   ╚═╝   ');
  console.log('\nPerformance Test v1.0');
  console.log(`Started: ${new Date().toISOString()}`);
  console.log('\n');

  const categories = [
    { transaction: 'prodej', property: 'byty', name: 'Sales - Apartments (Byty na prodej)' },
    { transaction: 'prodej', property: 'domy', name: 'Sales - Houses (Domy na prodej)' },
    { transaction: 'prodej', property: 'pozemky', name: 'Sales - Land (Pozemky na prodej)' },
    { transaction: 'pronajem', property: 'byty', name: 'Rentals - Apartments (Byty k pronájmu)' },
    { transaction: 'pronajem', property: 'domy', name: 'Rentals - Houses (Domy k pronájmu)' }
  ];

  const results = [];

  for (const category of categories) {
    try {
      const result = await testCategory(category.transaction, category.property, category.name);
      results.push(result);
    } catch (error) {
      console.error(`Failed to test ${category.name}: ${error.message}`);
    }
  }

  // Calculate final metrics
  const totalTime = (Date.now() - globalStats.startTime) / 1000;
  const avgPageLoadTime = globalStats.totalRequests > 0
    ? (globalStats.totalTime / globalStats.totalRequests).toFixed(0)
    : 0;
  const pagesPerSecond = (globalStats.totalPages / totalTime).toFixed(2);
  const listingsPerSecond = (globalStats.totalListings / totalTime).toFixed(2);

  // Estimate total listings on portal (extrapolate from sampled data)
  const estimatedTotalListings = Math.round(globalStats.totalListings * 1.2); // Add 20% for unseen listings

  // Calculate time to scrape entire catalog
  const avgListingsPerPage = globalStats.totalListings / Math.max(globalStats.successfulPages, 1);
  const estimatedPagesPerCategory = 40; // max_pages in config
  const estimatedTotalPages = categories.length * estimatedPagesPerCategory;
  const estimatedScrapeTimeMinutes = ((estimatedTotalPages * parseFloat(avgPageLoadTime)) / 1000 / 60).toFixed(1);

  // Generate report
  const report = {
    testMetadata: {
      testedAt: new Date().toISOString(),
      testDuration: `${totalTime.toFixed(1)}s`,
      totalCategories: categories.length,
      categoriesAvailable: results.length
    },
    capacity: {
      totalListingsFound: globalStats.totalListings,
      estimatedTotalOnPortal: estimatedTotalListings,
      totalPagesScraped: globalStats.totalPages,
      breakdownByCategory: results.reduce((acc, r) => {
        acc[r.categoryName] = r.totalListings;
        return acc;
      }, {})
    },
    speed: {
      totalRequests: globalStats.totalRequests,
      successfulPages: globalStats.successfulPages,
      failedRequests: globalStats.errors,
      averagePageLoadTimeMs: parseInt(avgPageLoadTime),
      pagesPerSecond: parseFloat(pagesPerSecond),
      listingsPerSecond: parseFloat(listingsPerSecond),
      averageListingsPerPage: (globalStats.totalListings / Math.max(globalStats.successfulPages, 1)).toFixed(1)
    },
    timingEstimates: {
      testDurationSeconds: parseFloat(totalTime.toFixed(1)),
      estimatedFullCatalogScrapeMinutes: parseFloat(estimatedScrapeTimeMinutes),
      estimatedFullCatalogScrapeHours: (parseFloat(estimatedScrapeTimeMinutes) / 60).toFixed(1),
      estimatedPagesInFullCatalog: estimatedTotalPages,
      estimatedListingsInFullCatalog: estimatedTotalListings
    },
    rateLimiting: {
      delayBetweenRequestsMs: 1000,
      userAgentRotation: true,
      httpTimeout: 30000,
      consequitiveEmptyPageLimit: 3,
      rateLimitBlocking: globalStats.errors === 0 ? 'None detected' : `${globalStats.errors} errors - possible blocking`
    },
    recommendations: {
      scrapingStrategy: 'HTML parsing with axios + cheerio is sufficient for current volume',
      headlessBrowserNeeded: false,
      estimatedResourcesNeeded: {
        cpuCores: 1,
        memoryMb: 512,
        concurrentRequests: 1,
        recommendedConcurrency: 1
      },
      userAgentStrategy: 'Rotate among 3 common user agents',
      delayStrategy: 'Maintain 1-2 second delays between requests',
      proxyRotationNeeded: false,
      retryStrategy: 'Exponential backoff with 3 retries'
    },
    detailedResults: results.reduce((acc, r) => {
      acc[r.categoryName] = {
        totalListings: r.totalListings,
        pagesScraped: r.pagesScraped,
        successfulPages: r.successfulPages,
        pageDetails: r.pageResults.slice(0, 10) // First 10 pages for reference
      };
      return acc;
    }, {})
  };

  // Print summary
  console.log('\n' + '='.repeat(70));
  console.log('PERFORMANCE TEST SUMMARY');
  console.log('='.repeat(70));

  console.log('\n📊 CAPACITY:');
  console.log(`  Total Listings Found: ${globalStats.totalListings}`);
  console.log(`  Estimated Total on Portal: ~${estimatedTotalListings}`);
  console.log(`  Total Pages Scraped: ${globalStats.totalPages}`);
  console.log(`  Successful Pages: ${globalStats.successfulPages}`);

  console.log('\n⚡ SPEED:');
  console.log(`  Total Test Duration: ${totalTime.toFixed(1)}s`);
  console.log(`  Average Page Load: ${avgPageLoadTime}ms`);
  console.log(`  Pages Per Second: ${pagesPerSecond}`);
  console.log(`  Listings Per Second: ${listingsPerSecond}`);
  console.log(`  Average Listings Per Page: ${(globalStats.totalListings / Math.max(globalStats.successfulPages, 1)).toFixed(1)}`);

  console.log('\n⏱️  ESTIMATES:');
  console.log(`  Full Catalog Scrape Time: ~${estimatedScrapeTimeMinutes} minutes (${(parseFloat(estimatedScrapeTimeMinutes) / 60).toFixed(1)} hours)`);
  console.log(`  Estimated Total Pages: ${estimatedTotalPages}`);
  console.log(`  Estimated Total Listings: ${estimatedTotalListings}`);

  console.log('\n🚫 RATE LIMITING:');
  console.log(`  Blocking Detected: ${globalStats.errors === 0 ? 'None' : 'Possible'}`);
  console.log(`  Failed Requests: ${globalStats.errors}`);
  console.log(`  Error Rate: ${((globalStats.errors / globalStats.totalRequests) * 100).toFixed(2)}%`);

  console.log('\n💡 RECOMMENDATIONS:');
  console.log(`  Technology: HTML parsing (axios + cheerio) - SUFFICIENT`);
  console.log(`  Headless Browser: NOT needed`);
  console.log(`  Concurrency Level: Keep at 1 (sequential)`);
  console.log(`  Delay Between Requests: 1-2 seconds`);
  console.log(`  User-Agent Rotation: Enabled (3 agents)`);
  console.log(`  Proxy Rotation: NOT required`);

  console.log('\n' + '='.repeat(70) + '\n');

  // Save report to JSON
  const fs = require('fs');
  const reportPath = '/Users/samuelseidel/Development/landomo-world/scrapers/Czech Republic/reality/performance-report.json';
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`✅ Report saved to: ${reportPath}\n`);

  return report;
}

runPerformanceTest().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
