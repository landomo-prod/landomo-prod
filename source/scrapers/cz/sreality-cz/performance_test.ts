import axios from 'axios';

interface PerformanceMetrics {
  category: number;
  categoryName: string;
  totalEstates: number;
  pagesScraped: number;
  estatesInPages: number;
  startTime: number;
  endTime: number;
  durationMs: number;
  estimatedListingsPerSecond: number;
  averagePageTime: number;
  hasMore: boolean;
}

interface PerformanceReport {
  timestamp: string;
  testDuration: number;
  categories: PerformanceMetrics[];
  summary: {
    totalEstatesAvailable: number;
    totalEstatesScraped: number;
    totalUniqueHashIds: Set<number>;
    totalPagesScraped: number;
    totalTimeMs: number;
    averageListingsPerSecond: number;
    estimatedTimeToScrapeAll: string;
    pagesPerSecond: number;
    recommendedBatchSize: number;
    recommendedDelay: number;
    rateLimitDetected: boolean;
    rateLimitThresholds: any[];
  };
}

const categoryMap: Record<number, string> = {
  1: 'Apartments',
  2: 'Houses',
  3: 'Land',
  4: 'Commercial',
  5: 'Garages'
};

const getRandomUserAgent = (): string => {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15'
  ];
  return userAgents[Math.floor(Math.random() * userAgents.length)];
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const testCategory = async (
  category: number,
  pages: number = 10
): Promise<PerformanceMetrics> => {
  const categoryName = categoryMap[category] || `Category ${category}`;
  const userAgent = getRandomUserAgent();
  const perPage = 100;
  const tms = Date.now();

  const startTime = Date.now();
  let totalEstates = 0;
  let pagesScraped = 0;
  let hasMore = false;
  const allHashIds = new Set<number>();
  const responseTimes: number[] = [];
  let apiErrors = 0;

  console.log(`\n📊 Testing ${categoryName} (Category ${category})...`);

  for (let page = 1; page <= pages; page++) {
    try {
      const pageStartTime = Date.now();
      const url = `https://www.sreality.cz/api/cs/v2/estates?page=${page}&per_page=${perPage}&category_main_cb=${category}&tms=${tms}`;

      const response = await axios.get(url, {
        headers: { 'User-Agent': userAgent },
        timeout: 30000
      });

      const pageEndTime = Date.now();
      const pageTime = pageEndTime - pageStartTime;
      responseTimes.push(pageTime);

      const data = response.data;
      const estates = data._embedded?.estates || [];

      // Extract hash_ids for uniqueness check
      estates.forEach((estate: any) => {
        if (estate.hash_id) {
          allHashIds.add(estate.hash_id);
        }
      });

      const resultSize = data.result_size || 0;
      totalEstates = resultSize; // Total available in this category
      const estatesFound = estates.length;

      console.log(`  Page ${page}: ${estatesFound} estates | Response time: ${pageTime}ms | Total available: ${resultSize}`);

      pagesScraped++;
      hasMore = estatesFound === perPage; // More pages available if we got full page

      if (estatesFound === 0) {
        break; // No more results
      }

      if (page < pages) {
        // Simulate realistic scraping delays
        await delay(300 + Math.random() * 200);
      }
    } catch (error: any) {
      apiErrors++;
      const statusCode = error.response?.status || 'Unknown';
      console.error(`  ❌ Page ${page} error (${statusCode}):`, error.message);

      if (error.response?.status === 429) {
        console.warn(`  ⚠️  Rate limit detected on page ${page}`);
        hasMore = false;
        break;
      }

      if (error.response?.status === 403 || error.response?.status === 404) {
        break;
      }

      // Add exponential backoff
      await delay(Math.min(1000 * Math.pow(2, apiErrors), 10000));
    }
  }

  const endTime = Date.now();
  const durationMs = endTime - startTime;
  const estatesInPages = pagesScraped * perPage;
  const avgPageTime = responseTimes.length > 0 ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0;
  const listingsPerSecond = durationMs > 0 ? (estatesInPages / durationMs) * 1000 : 0;

  return {
    category,
    categoryName,
    totalEstates,
    pagesScraped,
    estatesInPages,
    startTime,
    endTime,
    durationMs,
    estimatedListingsPerSecond: listingsPerSecond,
    averagePageTime: avgPageTime,
    hasMore
  };
};

async function runPerformanceTest() {
  console.log('🚀 SReality Scraper Performance Test');
  console.log('====================================\n');

  const testCategories = [1, 2, 3, 4]; // Apartments, Houses, Land, Commercial
  const pagesPerCategory = 10;
  const results: PerformanceMetrics[] = [];
  const allHashIds = new Set<number>();

  const overallStartTime = Date.now();

  for (const category of testCategories) {
    try {
      const metrics = await testCategory(category, pagesPerCategory);
      results.push(metrics);
    } catch (error) {
      console.error(`Failed to test category ${category}:`, error);
    }
  }

  const overallEndTime = Date.now();
  const totalTimeMs = overallEndTime - overallStartTime;

  // Calculate summary statistics
  const totalEstatesAvailable = results.reduce((sum, r) => sum + r.totalEstates, 0);
  const totalEstatesScraped = results.reduce((sum, r) => sum + r.estatesInPages, 0);
  const totalPagesScraped = results.reduce((sum, r) => sum + r.pagesScraped, 0);
  const totalListingsPerSecond = (totalEstatesScraped / totalTimeMs) * 1000;
  const pagesPerSecond = (totalPagesScraped / totalTimeMs) * 1000;

  // Estimate time to scrape all estates
  const estimatedTotalTime = totalEstatesAvailable / totalListingsPerSecond;
  const estimatedHours = Math.floor(estimatedTotalTime / 3600);
  const estimatedMinutes = Math.floor((estimatedTotalTime % 3600) / 60);

  // Determine recommended batch size and delay
  const recommendedBatchSize = 100; // API returns max 100 per page
  const recommendedDelay = 500; // ms between requests to avoid throttling

  // Check for rate limiting
  const rateLimitDetected = results.some(r => !r.hasMore && r.pagesScraped < pagesPerCategory);
  const slowPages = results.map(r => ({
    category: r.categoryName,
    avgPageTime: Math.round(r.averagePageTime),
    slowdown: r.averagePageTime > 2000 ? 'YES' : 'NO'
  }));

  const report: PerformanceReport = {
    timestamp: new Date().toISOString(),
    testDuration: totalTimeMs,
    categories: results,
    summary: {
      totalEstatesAvailable,
      totalEstatesScraped,
      totalUniqueHashIds: allHashIds,
      totalPagesScraped,
      totalTimeMs,
      averageListingsPerSecond: Math.round(totalListingsPerSecond * 100) / 100,
      estimatedTimeToScrapeAll: `${estimatedHours}h ${estimatedMinutes}m`,
      pagesPerSecond: Math.round(pagesPerSecond * 100) / 100,
      recommendedBatchSize,
      recommendedDelay,
      rateLimitDetected,
      rateLimitThresholds: slowPages
    }
  };

  // Output report
  console.log('\n\n📈 PERFORMANCE TEST SUMMARY');
  console.log('===========================\n');
  console.log(`Total Test Duration: ${(totalTimeMs / 1000).toFixed(2)}s`);
  console.log(`Total Pages Scraped: ${totalPagesScraped}`);
  console.log(`Total Estates Scraped: ${totalEstatesScraped}`);
  console.log(`Total Estates Available: ${totalEstatesAvailable}`);
  console.log(`Average Listings/Second: ${report.summary.averageListingsPerSecond}`);
  console.log(`Pages/Second: ${report.summary.pagesPerSecond}`);
  console.log(`Estimated Time to Scrape All: ${report.summary.estimatedTimeToScrapeAll}`);
  console.log(`Rate Limit Detected: ${rateLimitDetected ? 'YES' : 'NO'}`);

  console.log('\n📊 By Category:');
  results.forEach(r => {
    console.log(`  ${r.categoryName}:`);
    console.log(`    - Total Available: ${r.totalEstates}`);
    console.log(`    - Scraped: ${r.estatesInPages} (${r.pagesScraped} pages)`);
    console.log(`    - Speed: ${r.estimatedListingsPerSecond.toFixed(2)} listings/sec`);
    console.log(`    - Avg Page Time: ${r.averagePageTime.toFixed(0)}ms`);
  });

  console.log('\n⚙️  Recommendations:');
  console.log(`  - Batch Size: ${recommendedBatchSize} listings per request`);
  console.log(`  - Delay Between Requests: ${recommendedDelay}ms`);
  console.log(`  - Concurrent Requests: 3-5 (with proper delays)`);
  console.log(`  - Daily Capacity: ~${Math.round((86400 / (recommendedDelay / 1000)) * 100)} listings`);

  // Save report to JSON file
  const jsonReport = {
    timestamp: report.timestamp,
    testDuration: report.testDuration,
    categories: report.categories,
    summary: {
      ...report.summary,
      totalUniqueHashIds: allHashIds.size
    }
  };

  const fs = await import('fs/promises');
  await fs.writeFile(
    '/Users/samuelseidel/Development/landomo-world/scrapers/Czech Republic/sreality/PERFORMANCE_REPORT.json',
    JSON.stringify(jsonReport, null, 2)
  );

  console.log('\n✅ Report saved to PERFORMANCE_REPORT.json');

  return jsonReport;
}

runPerformanceTest().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
