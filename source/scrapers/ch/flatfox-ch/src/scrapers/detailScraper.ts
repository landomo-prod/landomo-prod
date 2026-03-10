import { fetchListingDetail } from '../utils/fetchData';
import { FlatfoxListing } from '../types/flatfoxTypes';

export interface DetailFetchResult {
  pk: number;
  detail?: FlatfoxListing;
  error?: string;
}

export async function fetchDetailsBatch(
  pks: number[],
  onProgress?: (current: number, total: number) => void
): Promise<Map<number, DetailFetchResult>> {
  const results = new Map<number, DetailFetchResult>();
  let completed = 0;

  for (const pk of pks) {
    try {
      await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));
      const detail = await fetchListingDetail(pk);
      results.set(pk, { pk, detail });
    } catch (error: any) {
      console.error(JSON.stringify({ level: 'error', service: 'flatfox-ch', msg: 'Failed to fetch detail', pk, err: error.message }));
      results.set(pk, { pk, error: error.message });
    }

    completed++;
    if (onProgress && completed % 50 === 0) {
      onProgress(completed, pks.length);
    }
  }

  return results;
}
