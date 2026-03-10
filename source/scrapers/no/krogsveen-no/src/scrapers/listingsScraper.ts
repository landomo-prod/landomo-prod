import axios from 'axios';
import {
  KrogsveenEstate,
  KrogsveenSearchHit,
  KrogsveenSearchResponse,
  ESTATES_SEARCH_QUERY,
} from '../types/krogsveenTypes';
import { getRandomUserAgent } from '../utils/userAgents';

const KROGSVEEN_GRAPHQL_URL = 'https://www.krogsveen.no/bsr-api';

/**
 * Delay between the two commission type fetches (RESIDENTIAL + COMMERCIAL)
 * to be polite to Krogsveen's BFF.
 */
const INTER_FETCH_DELAY_MS = 1500;

/**
 * Commission type combinations to fetch.
 * Krogsveen's GraphQL API returns ALL results in a single call per combination —
 * no pagination is needed (~1,000–1,200 total listings for the full estate portfolio).
 */
const COMMISSION_CONFIGS = [
  {
    label: 'residential-for-sale',
    commissionStates: ['ACTIVE'],
    commissionTypes: ['RESIDENTIAL_FOR_SALE'],
  },
  {
    label: 'project-for-sale',
    commissionStates: ['ACTIVE'],
    commissionTypes: ['PROJECT_FOR_SALE'],
  },
  {
    label: 'commercial-for-sale',
    commissionStates: ['ACTIVE'],
    commissionTypes: ['COMMERCIAL_FOR_SALE'],
  },
  {
    label: 'upcoming',
    commissionStates: ['UPCOMING'],
    commissionTypes: ['RESIDENTIAL_FOR_SALE', 'PROJECT_FOR_SALE'],
  },
] as const;

export interface ScrapeResult {
  estate: KrogsveenEstate;
  label: string;
}

export class ListingsScraper {
  /**
   * Scrape all active Krogsveen listings across commission type combinations.
   *
   * The Krogsveen GraphQL API (POST /bsr-api) returns all listings matching the
   * filter in a single response — no pagination required. We query multiple
   * commission type buckets and deduplicate by estate ID.
   *
   * @param onBatch - Optional streaming callback called after each commission bucket
   */
  async scrapeAll(
    onBatch?: (batch: ScrapeResult[]) => Promise<void>
  ): Promise<ScrapeResult[]> {
    console.log(
      JSON.stringify({
        level: 'info',
        service: 'krogsveen-no-scraper',
        msg: 'Starting Krogsveen scrape',
        commissionBuckets: COMMISSION_CONFIGS.map(c => c.label),
      })
    );

    const allResults: ScrapeResult[] = [];
    // Deduplicate across buckets by estate UUID
    const seenIds = new Set<string>();

    for (let i = 0; i < COMMISSION_CONFIGS.length; i++) {
      const config = COMMISSION_CONFIGS[i];

      console.log(
        JSON.stringify({
          level: 'info',
          service: 'krogsveen-no-scraper',
          msg: 'Fetching commission bucket',
          label: config.label,
          commissionStates: config.commissionStates,
          commissionTypes: config.commissionTypes,
        })
      );

      const hits = await this.fetchEstates(
        [...config.commissionStates],
        [...config.commissionTypes]
      );

      const batchResults: ScrapeResult[] = [];
      for (const hit of hits) {
        if (!hit.estate || seenIds.has(hit.estate.id)) continue;
        seenIds.add(hit.estate.id);
        batchResults.push({ estate: hit.estate, label: config.label });
      }

      if (batchResults.length > 0) {
        allResults.push(...batchResults);

        if (onBatch) {
          try {
            await onBatch(batchResults);
          } catch (err: any) {
            console.error(
              JSON.stringify({
                level: 'error',
                service: 'krogsveen-no-scraper',
                msg: 'onBatch callback failed',
                label: config.label,
                err: err.message,
              })
            );
          }
        }
      }

      console.log(
        JSON.stringify({
          level: 'info',
          service: 'krogsveen-no-scraper',
          msg: 'Commission bucket complete',
          label: config.label,
          fetched: hits.length,
          newUnique: batchResults.length,
          totalSoFar: allResults.length,
        })
      );

      // Polite delay between buckets
      if (i < COMMISSION_CONFIGS.length - 1) {
        await sleep(INTER_FETCH_DELAY_MS);
      }
    }

    console.log(
      JSON.stringify({
        level: 'info',
        service: 'krogsveen-no-scraper',
        msg: 'All buckets scraped',
        total: allResults.length,
      })
    );

    return allResults;
  }

  /**
   * Execute a single GraphQL query against the Krogsveen BFF.
   * Returns all matching SearchEstateObject hits.
   */
  private async fetchEstates(
    commissionStates: string[],
    commissionTypes: string[]
  ): Promise<KrogsveenSearchHit[]> {
    try {
      const response = await axios.post<KrogsveenSearchResponse>(
        KROGSVEEN_GRAPHQL_URL,
        {
          query: ESTATES_SEARCH_QUERY,
          variables: { commissionStates, commissionTypes },
        },
        {
          headers: {
            'User-Agent': getRandomUserAgent(),
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'Accept-Language': 'nb-NO,nb;q=0.9,no;q=0.8,en;q=0.7',
            Referer: 'https://www.krogsveen.no/kjope/boliger-til-salgs',
            Origin: 'https://www.krogsveen.no',
          },
          timeout: 60000,
        }
      );

      if (response.data.errors && response.data.errors.length > 0) {
        console.error(
          JSON.stringify({
            level: 'error',
            service: 'krogsveen-no-scraper',
            msg: 'GraphQL errors in response',
            errors: response.data.errors.map(e => e.message),
          })
        );
        return [];
      }

      const hits = response.data.data?.estatesSearch?.hits ?? [];
      const total = response.data.data?.estatesSearch?.total ?? 0;

      console.log(
        JSON.stringify({
          level: 'debug',
          service: 'krogsveen-no-scraper',
          msg: 'GraphQL response received',
          total,
          hitsReturned: hits.length,
          commissionStates,
          commissionTypes,
        })
      );

      return hits;
    } catch (error: any) {
      console.error(
        JSON.stringify({
          level: 'error',
          service: 'krogsveen-no-scraper',
          msg: 'Error fetching estates from GraphQL API',
          commissionStates,
          commissionTypes,
          err: error.message,
          status: error.response?.status,
        })
      );
      return [];
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
