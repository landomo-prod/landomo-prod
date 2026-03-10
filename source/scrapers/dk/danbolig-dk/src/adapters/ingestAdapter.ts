import axios, { AxiosError } from 'axios';
import { AnyTierIProperty } from '../transformers';

export interface IngestPayload {
  portalId: string;
  data: AnyTierIProperty;
  rawData: Record<string, unknown>;
}

const BASE_URL = process.env.INGEST_API_URL || 'http://ingest-denmark:3000';
const API_KEY = process.env.INGEST_API_KEY || 'dev_key_dk_1';
const PORTAL = 'danbolig-dk';
const COUNTRY = process.env.INSTANCE_COUNTRY || 'dk';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Send a batch of properties to the ingest API with exponential backoff.
 */
export async function sendBatch(properties: IngestPayload[]): Promise<void> {
  if (properties.length === 0) return;

  const payload = {
    portal: PORTAL,
    country: COUNTRY,
    properties: properties.map(p => ({
      portal_id: p.portalId,
      data: p.data,
      raw_data: p.rawData,
    })),
  };

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await axios.post(
        `${BASE_URL}/api/v1/properties/bulk-ingest`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${API_KEY}`,
            'Content-Type': 'application/json',
          },
          timeout: 120_000,
        }
      );
      return;
    } catch (err) {
      const axiosErr = err as AxiosError;
      const status = axiosErr.response?.status;

      // Do not retry on 4xx client errors (except 429 rate limit)
      if (status && status >= 400 && status < 500 && status !== 429) {
        throw new Error(
          `Ingest API rejected batch (HTTP ${status}): ${JSON.stringify(axiosErr.response?.data)}`
        );
      }

      if (attempt < MAX_RETRIES) {
        const delayMs = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        console.warn(
          JSON.stringify({
            level: 'warn',
            service: 'danbolig-dk-scraper',
            msg: 'Ingest retry',
            attempt,
            maxRetries: MAX_RETRIES,
            status,
            delayMs,
          })
        );
        await sleep(delayMs);
      } else {
        throw new Error(
          `Ingest API failed after ${MAX_RETRIES} attempts: ${axiosErr.message}`
        );
      }
    }
  }
}
