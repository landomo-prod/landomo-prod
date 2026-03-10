import pLimit from 'p-limit';
import { habitacliaRateLimiter } from '../utils/rateLimiter';
import { fetchDetailPage, DetailResult } from '../utils/fetchData';
import { getRandomDelay } from '../utils/headers';
import { HabitacliaListingRaw } from '../types/habitacliaTypes';

const CONCURRENT_DETAILS = parseInt(process.env.CONCURRENT_DETAILS || '40');

export interface DetailFetchResult {
  id: string;
  detail?: HabitacliaListingRaw;
  isInactive: boolean;
  inactiveReason?: string;
  error?: string;
}

export async function fetchDetailsBatch(
  listings: HabitacliaListingRaw[],
  onProgress?: (current: number, total: number) => void
): Promise<Map<string, DetailFetchResult>> {
  const limit = pLimit(CONCURRENT_DETAILS);
  const results = new Map<string, DetailFetchResult>();
  let completed = 0;

  const tasks = listings.map(listing =>
    limit(async (): Promise<void> => {
      try {
        const detailResult = await fetchDetailPage(listing);

        results.set(listing.id, {
          id: listing.id,
          detail: detailResult.data,
          isInactive: detailResult.isInactive,
          inactiveReason: detailResult.inactiveReason,
        });
      } catch (error: any) {
        results.set(listing.id, {
          id: listing.id,
          isInactive: false,
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
  let successful = 0, inactive = 0, failed = 0;
  results.forEach(result => {
    if (result.error) failed++;
    else if (result.isInactive) inactive++;
    else if (result.detail) successful++;
  });
  return {
    total: results.size, successful, inactive, failed,
    successRate: results.size > 0 ? (successful / results.size * 100).toFixed(1) : '0.0',
  };
}
