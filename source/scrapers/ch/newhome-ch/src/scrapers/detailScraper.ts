import { fetchListingDetail } from '../utils/fetchData';

export interface DetailFetchResult {
  listingId: string;
  detail?: any;
  error?: string;
}

export async function fetchDetailsBatch(
  listingIds: string[],
  onProgress?: (current: number, total: number) => void
): Promise<Map<string, DetailFetchResult>> {
  const results = new Map<string, DetailFetchResult>();
  let completed = 0;

  for (const listingId of listingIds) {
    try {
      await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));
      const detail = await fetchListingDetail(listingId);
      results.set(listingId, { listingId, detail });
    } catch (error: any) {
      console.error(JSON.stringify({ level: 'error', service: 'newhome-ch', msg: 'Failed to fetch detail', listingId, err: error.message }));
      results.set(listingId, { listingId, error: error.message });
    }

    completed++;
    if (onProgress && completed % 50 === 0) {
      onProgress(completed, listingIds.length);
    }
  }

  return results;
}
