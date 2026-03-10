import axios, { AxiosInstance } from 'axios';
import pLimit from 'p-limit';
import { RealingoDetail } from '../types/realingoTypes';

/**
 * Realingo detail fetcher — Phase 2.5
 *
 * Uses GraphQL alias batching: multiple offer(id) queries in a single request.
 * The detail sub-object is only available on offer(id), NOT in searchOffer list.
 *
 * Batch size: 50 IDs per request
 * Concurrency: CONCURRENT_DETAIL_BATCHES (default 10) parallel requests
 */

const BATCH_SIZE = parseInt(process.env.REALINGO_DETAIL_BATCH_SIZE || '50');
const CONCURRENT_BATCHES = parseInt(process.env.CONCURRENT_DETAIL_BATCHES || '10');

const DETAIL_FIELDS = `
  description
  externalUrl
  buildingType
  buildingStatus
  buildingPosition
  houseType
  ownership
  furniture
  floor
  floorTotal
  yearBuild
  yearReconstructed
  parking
  parkingPlaces
  garages
  energyPerformance
  energyPerformanceValue
  heating
  electricity
  waterSupply
  gas
  balcony
  loggia
  terrace
  lift
  cellar
  isBarrierFree
  isAuction
  roomCount
  flatCount
  flatClass
  availableFromDate
  ceilingHeight
  basin
  energyPerformanceLawRequirement
  floodActiveZone
  floodRisk
  floorUnderground
  garret
  gully
  telecommunication
  contact {
    type
    person { id name phone photo }
    company { id name address phone }
  }
`;

export interface DetailFetchResult {
  id: string;
  detail?: RealingoDetail;
  error?: string;
}

function buildBatchQuery(ids: string[]): string {
  const aliases = ids
    .map((id, i) => `o${i}: offer(id: "${id}") { id detail { ${DETAIL_FIELDS} } }`)
    .join('\n');
  return `{ ${aliases} }`;
}

export class DetailScraper {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: 'https://www.realingo.cz/graphql',
      timeout: 60000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    });
  }

  /**
   * Fetch detail for one batch of IDs using alias query (with retry)
   */
  private async fetchBatch(ids: string[], maxRetries = 3): Promise<Map<string, RealingoDetail>> {
    const query = buildBatchQuery(ids);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.client.post('', { query });

        const data = response.data?.data;
        if (!data) throw new Error('No data in response');

        const results = new Map<string, RealingoDetail>();
        ids.forEach((id, i) => {
          const alias = `o${i}`;
          const item = data[alias];
          if (item?.detail) {
            results.set(id, item.detail as RealingoDetail);
          }
        });

        return results;
      } catch (err: any) {
        const status = err.response?.status;
        if (attempt < maxRetries && (!status || status >= 429)) {
          const delay = 1000 * Math.pow(2, attempt - 1);
          console.error(JSON.stringify({
            level: 'warn', service: 'realingo-scraper',
            msg: 'Detail batch retry', attempt, maxRetries,
            status, err: err.message, delayMs: delay,
          }));
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        throw err;
      }
    }

    // Should not reach here, but satisfy TS
    return new Map();
  }

  /**
   * Fetch details for all given IDs using batched+concurrent GraphQL queries.
   * Returns a Map of id → RealingoDetail for successful fetches.
   *
   * @param ids - listing IDs to fetch details for
   * @param onProgress - optional progress callback
   */
  async fetchDetails(
    ids: string[],
    onProgress?: (completed: number, total: number) => void
  ): Promise<Map<string, RealingoDetail>> {
    const limit = pLimit(CONCURRENT_BATCHES);
    const results = new Map<string, RealingoDetail>();
    let completed = 0;

    // Split ids into batches
    const batches: string[][] = [];
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      batches.push(ids.slice(i, i + BATCH_SIZE));
    }

    const tasks = batches.map(batch =>
      limit(async () => {
        try {
          const batchResults = await this.fetchBatch(batch);
          batchResults.forEach((detail, id) => results.set(id, detail));
        } catch (err: any) {
          console.error(JSON.stringify({
            level: 'error',
            service: 'realingo-scraper',
            msg: 'Detail batch failed',
            batchSize: batch.length,
            firstId: batch[0],
            err: err.message,
          }));
        } finally {
          completed += batch.length;
          if (onProgress) onProgress(completed, ids.length);
        }
      })
    );

    await Promise.all(tasks);

    return results;
  }
}

export function getDetailFetchStats(results: Map<string, RealingoDetail>, total: number) {
  const fetched = results.size;
  const missing = total - fetched;
  return {
    total,
    fetched,
    missing,
    successRate: total > 0 ? ((fetched / total) * 100).toFixed(1) : '0.0',
  };
}
