import pLimit from 'p-limit';
import { srealityRateLimiter } from '../utils/rateLimiter';
import { fetchEstateDetail, EstateDetailResult } from '../utils/fetchData';
import { getRealisticHeaders, getRandomDelay } from '../utils/headers';

// Configure concurrent detail fetches (can be overridden via env)
// Default: 200 concurrent workers (aggressive for 10-min completion target)
const CONCURRENT_DETAILS = parseInt(process.env.CONCURRENT_DETAILS || '200');

export interface DetailFetchResult {
  hashId: number;
  detail?: any;
  isInactive: boolean;
  inactiveReason?: 'http_410' | 'logged_in_false';
  error?: string;
}

/**
 * Fetch details for multiple properties with bounded concurrency and rate limiting
 *
 * @param hashIds - Array of property hash IDs to fetch
 * @param onProgress - Optional callback for progress tracking
 * @returns Map of hashId → detail data
 */
export async function fetchDetailsBatch(
  hashIds: number[],
  onProgress?: (current: number, total: number) => void
): Promise<Map<number, DetailFetchResult>> {
  const limit = pLimit(CONCURRENT_DETAILS);
  const results = new Map<number, DetailFetchResult>();

  let completed = 0;

  const tasks = hashIds.map(hashId =>
    limit(async (): Promise<void> => {
      // Apply rate limiting before each request
      await srealityRateLimiter.throttle();

      // Minimal jitter for speed (10-30ms only)
      await new Promise(resolve => setTimeout(resolve, getRandomDelay(10, 30)));

      try {
        // Generate fresh headers for EACH request (rotates user agent + other headers)
        const headers = getRealisticHeaders();
        const detailResult: EstateDetailResult = await fetchEstateDetail(hashId, headers);

        results.set(hashId, {
          hashId,
          detail: detailResult.data,
          isInactive: detailResult.isInactive,
          inactiveReason: detailResult.inactiveReason
        });

        completed++;
        if (onProgress) {
          onProgress(completed, hashIds.length);
        }
      } catch (error: any) {
        console.error(JSON.stringify({ level: 'error', service: 'sreality-scraper', msg: 'Failed to fetch detail', hashId, err: error.message }));

        // Store error but don't block other requests
        results.set(hashId, {
          hashId,
          isInactive: false,
          error: error.message
        });

        completed++;
        if (onProgress) {
          onProgress(completed, hashIds.length);
        }
      }
    })
  );

  await Promise.all(tasks);

  return results;
}

/**
 * Get statistics about detail fetch results
 */
export function getDetailFetchStats(results: Map<number, DetailFetchResult>) {
  let successful = 0;
  let inactive = 0;
  let failed = 0;

  results.forEach(result => {
    if (result.error) {
      failed++;
    } else if (result.isInactive) {
      inactive++;
    } else if (result.detail) {
      successful++;
    }
  });

  return {
    total: results.size,
    successful,
    inactive,
    failed,
    successRate: results.size > 0 ? (successful / results.size * 100).toFixed(1) : '0.0'
  };
}
