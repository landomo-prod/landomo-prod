import axios, { AxiosError } from 'axios';
import { TransformedProperty } from '../transformers';

const INGEST_API_URL = process.env.INGEST_API_URL || 'http://ingest-denmark:3000';
const INGEST_API_KEY = process.env.INGEST_API_KEY || 'dev_key_dk_1';
const PORTAL = 'nybolig-dk';
const COUNTRY = process.env.INSTANCE_COUNTRY || 'dk';

const MAX_RETRIES = 3;
const RETRY_BASE_MS = 1000;

interface IngestPayload {
  portalId: string;
  property: TransformedProperty;
  rawData: object;
}

/**
 * Send a batch of properties to the ingest API with exponential backoff retry.
 */
export async function sendBatch(batch: IngestPayload[]): Promise<void> {
  if (batch.length === 0) return;

  const payload = {
    portal: PORTAL,
    country: COUNTRY,
    properties: batch.map(item => ({
      portal_id: item.portalId,
      data: item.property,
      raw_data: item.rawData,
    })),
  };

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await axios.post(
        `${INGEST_API_URL}/api/v1/properties/bulk-ingest`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${INGEST_API_KEY}`,
            'Content-Type': 'application/json',
          },
          timeout: 120_000,
        }
      );
      return;
    } catch (err) {
      const axiosErr = err as AxiosError;
      if (attempt === MAX_RETRIES) throw err;

      const isRetryable =
        !axiosErr.response || axiosErr.response.status >= 500 || axiosErr.code === 'ECONNRESET';
      if (!isRetryable) throw err;

      const delay = RETRY_BASE_MS * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
