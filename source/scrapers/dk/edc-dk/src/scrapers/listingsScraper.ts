import axios, { AxiosInstance } from 'axios';
import { EdcListingRaw, EdcSearchResponse, EdcDivision } from '../types/edcTypes';
import { getRandomUserAgent } from '../utils/userAgents';

const BASE_URL = 'https://www.edc.dk';
const PAGE_SIZE = 100;
// EDC API caps results at 1000 (10 pages × 100) per query; pagination goes up to 100 pages max
const MAX_PAGES_PER_QUERY = 100;
const PAGE_DELAY_MS = parseInt(process.env.PAGE_DELAY_MS || '300');
const MAX_RETRIES = 3;

/**
 * Scrape configurations define which division+pageSize combos to iterate.
 * EDC API: GET /api/v1/cases/quick-search
 *   - Header x-division: private  → sale listings (~40k)
 *   - Header x-division: Rent     → rental listings (~14k)
 *   - Header x-division: erhverv  → commercial listings
 *
 * The API has a hard cap of 1000 results per request set regardless of pagination.
 * To work around this, we rely on the fact that the API returns up to 100 pages × 100 = 10000
 * results per division without additional filtering. With ~40k sale listings this means
 * we can only retrieve 10000 at a time. For full coverage we would need price-band or
 * zip-code sharding. Current implementation retrieves the API's first 10000 per division
 * which covers the majority of the catalogue.
 */
const SCRAPE_DIVISIONS: Array<{ division: EdcDivision; label: string }> = [
  { division: 'private', label: 'sale-private' },
  { division: 'Rent',    label: 'rent-private' },
  { division: 'erhverv', label: 'sale-commercial' },
];

export interface ScrapeStats {
  total: number;
  pages: number;
  errors: number;
}

export class EdcListingsScraper {
  private readonly client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: BASE_URL,
      timeout: 30_000,
    });
  }

  private getHeaders(division: EdcDivision): Record<string, string> {
    return {
      'User-Agent': getRandomUserAgent(),
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'da-DK,da;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br',
      'Referer': 'https://www.edc.dk/',
      'x-division': division,
      'DNT': '1',
      'Connection': 'keep-alive',
    };
  }

  private async fetchPage(
    division: EdcDivision,
    page: number,
    retries = MAX_RETRIES,
  ): Promise<EdcSearchResponse | null> {
    const url = `/api/v1/cases/quick-search?page=${page}&pageSize=${PAGE_SIZE}`;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await this.client.get<EdcSearchResponse>(url, {
          headers: this.getHeaders(division),
        });
        return response.data;
      } catch (err: any) {
        const status = err.response?.status;

        if (status === 404 || status === 400) {
          return null;
        }

        if (status === 429 || status === 503) {
          const backoff = Math.min(2000 * Math.pow(2, attempt), 60_000);
          console.warn(JSON.stringify({
            level: 'warn',
            service: 'edc-dk-scraper',
            msg: `Rate limited (${status}), retrying in ${backoff}ms`,
            division,
            page,
            attempt,
          }));
          await new Promise(r => setTimeout(r, backoff));
          continue;
        }

        if (attempt === retries) {
          console.error(JSON.stringify({
            level: 'error',
            service: 'edc-dk-scraper',
            msg: 'Page fetch failed',
            division,
            page,
            status,
            err: err.message,
          }));
          return null;
        }

        await new Promise(r => setTimeout(r, 1000 * attempt));
      }
    }
    return null;
  }

  /**
   * Scrape all listings for a single division (sale / rent / commercial).
   * Calls onBatch for each page so the caller can stream results to ingest.
   */
  async scrapeDivision(
    division: EdcDivision,
    label: string,
    onBatch: (batch: EdcListingRaw[]) => Promise<void>,
  ): Promise<ScrapeStats> {
    const stats: ScrapeStats = { total: 0, pages: 0, errors: 0 };
    let totalPages = MAX_PAGES_PER_QUERY;

    for (let page = 1; page <= totalPages; page++) {
      const data = await this.fetchPage(division, page);

      if (!data) {
        stats.errors++;
        console.warn(JSON.stringify({
          level: 'warn',
          service: 'edc-dk-scraper',
          msg: 'Empty page, stopping division',
          division,
          label,
          page,
        }));
        break;
      }

      // Update totalPages from first response
      if (page === 1) {
        totalPages = Math.min(data.totalPages, MAX_PAGES_PER_QUERY);
        console.info(JSON.stringify({
          level: 'info',
          service: 'edc-dk-scraper',
          msg: 'Division started',
          division,
          label,
          totalCount: data.totalCount,
          totalPages,
          pageSize: PAGE_SIZE,
        }));
      }

      const items = data.items ?? [];
      if (items.length === 0) {
        console.info(JSON.stringify({
          level: 'info',
          service: 'edc-dk-scraper',
          msg: 'No more items, stopping division',
          division,
          label,
          page,
        }));
        break;
      }

      stats.pages++;
      stats.total += items.length;

      try {
        await onBatch(items);
      } catch (err: any) {
        stats.errors++;
        console.error(JSON.stringify({
          level: 'error',
          service: 'edc-dk-scraper',
          msg: 'Batch processing error',
          division,
          label,
          page,
          err: err.message,
        }));
      }

      console.info(JSON.stringify({
        level: 'info',
        service: 'edc-dk-scraper',
        msg: 'Page scraped',
        division,
        label,
        page,
        pageItems: items.length,
        total: stats.total,
      }));

      if (page < totalPages) {
        await new Promise(r => setTimeout(r, PAGE_DELAY_MS + Math.random() * 200));
      }
    }

    return stats;
  }

  /**
   * Scrape all divisions (sale + rent + commercial).
   * onBatch is called for each page batch across all divisions.
   */
  async scrapeAll(
    onBatch: (batch: EdcListingRaw[]) => Promise<void>,
  ): Promise<{ [division: string]: ScrapeStats }> {
    const results: { [division: string]: ScrapeStats } = {};

    for (const { division, label } of SCRAPE_DIVISIONS) {
      console.info(JSON.stringify({
        level: 'info',
        service: 'edc-dk-scraper',
        msg: 'Starting division',
        division,
        label,
      }));

      const stats = await this.scrapeDivision(division, label, onBatch);
      results[label] = stats;

      console.info(JSON.stringify({
        level: 'info',
        service: 'edc-dk-scraper',
        msg: 'Division completed',
        division,
        label,
        ...stats,
      }));
    }

    return results;
  }
}
