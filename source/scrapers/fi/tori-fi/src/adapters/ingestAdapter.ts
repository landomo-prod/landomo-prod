import axios, { AxiosError } from 'axios';

export interface PropertyPayload {
  portalId: string;
  data: any;
  rawData: any;
}

const INGEST_API_URL = process.env.INGEST_API_URL || 'http://ingest-finland:3000';
const INGEST_API_KEY = process.env.INGEST_API_KEY || 'dev_key_fi_1';
const INSTANCE_COUNTRY = process.env.INSTANCE_COUNTRY || 'fi';
const PORTAL = 'oikotie';

/**
 * Send a batch of transformed property objects to the ingest service.
 * Implements exponential backoff: retries up to 3 times with delays of
 * 1 s, 2 s, 4 s before giving up and rethrowing.
 */
export async function sendBatch(properties: PropertyPayload[]): Promise<void> {
  if (properties.length === 0) return;

  const payload = {
    portal: PORTAL,
    country: INSTANCE_COUNTRY,
    properties: properties.map(p => ({
      portal_id: p.portalId,
      data: p.data,
      raw_data: p.rawData,
    })),
  };

  const maxRetries = 3;
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (attempt > 0) {
      const delay = Math.pow(2, attempt - 1) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }

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
      lastError = axiosErr;

      // Do not retry on client errors (4xx)
      if (axiosErr.response && axiosErr.response.status >= 400 && axiosErr.response.status < 500) {
        throw axiosErr;
      }
    }
  }

  throw lastError;
}
