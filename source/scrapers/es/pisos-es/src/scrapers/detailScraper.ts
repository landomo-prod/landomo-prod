import pLimit from 'p-limit';
import { pisosRateLimiter } from '../utils/rateLimiter';
import { fetchDetailPage } from '../utils/fetchData';
import { PisosDetailRaw } from '../types/pisosTypes';
import { getRandomDelay } from '../utils/headers';

const CONCURRENT_DETAILS = parseInt(process.env.CONCURRENT_DETAILS || '30');

export interface DetailFetchResult {
  portalId: string;
  detail?: PisosDetailRaw;
  error?: string;
}

/**
 * Fetch details for multiple listings with bounded concurrency
 */
export async function fetchDetailsBatch(
  listings: Array<{ portalId: string; detailUrl: string }>,
  onProgress?: (current: number, total: number) => void
): Promise<Map<string, DetailFetchResult>> {
  const limit = pLimit(CONCURRENT_DETAILS);
  const results = new Map<string, DetailFetchResult>();
  let completed = 0;

  const tasks = listings.map(listing =>
    limit(async (): Promise<void> => {
      try {
        const detail = await fetchDetailPage(listing.detailUrl);

        results.set(listing.portalId, {
          portalId: listing.portalId,
          detail: detail || undefined,
        });
      } catch (error: any) {
        console.error(JSON.stringify({
          level: 'error',
          service: 'pisos-com-scraper',
          msg: 'Failed to fetch detail',
          portalId: listing.portalId,
          err: error.message,
        }));

        results.set(listing.portalId, {
          portalId: listing.portalId,
          error: error.message,
        });
      }

      completed++;
      if (onProgress && completed % 50 === 0) {
        onProgress(completed, listings.length);
      }
    })
  );

  await Promise.all(tasks);
  return results;
}

export function getDetailFetchStats(results: Map<string, DetailFetchResult>) {
  let successful = 0;
  let failed = 0;

  results.forEach(result => {
    if (result.error) failed++;
    else if (result.detail) successful++;
  });

  return {
    total: results.size,
    successful,
    failed,
    successRate: results.size > 0 ? (successful / results.size * 100).toFixed(1) : '0.0',
  };
}
