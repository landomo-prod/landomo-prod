import axios, { AxiosInstance } from 'axios';
import { ListingChecksum } from '../utils/checksum';

export interface ChecksumComparisonResult {
  portalId: string;
  status: 'new' | 'changed' | 'unchanged';
  oldHash?: string;
  newHash: string;
}

export interface ChecksumBatchResponse {
  scrapeRunId: string;
  total: number;
  new: number;
  changed: number;
  unchanged: number;
  results: ChecksumComparisonResult[];
}

export class ChecksumClient {
  private client: AxiosInstance;

  constructor(baseURL: string, apiKey: string) {
    this.client = axios.create({
      baseURL,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });
  }

  /**
   * Send batch of checksums for comparison
   *
   * @param checksums - Array of checksums from listing pages
   * @param scrapeRunId - Optional scrape run ID for tracking
   * @returns Comparison results showing which properties need full fetching
   *
   * @example
   * const response = await checksumClient.compareChecksums(checksums, runId);
   * const toFetch = response.results.filter(r => r.status !== 'unchanged');
   * console.log(`Need to fetch ${toFetch.length}/${response.total} properties`);
   */
  async compareChecksums(
    checksums: ListingChecksum[],
    scrapeRunId?: string
  ): Promise<ChecksumBatchResponse> {
    const response = await this.client.post<ChecksumBatchResponse>(
      '/api/v1/checksums/compare',
      {
        checksums,
        scrapeRunId,
      }
    );

    return response.data;
  }

  /**
   * Send checksums in batches to avoid memory issues (Google-style batching)
   *
   * @param checksums - Array of checksums from listing pages
   * @param scrapeRunId - Optional scrape run ID for tracking
   * @param batchSize - Number of checksums per batch (default: 5000)
   * @param onProgress - Optional callback for progress updates
   * @returns Aggregated comparison results from all batches
   *
   * @example
   * const response = await checksumClient.compareChecksumsInBatches(
   *   checksums,
   *   runId,
   *   5000,
   *   (current, total) => console.log(`Progress: ${current}/${total}`)
   * );
   */
  async compareChecksumsInBatches(
    checksums: ListingChecksum[],
    scrapeRunId?: string,
    batchSize: number = 5000,
    onProgress?: (current: number, total: number) => void
  ): Promise<ChecksumBatchResponse> {
    const totalBatches = Math.ceil(checksums.length / batchSize);
    const aggregatedResults: ChecksumComparisonResult[] = [];
    let totalNew = 0;
    let totalChanged = 0;
    let totalUnchanged = 0;

    console.log(`🔄 Sending ${checksums.length} checksums in ${totalBatches} batches of ${batchSize}...`);

    for (let i = 0; i < checksums.length; i += batchSize) {
      const batch = checksums.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;

      console.log(`  [Batch ${batchNum}/${totalBatches}] Comparing ${batch.length} checksums...`);

      try {
        const batchResponse = await this.compareChecksums(batch, scrapeRunId);

        aggregatedResults.push(...batchResponse.results);
        totalNew += batchResponse.new;
        totalChanged += batchResponse.changed;
        totalUnchanged += batchResponse.unchanged;

        console.log(
          `  [Batch ${batchNum}/${totalBatches}] ✅ New: ${batchResponse.new}, Changed: ${batchResponse.changed}, Unchanged: ${batchResponse.unchanged}`
        );

        if (onProgress) {
          onProgress(Math.min(i + batchSize, checksums.length), checksums.length);
        }
      } catch (error) {
        console.error(`  [Batch ${batchNum}/${totalBatches}] ❌ Failed:`, error);
        throw new Error(`Batch ${batchNum} failed: ${error}`);
      }
    }

    return {
      scrapeRunId: scrapeRunId || '',
      total: checksums.length,
      new: totalNew,
      changed: totalChanged,
      unchanged: totalUnchanged,
      results: aggregatedResults,
    };
  }

  /**
   * Update checksums after successful property ingestion
   *
   * This marks properties as "seen" in the current scrape run.
   * Should be called after successful detail fetching and ingestion.
   *
   * @param checksums - Checksums that were successfully processed
   * @param scrapeRunId - Scrape run ID for tracking
   *
   * @example
   * // After successfully ingesting properties
   * await checksumClient.updateChecksums(processedChecksums, runId);
   */
  async updateChecksums(
    checksums: ListingChecksum[],
    scrapeRunId?: string
  ): Promise<void> {
    await this.client.post('/api/v1/checksums/update', {
      checksums,
      scrapeRunId,
    });
  }

  /**
   * Get checksum statistics for a portal
   *
   * @param portal - Portal identifier
   * @returns Statistics about checksum coverage
   */
  async getStats(portal: string): Promise<{
    totalProperties: number;
    lastScrapedAt: string | null;
    averageChangeRate: number;
  }> {
    const response = await this.client.get(`/api/v1/checksums/stats`, {
      params: { portal },
    });
    return response.data;
  }
}
