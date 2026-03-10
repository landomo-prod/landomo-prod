import axios, { AxiosInstance } from 'axios';
import { createLogger } from '@landomo/core';
import { TierIProperty } from '../transformers';

const log = createLogger({ service: 'home-dk-ingest-adapter', portal: 'home-dk' });

const INGEST_API_URL = process.env.INGEST_API_URL || 'http://ingest-denmark:3000';
const INGEST_API_KEY = process.env.INGEST_API_KEY || 'dev_key_dk_1';
const INSTANCE_COUNTRY = process.env.INSTANCE_COUNTRY || 'dk';
const PORTAL = 'home-dk';
const BATCH_SIZE = parseInt(process.env.INGEST_BATCH_SIZE || '500', 10);

const MAX_RETRIES = 3;
const RETRY_DELAY_BASE_MS = 1000;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function createClient(): AxiosInstance {
  return axios.create({
    baseURL: INGEST_API_URL,
    timeout: 120000,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${INGEST_API_KEY}`,
    },
  });
}

interface IngestPayload {
  portal: string;
  country: string;
  properties: Array<{
    portal_id: string;
    data: TierIProperty;
    raw_data: Record<string, unknown>;
  }>;
}

/**
 * Send a batch of properties to the ingest service with exponential backoff.
 */
async function sendBatch(
  client: AxiosInstance,
  payload: IngestPayload,
  attempt = 1,
): Promise<void> {
  try {
    await client.post('/api/v1/properties/bulk-ingest', payload);
    log.info({ count: payload.properties.length }, 'Batch ingested successfully');
  } catch (err: any) {
    const status = err.response?.status;
    const isRetryable = !status || status >= 500 || status === 429;

    if (isRetryable && attempt < MAX_RETRIES) {
      const delay = RETRY_DELAY_BASE_MS * Math.pow(2, attempt - 1);
      log.warn(
        { attempt, delay, status, err: err.message },
        'Ingest failed, retrying',
      );
      await sleep(delay);
      return sendBatch(client, payload, attempt + 1);
    }

    log.error(
      { err: err.message, status, batchSize: payload.properties.length },
      'Ingest batch failed permanently',
    );
    throw err;
  }
}

/**
 * Ingest a list of transformed properties in batches.
 * Each property is paired with its portal_id from the TierI data.
 */
export async function ingestProperties(properties: TierIProperty[]): Promise<void> {
  if (properties.length === 0) return;

  const client = createClient();
  const batches: TierIProperty[][] = [];

  for (let i = 0; i < properties.length; i += BATCH_SIZE) {
    batches.push(properties.slice(i, i + BATCH_SIZE));
  }

  log.info(
    { total: properties.length, batches: batches.length, batchSize: BATCH_SIZE },
    'Starting ingest',
  );

  let ingested = 0;
  let failed = 0;

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];

    const payload: IngestPayload = {
      portal: PORTAL,
      country: INSTANCE_COUNTRY,
      properties: batch.map(prop => ({
        portal_id: (prop as any).portal_id ?? `home-dk-${i}`,
        data: prop,
        raw_data: {},
      })),
    };

    try {
      await sendBatch(client, payload);
      ingested += batch.length;
      log.info(
        { batch: i + 1, total: batches.length, ingested },
        'Batch sent',
      );
    } catch {
      failed += batch.length;
      log.error({ batch: i + 1, failed }, 'Batch permanently failed');
    }
  }

  log.info({ ingested, failed, total: properties.length }, 'Ingest complete');
}
