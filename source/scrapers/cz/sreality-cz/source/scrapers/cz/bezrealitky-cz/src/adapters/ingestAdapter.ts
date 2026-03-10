import axios from 'axios';
import {
  StandardProperty,
  IngestionPayload,
  ApartmentPropertyTierI,
  HousePropertyTierI,
  LandPropertyTierI,
  CommercialPropertyTierI
} from '@landomo/core';

// Union type for all category-specific property types
export type CategoryProperty =
  | ApartmentPropertyTierI
  | HousePropertyTierI
  | LandPropertyTierI
  | CommercialPropertyTierI;

export interface PropertyPayload {
  portalId: string;
  data: CategoryProperty;  // Changed from StandardProperty to preserve property_category
  rawData: any;
}

export class IngestAdapter {
  private baseUrl: string;
  private apiKey: string;
  private portal: string;
  private maxRetries: number;
  private initialRetryDelay: number;
  private timeout: number;

  constructor(portal: string) {
    this.portal = portal;
    this.baseUrl = process.env.INGEST_API_URL || 'http://cz-ingest:3000';
    this.apiKey = process.env[`INGEST_API_KEY_${portal.toUpperCase().replace(/-/g, '_')}`] || process.env.INGEST_API_KEY || 'dev_key_cz_1';

    // Retry configuration
    this.maxRetries = parseInt(process.env.MAX_RETRIES || '3', 10);
    this.initialRetryDelay = parseInt(process.env.INITIAL_RETRY_DELAY || '1000', 10); // 1 second
    this.timeout = parseInt(process.env.INGEST_TIMEOUT || '60000', 10); // 60 seconds default
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    // Retry on network errors, timeouts, and 5xx server errors
    if (!error.response) {
      // Network errors (ECONNREFUSED, ETIMEDOUT, etc.)
      return true;
    }

    const status = error.response.status;
    // Retry on 5xx server errors and 429 (rate limit)
    return status >= 500 || status === 429;
  }

  /**
   * Sleep for specified milliseconds
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoff(attempt: number): number {
    // Exponential backoff: initialDelay * 2^attempt + random jitter
    const exponentialDelay = this.initialRetryDelay * Math.pow(2, attempt);
    const jitter = Math.random() * 1000; // Add 0-1s jitter to prevent thundering herd
    return Math.min(exponentialDelay + jitter, 30000); // Cap at 30 seconds
  }

  /**
   * Send properties to ingest API with retry logic
   * Implements exponential backoff for retryable errors
   */
  async sendProperties(properties: PropertyPayload[], scrapeRunId?: string): Promise<void> {
    if (properties.length === 0) {
      return;
    }

    const payload: any = {
      portal: this.portal,
      country: 'cz',
      properties: properties.map(p => ({
        portal_id: p.portalId,
        data: p.data,
        raw_data: p.rawData
      }))
    };
    if (scrapeRunId) payload.scrape_run_id = scrapeRunId;

    let lastError: any;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await axios.post(
          `${this.baseUrl}/api/v1/properties/bulk-ingest`,
          payload,
          {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json'
            },
            timeout: this.timeout
          }
        );

        // Success!
        console.log(JSON.stringify({ level: 'info', service: 'bezrealitky-scraper', msg: 'Batch sent to ingest', count: properties.length, retries: attempt }));
        return response.data;

      } catch (error: any) {
        lastError = error;
        const isLastAttempt = attempt === this.maxRetries;

        // Determine if we should retry
        if (!this.isRetryableError(error)) {
          // Non-retryable error (4xx client errors except 429)
          console.error(JSON.stringify({ level: 'error', service: 'bezrealitky-scraper', msg: 'Non-retryable error sending batch', count: properties.length, err: error.message, status: error.response?.status, statusText: error.response?.statusText }));
          throw error;
        }

        if (isLastAttempt) {
          // Max retries reached
          console.error(JSON.stringify({ level: 'error', service: 'bezrealitky-scraper', msg: 'Failed to send batch after max retries', count: properties.length, attempts: this.maxRetries + 1 }));
          break;
        }

        // Calculate backoff delay
        const backoffDelay = this.calculateBackoff(attempt);

        // Log retry attempt
        console.error(JSON.stringify({ level: 'error', service: 'bezrealitky-scraper', msg: 'Attempt failed, retrying', attempt: attempt + 1, maxAttempts: this.maxRetries + 1, err: error.message || error.code, status: error.response?.status, statusText: error.response?.statusText, retryInMs: Math.round(backoffDelay) }));

        // Wait before retry
        await this.sleep(backoffDelay);
      }
    }

    // If we get here, all retries failed
    if (lastError.response) {
      console.error(JSON.stringify({ level: 'error', service: 'bezrealitky-scraper', msg: 'Final error response', status: lastError.response.status, statusText: lastError.response.statusText }));
    } else if (lastError.request) {
      console.error(JSON.stringify({ level: 'error', service: 'bezrealitky-scraper', msg: 'Final error: no response received', code: lastError.code }));
    } else {
      console.error(JSON.stringify({ level: 'error', service: 'bezrealitky-scraper', msg: 'Final error setting up request', err: lastError.message }));
    }

    throw lastError;
  }

  /**
   * Send a single property to ingest API
   */
  async sendProperty(property: PropertyPayload, scrapeRunId?: string): Promise<void> {
    return this.sendProperties([property], scrapeRunId);
  }
}
