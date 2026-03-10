import axios from 'axios';
import { FinnListing, FinnSearchResponse, FinnSearchConfig, FINN_SEARCH_CONFIGS } from '../types/finnTypes';
import { getRandomUserAgent } from '../utils/userAgents';

const FINN_SEARCH_API = 'https://www.finn.no/api/search-qf';

// finn.no paginates at 50 results/page with a hard cap of 50 pages
// (max 2,500 per search key). Using page parameter starting from 1.
const PAGE_SIZE = 50; // Results per page (finn.no fixed at ~50)
const MAX_PAGES = 50; // finn.no hard limit

// Concurrency: fetch up to 5 pages in parallel per search key
const CONCURRENT_PAGES = 5;

// Delay between concurrent page batches (ms) — be polite to finn.no
const INTER_BATCH_DELAY_MS = 300;

// Delay between different search keys (ms)
const INTER_SEARCH_KEY_DELAY_MS = 1000;

export interface ScrapeResult {
  listing: FinnListing;
  offerType: 'sale' | 'rent';
  searchKey: string;
}

export class ListingsScraper {
  /**
   * Scrape all finn.no realestate listings across all configured search keys.
   *
   * @param onBatch - Optional streaming callback. Called after each page-batch is fetched.
   * @returns All scraped results
   */
  async scrapeAll(
    onBatch?: (batch: ScrapeResult[]) => Promise<void>
  ): Promise<ScrapeResult[]> {
    console.log(
      JSON.stringify({
        level: 'info',
        service: 'finn-no-scraper',
        msg: 'Starting finn.no scrape',
        searchKeys: FINN_SEARCH_CONFIGS.map(c => c.searchKey),
        streamingMode: !!onBatch,
      })
    );

    const allResults: ScrapeResult[] = [];

    for (const config of FINN_SEARCH_CONFIGS) {
      console.log(
        JSON.stringify({
          level: 'info',
          service: 'finn-no-scraper',
          msg: 'Scraping search key',
          searchKey: config.searchKey,
          label: config.label,
          offerType: config.offerType,
        })
      );

      const results = await this.scrapeSearchKey(config, onBatch);
      allResults.push(...results);

      console.log(
        JSON.stringify({
          level: 'info',
          service: 'finn-no-scraper',
          msg: 'Search key complete',
          searchKey: config.searchKey,
          count: results.length,
          totalSoFar: allResults.length,
        })
      );

      // Polite delay between search keys
      await sleep(INTER_SEARCH_KEY_DELAY_MS);
    }

    console.log(
      JSON.stringify({
        level: 'info',
        service: 'finn-no-scraper',
        msg: 'All search keys scraped',
        total: allResults.length,
      })
    );

    return allResults;
  }

  /**
   * Scrape all pages for a single search key configuration.
   * Uses concurrent page fetching in batches of CONCURRENT_PAGES.
   */
  private async scrapeSearchKey(
    config: FinnSearchConfig,
    onBatch?: (batch: ScrapeResult[]) => Promise<void>
  ): Promise<ScrapeResult[]> {
    const allResults: ScrapeResult[] = [];

    // First, fetch page 1 to discover total pages
    const firstPage = await this.fetchPage(config.searchKey, 1);
    if (!firstPage) {
      console.log(
        JSON.stringify({
          level: 'warn',
          service: 'finn-no-scraper',
          msg: 'Failed to fetch first page',
          searchKey: config.searchKey,
        })
      );
      return allResults;
    }

    const totalPages = Math.min(firstPage.metadata.paging.last, MAX_PAGES);
    const totalHits = firstPage.metadata.result_size.match_count;

    console.log(
      JSON.stringify({
        level: 'info',
        service: 'finn-no-scraper',
        msg: 'Discovered pagination',
        searchKey: config.searchKey,
        totalHits,
        totalPages,
      })
    );

    // Process first page results
    const firstPageResults = firstPage.docs.map(doc => ({
      listing: doc,
      offerType: config.offerType,
      searchKey: config.searchKey,
    }));
    allResults.push(...firstPageResults);

    if (onBatch && firstPageResults.length > 0) {
      await onBatch(firstPageResults);
    }

    if (totalPages <= 1) {
      return allResults;
    }

    // Fetch remaining pages in concurrent batches
    let page = 2;

    while (page <= totalPages) {
      const pagesInBatch = Array.from(
        { length: Math.min(CONCURRENT_PAGES, totalPages - page + 1) },
        (_, i) => page + i
      );

      const pageResults = await Promise.allSettled(
        pagesInBatch.map(p => this.fetchPage(config.searchKey, p))
      );

      const batchResults: ScrapeResult[] = [];
      for (const result of pageResults) {
        if (result.status === 'fulfilled' && result.value) {
          const docs = result.value.docs;
          batchResults.push(
            ...docs.map(doc => ({
              listing: doc,
              offerType: config.offerType,
              searchKey: config.searchKey,
            }))
          );
        } else if (result.status === 'rejected') {
          console.error(
            JSON.stringify({
              level: 'error',
              service: 'finn-no-scraper',
              msg: 'Failed to fetch page',
              searchKey: config.searchKey,
              err: result.reason?.message || String(result.reason),
            })
          );
        }
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
                service: 'finn-no-scraper',
                msg: 'onBatch callback failed',
                searchKey: config.searchKey,
                err: err.message,
              })
            );
          }
        }
      }

      page += CONCURRENT_PAGES;

      // Polite delay between batches
      if (page <= totalPages) {
        await sleep(INTER_BATCH_DELAY_MS);
      }
    }

    return allResults;
  }

  /**
   * Fetch a single page from the finn.no search API.
   */
  private async fetchPage(
    searchKey: string,
    page: number
  ): Promise<FinnSearchResponse | null> {
    const url = `${FINN_SEARCH_API}?searchkey=${encodeURIComponent(searchKey)}&vertical=realestate&page=${page}`;

    try {
      const response = await axios.get<FinnSearchResponse>(url, {
        headers: {
          'User-Agent': getRandomUserAgent(),
          Accept: 'application/json',
          'Accept-Language': 'no,nb;q=0.9,en;q=0.8',
        },
        timeout: 30000,
      });

      if (!response.data?.docs || !response.data?.metadata) {
        throw new Error('Invalid API response structure');
      }

      console.log(
        JSON.stringify({
          level: 'debug',
          service: 'finn-no-scraper',
          msg: 'Fetched page',
          searchKey,
          page,
          count: response.data.docs.length,
        })
      );

      return response.data;
    } catch (error: any) {
      console.error(
        JSON.stringify({
          level: 'error',
          service: 'finn-no-scraper',
          msg: 'Error fetching page',
          searchKey,
          page,
          err: error.message,
          status: error.response?.status,
        })
      );
      return null;
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
