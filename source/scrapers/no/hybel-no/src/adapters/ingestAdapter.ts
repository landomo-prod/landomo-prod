import axios from 'axios';
import { createLogger } from '@landomo/core';
import { TransformedProperty } from '../transformers';
import { HybelListingDetail } from '../types/hybelTypes';

const log = createLogger({ service: 'hybel-scraper', portal: 'hybel-no', country: 'norway' });

const INGEST_API_URL = process.env.INGEST_API_URL || 'http://ingest-norway:3000';
const INGEST_API_KEY = process.env.INGEST_API_KEY || '';
const BATCH_SIZE = parseInt(process.env.INGEST_BATCH_SIZE || '500', 10);
const PORTAL = 'hybel-no';
const COUNTRY_CODE = 'no';

export interface PropertyBatch {
  property: TransformedProperty;
  detail: HybelListingDetail;
}

/**
 * Send a batch of properties to the ingest API with exponential backoff retry.
 */
async function sendBatch(
  batch: PropertyBatch[],
  attempt = 1
): Promise<void> {
  const maxAttempts = 4;
  const payload = {
    portal: PORTAL,
    country: COUNTRY_CODE,
    properties: batch.map(({ property, detail }) => ({
      portal_id: `hybel-no-${detail.id}`,
      data: property,
      raw_data: detail,
    })),
  };

  try {
    await axios.post(
      `${INGEST_API_URL}/api/v1/properties/bulk-ingest`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${INGEST_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 120000,
      }
    );

    log.info({ count: batch.length, attempt }, 'Batch sent to ingest API');
  } catch (err: any) {
    const status = err.response?.status;
    const isRetryable = !status || status >= 500 || status === 429;

    if (isRetryable && attempt < maxAttempts) {
      const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 30000);
      log.warn(
        { attempt, backoffMs, status, err: err.message },
        'Ingest request failed, retrying'
      );
      await new Promise(resolve => setTimeout(resolve, backoffMs));
      return sendBatch(batch, attempt + 1);
    }

    log.error(
      { count: batch.length, status, err: err.message },
      'Failed to send batch to ingest API'
    );
    throw err;
  }
}

/**
 * Send all properties to the ingest API in batches.
 */
export async function sendToIngest(batches: PropertyBatch[]): Promise<{
  sent: number;
  failed: number;
}> {
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < batches.length; i += BATCH_SIZE) {
    const batch = batches.slice(i, i + BATCH_SIZE);
    try {
      await sendBatch(batch);
      sent += batch.length;
    } catch {
      failed += batch.length;
    }
  }

  return { sent, failed };
}
