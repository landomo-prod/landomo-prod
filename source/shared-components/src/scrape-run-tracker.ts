/**
 * ScrapeRunTracker - Best-effort scrape run lifecycle tracking.
 * Used by scrapers to report run start/complete/fail to the ingest service.
 * All calls are non-blocking and failure-tolerant.
 */

import axios from 'axios';

export interface ScrapeRunStats {
  listings_found: number;
  listings_new: number;
  listings_updated: number;
}

export class ScrapeRunTracker {
  private runId: string | null = null;
  private baseUrl: string;
  private apiKey: string;

  constructor(
    private portal: string,
    options?: { baseUrl?: string; apiKey?: string }
  ) {
    this.baseUrl = options?.baseUrl || process.env.INGEST_API_URL || 'http://localhost:3000';
    const envKey = process.env.INGEST_API_KEY || '';
    this.apiKey = options?.apiKey || envKey.split(',')[0].trim();
  }

  /** Start a scrape run. Returns run ID or null on failure. */
  async start(): Promise<string | null> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/api/v1/scrape-runs/start`,
        { portal: this.portal },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 5000,
        }
      );
      this.runId = response.data.run_id;
      return this.runId;
    } catch (error: any) {
      console.warn(`[ScrapeRunTracker] Failed to start run for ${this.portal}: ${error.message}`);
      return null;
    }
  }

  /** Mark run as completed with stats. No-op if start() failed. */
  async complete(stats: ScrapeRunStats): Promise<void> {
    if (!this.runId) return;
    try {
      await axios.post(
        `${this.baseUrl}/api/v1/scrape-runs/${this.runId}/complete`,
        stats,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 5000,
        }
      );
    } catch (error: any) {
      console.warn(`[ScrapeRunTracker] Failed to complete run ${this.runId}: ${error.message}`);
    }
  }

  /** Mark run as failed. No-op if start() failed. */
  async fail(): Promise<void> {
    if (!this.runId) return;
    try {
      await axios.post(
        `${this.baseUrl}/api/v1/scrape-runs/${this.runId}/fail`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 5000,
        }
      );
    } catch (error: any) {
      console.warn(`[ScrapeRunTracker] Failed to mark run ${this.runId} as failed: ${error.message}`);
    }
  }

  /** Get the current run ID (null if not started or start failed). */
  getRunId(): string | null {
    return this.runId;
  }
}
