import axios from 'axios';
import * as fs from 'fs';

/**
 * Realingo Performance Test Suite v2 - Using Correct GraphQL API Schema
 * Tests GraphQL API capacity, speed, and rate limiting
 *
 * API Notes:
 * - Uses "first" parameter instead of "limit"
 * - Uses "after" for cursor-based pagination
 * - Returns items directly with total count
 * - Supports filter with purpose, property, etc.
 */

interface QueryMetric {
  testName: string;
  purpose?: string;
  property?: string;
  first: number;
  after?: string;
  timestamp: number;
  duration: number;
  itemsReturned: number;
  totalAvailable: number;
  itemsPerSecond: number;
  success: boolean;
  error?: string;
}

interface CapacityResults {
  totalListingsAvailable: number;
  byPurpose: { [key: string]: number };
  byProperty: { [key: string]: number };
  byPurposeAndProperty: { [key: string]: { [key: string]: number } };
  maxItemsPerQuery: number;
  queryTimestamps: number[];
}

interface SpeedResults {
  queryCount: number;
  totalDuration: number;
  averageQueryDuration: number;
  totalItemsFetched: number;
  overallItemsPerSecond: number;
  fastestQuery: number;
  slowestQuery: number;
}

interface RateLimitResults {
  rateLimited: boolean;
  retryAfter?: number;
  queueDelayMs: number;
  maxConcurrentQueries: number;
  observed429Errors: number;
  observed503Errors: number;
}

interface PerformanceReport {
  timestamp: string;
  testDuration: number;
  capacity: CapacityResults;
  speed: SpeedResults;
  rateLimits: RateLimitResults;
  queryMetrics: QueryMetric[];
  recommendations: string[];
  estimatedScrapeTime: string;
  summary: string;
}

class RealingoPerformanceTester {
  private graphqlUrl = 'https://www.realingo.cz/graphql';
  private metrics: QueryMetric[] = [];
  private axiosInstance = axios.create({
    baseURL: this.graphqlUrl,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    }
  });

  /**
   * SearchOffer GraphQL query (CORRECTED SCHEMA)
   */
  private getSearchOfferQuery(): string {
    return `
      query SearchOffer(
        $purpose: OfferPurpose,
        $property: PropertyType,
        $first: Int
      ) {
        searchOffer(
          filter: {
            purpose: $purpose
            property: $property
          }
          first: $first
        ) {
          total
          items {
            id
          }
        }
      }
    `;
  }

  /**
   * Execute a single GraphQL query and measure performance
   */
  private async executeQuery(
    variables: any,
    testName: string
  ): Promise<QueryMetric | null> {
    const timestamp = Date.now();
    const startTime = Date.now();

    try {
      const response = await this.axiosInstance.post('', {
        query: this.getSearchOfferQuery(),
        variables
      });

      const endTime = Date.now();
      const duration = endTime - startTime;
      const itemsReturned = response.data.data?.searchOffer?.items?.length || 0;
      const totalAvailable = response.data.data?.searchOffer?.total || 0;

      const metric: QueryMetric = {
        testName,
        purpose: variables.purpose,
        property: variables.property,
        first: variables.first,
        after: variables.after,
        timestamp,
        duration,
        itemsReturned,
        totalAvailable,
        itemsPerSecond: duration > 0 ? (itemsReturned / duration) * 1000 : 0,
        success: true
      };

      this.metrics.push(metric);
      return metric;
    } catch (error: any) {
      const endTime = Date.now();
      const duration = endTime - startTime;

      const metric: QueryMetric = {
        testName,
        purpose: variables.purpose,
        property: variables.property,
        first: variables.first,
        after: variables.after,
        timestamp,
        duration,
        itemsReturned: 0,
        totalAvailable: 0,
        itemsPerSecond: 0,
        success: false,
        error: error.response?.data?.errors?.[0]?.message || error.message
      };

      this.metrics.push(metric);
      return metric;
    }
  }

  /**
   * Test capacity: find total listings available
   */
  async testCapacity(): Promise<CapacityResults> {
    console.log('\n=== PHASE 1: Testing Capacity ===\n');

    const purposes = ['SELL', 'RENT'];
    const properties = ['FLAT', 'HOUSE', 'LAND', 'COMMERCIAL', 'OTHERS'];

    const results: CapacityResults = {
      totalListingsAvailable: 0,
      byPurpose: {},
      byProperty: {},
      byPurposeAndProperty: {},
      maxItemsPerQuery: 0,
      queryTimestamps: []
    };

    // Test total without filters
    console.log('Testing total listings (no filters)...');
    const totalMetric = await this.executeQuery(
      { first: 1 },
      'total_all'
    );

    if (totalMetric?.success) {
      results.totalListingsAvailable = totalMetric.totalAvailable;
      results.queryTimestamps.push(totalMetric.timestamp);
      console.log(`  ✓ Total listings available: ${totalMetric.totalAvailable}`);
    } else {
      console.log(`  ✗ Failed: ${totalMetric?.error}`);
    }

    // Test by purpose
    console.log('\nTesting by purpose...');
    for (const purpose of purposes) {
      const metric = await this.executeQuery(
        { purpose, first: 1 },
        `by_purpose_${purpose}`
      );

      if (metric?.success) {
        results.byPurpose[purpose] = metric.totalAvailable;
        results.queryTimestamps.push(metric.timestamp);
        console.log(`  ✓ ${purpose}: ${metric.totalAvailable}`);
      } else {
        console.log(`  ✗ ${purpose}: ${metric?.error}`);
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Test by property type
    console.log('\nTesting by property type...');
    for (const property of properties) {
      const metric = await this.executeQuery(
        { property, first: 1 },
        `by_property_${property}`
      );

      if (metric?.success) {
        results.byProperty[property] = metric.totalAvailable;
        results.queryTimestamps.push(metric.timestamp);
        console.log(`  ✓ ${property}: ${metric.totalAvailable}`);
      } else {
        console.log(`  ✗ ${property}: ${metric?.error}`);
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Test by purpose and property combination (key combinations)
    console.log('\nTesting SELL + property combinations...');
    results.byPurposeAndProperty['SELL'] = {};
    for (const property of properties) {
      const metric = await this.executeQuery(
        { purpose: 'SELL', property, first: 1 },
        `SELL_${property}`
      );

      if (metric?.success) {
        results.byPurposeAndProperty['SELL'][property] = metric.totalAvailable;
        results.queryTimestamps.push(metric.timestamp);
        console.log(`  ✓ SELL + ${property}: ${metric.totalAvailable}`);
      } else {
        console.log(`  ✗ SELL + ${property}: ${metric?.error}`);
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('\nTesting RENT + property combinations...');
    results.byPurposeAndProperty['RENT'] = {};
    for (const property of properties) {
      const metric = await this.executeQuery(
        { purpose: 'RENT', property, first: 1 },
        `RENT_${property}`
      );

      if (metric?.success) {
        results.byPurposeAndProperty['RENT'][property] = metric.totalAvailable;
        results.queryTimestamps.push(metric.timestamp);
        console.log(`  ✓ RENT + ${property}: ${metric.totalAvailable}`);
      } else {
        console.log(`  ✗ RENT + ${property}: ${metric?.error}`);
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Test maximum items per single query
    console.log('\nTesting max items per query...');
    for (const first of [100, 500, 1000]) {
      const metric = await this.executeQuery(
        { first },
        `max_items_${first}`
      );

      if (metric?.success) {
        results.queryTimestamps.push(metric.timestamp);
        console.log(`  ✓ first=${first}: returned ${metric.itemsReturned} items`);
        if (metric.itemsReturned === first) {
          results.maxItemsPerQuery = first;
        }
      } else {
        console.log(`  ✗ first=${first}: ${metric?.error}`);
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return results;
  }

  /**
   * Test speed: measure query response times and throughput
   */
  async testSpeed(): Promise<SpeedResults> {
    console.log('\n=== PHASE 2: Testing Speed ===\n');

    const speedMetrics: QueryMetric[] = [];

    console.log('Testing query speed with various batch sizes...');

    // Test different batch sizes to measure speed
    const batchSizes = [10, 50, 100, 500, 1000];

    for (const batchSize of batchSizes) {
      const metric = await this.executeQuery(
        { first: batchSize },
        `speed_test_${batchSize}`
      );

      if (metric?.success) {
        speedMetrics.push(metric);
        console.log(`  ✓ first=${batchSize}: ${metric.duration}ms (${metric.itemsPerSecond.toFixed(1)} items/s)`);
      } else {
        console.log(`  ✗ first=${batchSize}: ${metric?.error}`);
      }

      await new Promise(resolve => setTimeout(resolve, 200));
    }

    const totalDuration = speedMetrics.reduce((sum, m) => sum + m.duration, 0);
    const totalItems = speedMetrics.reduce((sum, m) => sum + m.itemsReturned, 0);
    const durations = speedMetrics.map(m => m.duration).sort((a, b) => a - b);

    return {
      queryCount: speedMetrics.length,
      totalDuration,
      averageQueryDuration: speedMetrics.length > 0 ? totalDuration / speedMetrics.length : 0,
      totalItemsFetched: totalItems,
      overallItemsPerSecond: totalDuration > 0 ? (totalItems / totalDuration) * 1000 : 0,
      fastestQuery: durations[0] || 0,
      slowestQuery: durations[durations.length - 1] || 0
    };
  }

  /**
   * Test rate limiting: check for 429/503 errors and rate limit headers
   */
  async testRateLimiting(): Promise<RateLimitResults> {
    console.log('\n=== PHASE 3: Testing Rate Limits ===\n');

    const results: RateLimitResults = {
      rateLimited: false,
      queueDelayMs: 0,
      maxConcurrentQueries: 0,
      observed429Errors: 0,
      observed503Errors: 0
    };

    // Test rapid consecutive requests
    console.log('Testing 20 rapid consecutive requests...');
    let successCount = 0;

    for (let i = 0; i < 20; i++) {
      try {
        const response = await this.axiosInstance.post('', {
          query: this.getSearchOfferQuery(),
          variables: { first: 10 }
        });

        successCount++;
        const status = response.status;
        const total = response.data.data?.searchOffer?.total;

        if (i % 5 === 0) {
          console.log(`  Request ${i + 1}: OK (status: ${status})`);
        }

        if (status === 429) {
          results.rateLimited = true;
          results.observed429Errors++;
          const retryAfter = response.headers['retry-after'];
          if (retryAfter) {
            results.retryAfter = parseInt(retryAfter);
          }
        }
      } catch (error: any) {
        if (error.response?.status === 429) {
          results.rateLimited = true;
          results.observed429Errors++;
          console.log(`  Request ${i + 1}: Rate limited (429)`);
          const retryAfter = error.response.headers['retry-after'];
          if (retryAfter) {
            results.retryAfter = parseInt(retryAfter);
          }
        } else if (error.response?.status === 503) {
          results.observed503Errors++;
          console.log(`  Request ${i + 1}: Service unavailable (503)`);
        } else {
          console.log(`  Request ${i + 1}: Error - ${error.message}`);
        }
      }

      // No delay - testing rapid fire
      if (results.observed429Errors > 0 || results.observed503Errors > 0) {
        console.log(`Rate limiting detected after ${i + 1} requests. Stopping test.`);
        break;
      }
    }

    console.log(`\nRate limit test results: ${successCount} successful requests without throttling`);
    if (!results.rateLimited) {
      console.log('No rate limiting observed. API appears to have generous rate limits.');
    }

    return results;
  }

  /**
   * Estimate time to scrape all listings
   */
  estimateScrapeTime(capacity: CapacityResults, speed: SpeedResults): string {
    if (speed.overallItemsPerSecond === 0) {
      return 'Unable to calculate - no speed data';
    }

    const totalItems = capacity.totalListingsAvailable;
    const itemsPerSecond = speed.overallItemsPerSecond;
    // Add delay between requests (assuming 500ms delay as per original scraper)
    const delayPerRequest = 0.5;
    const estimatedSeconds = (totalItems / itemsPerSecond) + (totalItems / 100 * delayPerRequest);

    const hours = Math.floor(estimatedSeconds / 3600);
    const minutes = Math.floor((estimatedSeconds % 3600) / 60);
    const seconds = Math.floor(estimatedSeconds % 60);

    return `~${hours}h ${minutes}m ${seconds}s`;
  }

  /**
   * Run full test suite and generate report
   */
  async runFullTest(): Promise<PerformanceReport> {
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║  Realingo Performance Test Suite v2    ║');
    console.log('║  Testing GraphQL API Capacity & Speed  ║');
    console.log('╚════════════════════════════════════════╝\n');

    const testStartTime = Date.now();

    try {
      const capacity = await this.testCapacity();
      const speed = await this.testSpeed();
      const rateLimits = await this.testRateLimiting();

      const testEndTime = Date.now();
      const testDuration = (testEndTime - testStartTime) / 1000;

      const estimatedTime = this.estimateScrapeTime(capacity, speed);

      const recommendations: string[] = [];

      // Generate recommendations based on results
      if (capacity.maxItemsPerQuery >= 1000) {
        recommendations.push('✓ API supports batch size of 1000+. Can fetch up to 1000 items per query efficiently.');
      } else if (capacity.maxItemsPerQuery >= 100) {
        recommendations.push('✓ API supports batch size of 100+. Use batches of 100-500 for efficient scraping.');
      }

      if (speed.overallItemsPerSecond > 20) {
        recommendations.push('✓ API is very fast (>20 items/s). Can reduce delays between requests to 100ms.');
      } else if (speed.overallItemsPerSecond > 5) {
        recommendations.push('✓ API is reasonably fast (5-20 items/s). Current 500ms delay is reasonable.');
      } else if (speed.overallItemsPerSecond > 0) {
        recommendations.push('⚠ API is slower than expected (<5 items/s). May want to increase delays for stability.');
      }

      if (rateLimits.rateLimited) {
        recommendations.push(
          `⚠ Rate limiting detected. Use exponential backoff and respect Retry-After: ${rateLimits.retryAfter}s`
        );
      } else {
        recommendations.push('✓ No rate limiting detected. API is generous with rate limits.');
      }

      // Pagination recommendation
      if (capacity.maxItemsPerQuery >= 1000) {
        recommendations.push('✓ Use cursor-based pagination with first=1000 to minimize query count (~68 queries total).');
      }

      const summary = `
═══════════════════════════════════════════════════════════
REALINGO PERFORMANCE TEST RESULTS
═══════════════════════════════════════════════════════════

📊 CAPACITY:
  • Total listings: ${capacity.totalListingsAvailable.toLocaleString()}
  • By purpose: SELL=${capacity.byPurpose['SELL'] || 0}, RENT=${capacity.byPurpose['RENT'] || 0}
  • Max items per query: ${capacity.maxItemsPerQuery}
  • Estimated number of queries needed: ~${Math.ceil(capacity.totalListingsAvailable / capacity.maxItemsPerQuery)}

⚡ SPEED:
  • Queries executed: ${speed.queryCount}
  • Average query time: ${speed.averageQueryDuration.toFixed(0)}ms
  • Overall throughput: ${speed.overallItemsPerSecond.toFixed(1)} items/second
  • Fastest query: ${speed.fastestQuery}ms
  • Slowest query: ${speed.slowestQuery}ms

🔒 RATE LIMITS:
  • Rate limited: ${rateLimits.rateLimited ? 'Yes' : 'No'}
  • 429 errors: ${rateLimits.observed429Errors}
  • 503 errors: ${rateLimits.observed503Errors}

⏱️  SCRAPING ESTIMATES:
  • Estimated time (with 500ms delay): ${estimatedTime}
  • Recommended batch size: ${capacity.maxItemsPerQuery}

═══════════════════════════════════════════════════════════
`;

      const report: PerformanceReport = {
        timestamp: new Date().toISOString(),
        testDuration,
        capacity,
        speed,
        rateLimits,
        queryMetrics: this.metrics,
        recommendations,
        estimatedScrapeTime: estimatedTime,
        summary
      };

      console.log(summary);

      return report;
    } catch (error: any) {
      console.error('Test failed:', error.message);
      throw error;
    }
  }
}

/**
 * Main execution
 */
async function main() {
  const tester = new RealingoPerformanceTester();

  try {
    const report = await tester.runFullTest();

    // Save report to file
    const reportPath = '/Users/samuelseidel/Development/landomo-world/scrapers/Czech Republic/realingo/PERFORMANCE_REPORT_V2.json';
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log(`\n✓ Detailed report saved to: PERFORMANCE_REPORT_V2.json\n`);
    console.log('RECOMMENDATIONS:');
    report.recommendations.forEach(rec => console.log(`  ${rec}`));
  } catch (error: any) {
    console.error('\n✗ Failed to run performance test:', error.message);
    process.exit(1);
  }
}

main();
