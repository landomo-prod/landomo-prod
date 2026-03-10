import axios from 'axios';
import {
  ApartmentPropertyTierI,
  HousePropertyTierI,
  LandPropertyTierI,
  CommercialPropertyTierI,
} from '@landomo/core';

export type CategoryProperty =
  | ApartmentPropertyTierI
  | HousePropertyTierI
  | LandPropertyTierI
  | CommercialPropertyTierI;

export interface PropertyPayload {
  portalId: string;
  data: CategoryProperty;
  rawData: unknown;
}

/**
 * IngestAdapter for Finland / Kiinteistömaailma.fi
 *
 * Posts property batches to the Finland ingest service.
 * Country code: 'fi'
 * Default ingest URL: http://ingest-finland:3000
 */
export class IngestAdapter {
  private baseUrl: string;
  private apiKey: string;
  private portal: string;
  private maxRetries: number;
  private initialRetryDelay: number;
  private timeout: number;

  constructor(portal: string) {
    this.portal = portal;
    this.baseUrl = process.env.INGEST_API_URL || 'http://ingest-finland:3000';
    this.apiKey =
      process.env[`INGEST_API_KEY_${portal.toUpperCase().replace(/-/g, '_')}`] ||
      process.env.INGEST_API_KEY ||
      'dev_key_fi_1';

    this.maxRetries = parseInt(process.env.MAX_RETRIES || '3', 10);
    this.initialRetryDelay = parseInt(process.env.INITIAL_RETRY_DELAY || '1000', 10);
    this.timeout = parseInt(process.env.INGEST_TIMEOUT || '60000', 10);
  }

  private isRetryableError(error: any): boolean {
    if (!error.response) return true; // Network errors are retryable
    const status = error.response.status;
    return status >= 500 || status === 429;
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private calculateBackoff(attempt: number): number {
    const exponentialDelay = this.initialRetryDelay * Math.pow(2, attempt);
    const jitter = Math.random() * 1000;
    return Math.min(exponentialDelay + jitter, 30000);
  }

  /**
   * Send a batch of properties to the ingest API with exponential backoff retry.
   */
  async sendProperties(properties: PropertyPayload[], scrapeRunId?: string): Promise<void> {
    if (properties.length === 0) return;

    const payload: Record<string, unknown> = {
      portal: this.portal,
      country: 'fi',
      properties: properties.map(p => ({
        portal_id: p.portalId,
        data: p.data,
        raw_data: p.rawData,
      })),
    };

    if (scrapeRunId) payload.scrape_run_id = scrapeRunId;

    let lastError: any;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        await axios.post(`${this.baseUrl}/api/v1/properties/bulk-ingest`, payload, {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: this.timeout,
        });

        console.log(JSON.stringify({
          level: 'info',
          service: 'kiinteistomaailma-fi-scraper',
          msg: 'Batch sent to ingest',
          count: properties.length,
          retries: attempt,
        }));
        return;
      } catch (error: any) {
        lastError = error;
        const isLastAttempt = attempt === this.maxRetries;

        if (!this.isRetryableError(error)) {
          console.error(JSON.stringify({
            level: 'error',
            service: 'kiinteistomaailma-fi-scraper',
            msg: 'Non-retryable ingest error',
            count: properties.length,
            err: error.message,
            status: error.response?.status,
          }));
          throw error;
        }

        if (isLastAttempt) {
          console.error(JSON.stringify({
            level: 'error',
            service: 'kiinteistomaailma-fi-scraper',
            msg: 'Failed to send batch after max retries',
            count: properties.length,
            attempts: this.maxRetries + 1,
          }));
          break;
        }

        const backoffDelay = this.calculateBackoff(attempt);
        console.error(JSON.stringify({
          level: 'warn',
          service: 'kiinteistomaailma-fi-scraper',
          msg: 'Ingest attempt failed, retrying',
          attempt: attempt + 1,
          maxAttempts: this.maxRetries + 1,
          err: error.message || error.code,
          status: error.response?.status,
          retryInMs: Math.round(backoffDelay),
        }));

        await this.sleep(backoffDelay);
      }
    }

    throw lastError;
  }

  async sendProperty(property: PropertyPayload, scrapeRunId?: string): Promise<void> {
    return this.sendProperties([property], scrapeRunId);
  }
}
