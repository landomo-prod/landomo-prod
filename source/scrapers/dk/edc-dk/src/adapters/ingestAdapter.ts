import axios, { AxiosInstance } from 'axios';
import { TransformedProperty } from '../transformers';

const MAX_RETRIES = 3;
const RETRY_DELAY_BASE_MS = 1000;

export class IngestAdapter {
  private readonly client: AxiosInstance;
  private readonly apiKey: string;
  private readonly portal: string;
  private readonly country: string;

  constructor() {
    this.portal = 'edc-dk';
    this.country = process.env.INSTANCE_COUNTRY || 'dk';
    const baseUrl = process.env.INGEST_API_URL || 'http://ingest-denmark:3000';
    this.apiKey = process.env.INGEST_API_KEY || 'dev_key_dk_1';

    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 120_000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
    });
  }

  async sendBatch(properties: TransformedProperty[]): Promise<{ inserted: number; updated: number; errors: number }> {
    if (properties.length === 0) {
      return { inserted: 0, updated: 0, errors: 0 };
    }

    const payload = {
      portal: this.portal,
      country: this.country,
      properties: properties.map(p => ({
        portal_id: (p as any).portal_id,
        data: p,
        raw_data: p,
      })),
    };

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await this.client.post('/api/v1/properties/bulk-ingest', payload);
        const data = response.data as any;
        return {
          inserted: data.inserted ?? 0,
          updated: data.updated ?? 0,
          errors: data.errors ?? 0,
        };
      } catch (err: any) {
        const status = err.response?.status;
        const isRetryable = !status || status >= 500 || status === 429;

        if (attempt === MAX_RETRIES || !isRetryable) {
          console.error(JSON.stringify({
            level: 'error',
            service: 'edc-dk-scraper',
            msg: 'Ingest failed after retries',
            attempt,
            status,
            err: err.message,
          }));
          throw err;
        }

        const delay = RETRY_DELAY_BASE_MS * Math.pow(2, attempt - 1);
        console.warn(JSON.stringify({
          level: 'warn',
          service: 'edc-dk-scraper',
          msg: `Ingest attempt ${attempt} failed, retrying in ${delay}ms`,
          status,
        }));
        await new Promise(r => setTimeout(r, delay));
      }
    }

    // Should never reach here
    return { inserted: 0, updated: 0, errors: properties.length };
  }
}
