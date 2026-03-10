import axios from 'axios';

/**
 * Realingo Performance Test Suite
 * Tests GraphQL API capacity, speed, and rate limiting
 */

interface PerformanceMetrics {
  queryType: string;
  purpose?: string;
  property?: string;
  limit: number;
  offset: number;
  startTime: number;
  endTime: number;
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
  queryMetrics: PerformanceMetrics[];
  recommendations: string[];
  summary: string;
}

class RealingoPerformanceTester {
  private graphqlUrl = 'https://www.realingo.cz/graphql';
  private metrics: PerformanceMetrics[] = [];
  private axiosInstance = axios.create({
    baseURL: this.graphqlUrl,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    }
  });

  /**
   * Search query for fetching listings
   */
  private getSearchOfferQuery(): string {
    return `
      query SearchOffer(
        $purpose: OfferPurpose,
        $property: PropertyType,
        $limit: Int,
        $offset: Int
      ) {
        searchOffer(
          filter: {
            purpose: $purpose
            property: $property
          }
          limit: $limit
          offset: $offset
        ) {
          total
          items {
            id
            title
            purpose
            property
            price
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
    queryType: string
  ): Promise<PerformanceMetrics | null> {
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

      const metric: PerformanceMetrics = {
        queryType,
        purpose: variables.purpose,
        property: variables.property,
        limit: variables.limit,
        offset: variables.offset,
        startTime,
        endTime,
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

      const metric: PerformanceMetrics = {
        queryType,
        purpose: variables.purpose,
        property: variables.property,
        limit: variables.limit,
        offset: variables.offset,
        startTime,
        endTime,
        duration,
        itemsReturned: 0,
        totalAvailable: 0,
        itemsPerSecond: 0,
        success: false,
        error: error.message
      };

      this.metrics.push(metric);
      return metric;
    }
  }

  /**
   * Test capacity: find total listings available
   */
  async testCapacity(): Promise<CapacityResults> {
    console.log('\n=== Testing Capacity ===\n');

    const purposes = ['SALE', 'RENT'];
    const properties = ['FLAT', 'HOUSE', 'LAND', 'COMMERCIAL', 'OTHER'];

    const results: CapacityResults = {
      totalListingsAvailable: 0,
      byPurpose: {},
      byProperty: {},
      byPurposeAndProperty: {},
      maxItemsPerQuery: 0
    };

    // Test total without filters
    console.log('Testing total listings (no filters)...');
    const totalMetric = await this.executeQuery(
      { limit: 1, offset: 0 },
      'total'
    );

    if (totalMetric?.success) {
      results.totalListingsAvailable = totalMetric.totalAvailable;
      console.log(`Total listings available: ${totalMetric.totalAvailable}`);
    }

    // Test by purpose
    for (const purpose of purposes) {
      console.log(`\nTesting ${purpose}...`);
      const metric = await this.executeQuery(
        { purpose, limit: 1, offset: 0 },
        `by_purpose_${purpose}`
      );

      if (metric?.success) {
        results.byPurpose[purpose] = metric.totalAvailable;
        console.log(`  ${purpose}: ${metric.totalAvailable}`);
      }
    }

    // Test by property type
    for (const property of properties) {
      console.log(`Testing ${property}...`);
      const metric = await this.executeQuery(
        { property, limit: 1, offset: 0 },
        `by_property_${property}`
      );

      if (metric?.success) {
        results.byProperty[property] = metric.totalAvailable;
        console.log(`  ${property}: ${metric.totalAvailable}`);
      }
    }

    // Test by purpose and property combination
    console.log('\nTesting combinations...');
    for (const purpose of purposes) {
      results.byPurposeAndProperty[purpose] = {};

      for (const property of properties) {
        const metric = await this.executeQuery(
          { purpose, property, limit: 1, offset: 0 },
          `${purpose}_${property}`
        );

        if (metric?.success) {
          results.byPurposeAndProperty[purpose][property] = metric.totalAvailable;
          console.log(`  ${purpose} + ${property}: ${metric.totalAvailable}`);
        }

        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Test maximum items per single query
    console.log('\nTesting max items per query...');
    for (const limit of [50, 100, 200, 300, 500]) {
      const metric = await this.executeQuery(
        { limit, offset: 0 },
        `max_items_${limit}`
      );

      if (metric?.success && metric.itemsReturned === limit) {
        results.maxItemsPerQuery = limit;
        console.log(`  Limit ${limit}: SUCCESS (${metric.itemsReturned} items)`);
      } else if (metric?.success) {
        console.log(`  Limit ${limit}: PARTIAL (requested ${limit}, got ${metric.itemsReturned})`);
        if (results.maxItemsPerQuery < metric.itemsReturned) {
          results.maxItemsPerQuery = metric.itemsReturned;
        }
      } else {
        console.log(`  Limit ${limit}: FAILED`);
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return results;
  }

  /**
   * Test speed: measure query response times and throughput
   */
  async testSpeed(): Promise<SpeedResults> {
    console.log('\n=== Testing Speed ===\n');

    // Fetch listings with different offsets to measure consistency
    const speeds: PerformanceMetrics[] = [];

    console.log('Testing query speed with pagination...');
    for (let offset = 0; offset < 500; offset += 100) {
      const metric = await this.executeQuery(
        { limit: 100, offset },
        'speed_test'
      );

      if (metric?.success) {
        speeds.push(metric);
        console.log(`Offset ${offset}: ${metric.duration}ms (${metric.itemsPerSecond.toFixed(2)} items/s)`);
      }

      // Respectful delay
      if (offset < 400) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    const totalDuration = speeds.reduce((sum, m) => sum + m.duration, 0);
    const totalItems = speeds.reduce((sum, m) => sum + m.itemsReturned, 0);
    const durations = speeds.map(m => m.duration).sort((a, b) => a - b);

    return {
      queryCount: speeds.length,
      totalDuration,
      averageQueryDuration: speeds.length > 0 ? totalDuration / speeds.length : 0,
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
    console.log('\n=== Testing Rate Limits ===\n');

    const results: RateLimitResults = {
      rateLimited: false,
      queueDelayMs: 0,
      maxConcurrentQueries: 0,
      observed429Errors: 0,
      observed503Errors: 0
    };

    // Test rapid consecutive requests
    console.log('Testing rapid consecutive requests...');
    const rapidResults: PerformanceMetrics[] = [];

    for (let i = 0; i < 20; i++) {
      try {
        const response = await this.axiosInstance.post('', {
          query: this.getSearchOfferQuery(),
          variables: { limit: 10, offset: 0 }
        });

        console.log(`Request ${i + 1}: OK`);

        if (response.status === 429) {
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
          console.log(`Request ${i + 1}: Rate limited (429)`);
          const retryAfter = error.response.headers['retry-after'];
          if (retryAfter) {
            results.retryAfter = parseInt(retryAfter);
          }
        } else if (error.response?.status === 503) {
          results.observed503Errors++;
          console.log(`Request ${i + 1}: Service unavailable (503)`);
        } else {
          console.log(`Request ${i + 1}: Error - ${error.message}`);
        }
      }

      // No delay - testing rapid fire
      if (results.observed429Errors > 0 || results.observed503Errors > 0) {
        console.log('Rate limiting detected. Stopping rapid test.');
        break;
      }
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
    const estimatedSeconds = totalItems / itemsPerSecond;

    const hours = Math.floor(estimatedSeconds / 3600);
    const minutes = Math.floor((estimatedSeconds % 3600) / 60);
    const seconds = Math.floor(estimatedSeconds % 60);

    return `${hours}h ${minutes}m ${seconds}s`;
  }

  /**
   * Run full test suite and generate report
   */
  async runFullTest(): Promise<PerformanceReport> {
    console.log('\n========================================');
    console.log('Realingo Performance Test Suite');
    console.log('========================================\n');

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
      if (capacity.maxItemsPerQuery >= 100) {
        recommendations.push('API supports batch size of 100+. Use this for efficient scraping.');
      }

      if (speed.overallItemsPerSecond > 10) {
        recommendations.push('API is fast. Consider reducing delays between requests.');
      } else if (speed.overallItemsPerSecond < 1) {
        recommendations.push('API is slow. Increase delays to be respectful to the service.');
      }

      if (rateLimits.rateLimited) {
        recommendations.push(
          `Rate limiting detected. Implement exponential backoff. Retry-After: ${rateLimits.retryAfter}s`
        );
      } else {
        recommendations.push('No rate limiting detected in test. Current 500ms delay is safe.');
      }

      const summary = `
Performance Test Results:
- Total listings available: ${capacity.totalListingsAvailable}
- Queries executed: ${speed.queryCount}
- Overall speed: ${speed.overallItemsPerSecond.toFixed(2)} items/second
- Estimated scrape time: ${estimatedTime}
- Rate limited: ${rateLimits.rateLimited ? 'Yes' : 'No'}
`;

      const report: PerformanceReport = {
        timestamp: new Date().toISOString(),
        testDuration,
        capacity,
        speed,
        rateLimits,
        queryMetrics: this.metrics,
        recommendations,
        summary
      };

      console.log('\n========================================');
      console.log('Test Complete');
      console.log('========================================');
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
    const fs = await import('fs');
    const reportPath = '/Users/samuelseidel/Development/landomo-world/scrapers/Czech Republic/realingo/PERFORMANCE_REPORT.json';
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log(`\nReport saved to: ${reportPath}`);
    console.log('\nKey Findings:');
    console.log(`- Total Listings: ${report.capacity.totalListingsAvailable}`);
    console.log(`- By Purpose: ${JSON.stringify(report.capacity.byPurpose)}`);
    console.log(`- By Property: ${JSON.stringify(report.capacity.byProperty)}`);
    console.log(`- Speed: ${report.speed.overallItemsPerSecond.toFixed(2)} items/second`);
    console.log(`- Max Items Per Query: ${report.capacity.maxItemsPerQuery}`);
    console.log('\nRecommendations:');
    report.recommendations.forEach(rec => console.log(`- ${rec}`));
  } catch (error: any) {
    console.error('Failed to run performance test:', error.message);
    process.exit(1);
  }
}

main();
