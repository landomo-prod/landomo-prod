/**
 * Abstract Base Scraper
 *
 * Provides Express health endpoint, ScrapeRunTracker auto-wiring, and a
 * standard lifecycle for all Landomo scrapers. Scrapers extend this class
 * and implement the `scrape()` method.
 *
 * Usage:
 *   class MyScraper extends BaseScraper {
 *     async scrape() { ... return properties; }
 *   }
 *   const scraper = new MyScraper({ portal: 'willhaben', country: 'austria', port: 3020 });
 *   scraper.start();
 */

import http from 'http';
import { ScrapeRunTracker, ScrapeRunStats } from '../scrape-run-tracker';
import { IngestionPayload } from '../types';
import { HttpClient, HttpClientOptions } from './http-client';

export interface BaseScraperConfig {
  /** Portal identifier (e.g., 'willhaben', 'sreality') */
  portal: string;
  /** Country identifier (e.g., 'austria', 'czech') */
  country: string;
  /** HTTP server port for health endpoint (default: from PORT env or 3020) */
  port?: number;
  /** Ingest API URL (default: INGEST_API_URL env) */
  ingestUrl?: string;
  /** Ingest API key (default: INGEST_API_KEY env) */
  ingestApiKey?: string;
  /** Batch size for bulk-ingest calls (default: 50) */
  batchSize?: number;
  /** HTTP client options for scraping requests */
  httpClientOptions?: HttpClientOptions;
}

export interface ScrapeResult {
  portal_id: string;
  data: any;
  raw_data?: any;
}

export abstract class BaseScraper {
  protected config: Required<Pick<BaseScraperConfig, 'portal' | 'country' | 'port' | 'batchSize'>> & BaseScraperConfig;
  protected tracker: ScrapeRunTracker;
  protected httpClient: HttpClient;
  protected server: http.Server | null = null;
  private startTime: number = 0;

  constructor(config: BaseScraperConfig) {
    this.config = {
      ...config,
      port: config.port ?? parseInt(process.env.PORT || '3020', 10),
      batchSize: config.batchSize ?? 50,
    };

    this.tracker = new ScrapeRunTracker(this.config.portal, {
      baseUrl: this.config.ingestUrl || process.env.INGEST_API_URL,
      apiKey: this.config.ingestApiKey || process.env.INGEST_API_KEY,
    });

    this.httpClient = new HttpClient(config.httpClientOptions || {});
  }

  /**
   * Implement this method to perform the actual scraping.
   * Return an array of ScrapeResult objects.
   */
  abstract scrape(): Promise<ScrapeResult[]>;

  /**
   * Start the scraper: launch health endpoint server.
   * Does NOT automatically run a scrape -- call `run()` or wire it to POST /scrape.
   */
  start(): void {
    this.server = http.createServer((req, res) => {
      if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'ok',
          portal: this.config.portal,
          country: this.config.country,
          uptime: process.uptime(),
        }));
        return;
      }

      if (req.method === 'POST' && req.url === '/scrape') {
        res.writeHead(202, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'accepted' }));
        // Fire and forget
        this.run().catch(err => {
          console.error(`[${this.config.portal}] Scrape run failed:`, err.message);
        });
        return;
      }

      res.writeHead(404);
      res.end('Not found');
    });

    this.server.listen(this.config.port, () => {
      console.log(`[${this.config.portal}] Health server listening on port ${this.config.port}`);
    });
  }

  /**
   * Execute a full scrape run with lifecycle tracking.
   * Calls scrape(), sends results to ingest API, and reports to ScrapeRunTracker.
   */
  async run(): Promise<ScrapeRunStats> {
    this.startTime = Date.now();
    console.log(`[${this.config.portal}] Starting scrape run...`);

    await this.tracker.start();

    try {
      const results = await this.scrape();
      console.log(`[${this.config.portal}] Scrape returned ${results.length} properties`);

      // Send to ingest API in batches
      const stats = await this.sendToIngest(results);

      const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
      console.log(`[${this.config.portal}] Scrape run completed in ${elapsed}s: ${stats.listings_found} found, ${stats.listings_new} new`);

      await this.tracker.complete(stats);
      return stats;
    } catch (error: any) {
      console.error(`[${this.config.portal}] Scrape run failed:`, error.message);
      await this.tracker.fail();
      throw error;
    }
  }

  /**
   * Send scraped properties to the ingest API in batches.
   */
  protected async sendToIngest(results: ScrapeResult[]): Promise<ScrapeRunStats> {
    const ingestUrl = this.config.ingestUrl || process.env.INGEST_API_URL || 'http://localhost:3000';
    const apiKey = this.config.ingestApiKey || process.env.INGEST_API_KEY || '';

    const stats: ScrapeRunStats = {
      listings_found: results.length,
      listings_new: 0,
      listings_updated: 0,
    };

    // Send in batches
    for (let i = 0; i < results.length; i += this.config.batchSize) {
      const batch = results.slice(i, i + this.config.batchSize);

      const payload = {
        portal: this.config.portal,
        country: this.config.country,
        properties: batch.map(r => ({
          portal_id: r.portal_id,
          data: r.data,
          raw_data: r.raw_data,
        })),
      };

      try {
        const response = await new HttpClient({ timeout: 60000 }).post(
          `${ingestUrl}/api/v1/properties/bulk-ingest`,
          payload,
          {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
          }
        );

        const body = response.data;
        stats.listings_new += body.new_count || 0;
        stats.listings_updated += body.updated_count || 0;
      } catch (error: any) {
        console.error(`[${this.config.portal}] Batch ingest failed (items ${i}-${i + batch.length}):`, error.message);
      }
    }

    return stats;
  }

  /** Stop the health server */
  stop(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }
}
