import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';
import { getRandomUserAgent } from '../utils/userAgents';
import {
  BooliListingShort,
  BooliRentalListing,
  BooliListingsResponse,
  BooliRentalsResponse,
  TransactionType,
} from '../types/booliTypes';

const BOOLI_API_BASE = 'https://api.booli.se';

/**
 * Maximum results per request (Booli API hard limit: 500).
 */
const PAGE_SIZE = 500;

/**
 * Booli API allows up to ~50,000 results per search query with offset pagination.
 * We search country-wide (q=Sverige) in two modes: for-sale and rental.
 *
 * Auth scheme (HMAC-SHA1):
 *   callerId  = registered Booli API caller ID (env: BOOLI_CALLER_ID)
 *   secret    = registered Booli API secret    (env: BOOLI_SECRET)
 *   unique    = random 16-character alphanumeric string (per request)
 *   time      = Unix timestamp in seconds
 *   hash      = SHA1(callerId + unique + time + secret)
 */
export class ListingsScraper {
  private client: AxiosInstance;
  private callerId: string;
  private secret: string;
  private requestDelay: number;

  constructor() {
    this.callerId = process.env.BOOLI_CALLER_ID ?? '';
    this.secret = process.env.BOOLI_SECRET ?? '';
    this.requestDelay = parseInt(process.env.REQUEST_DELAY_MS || '400', 10);

    if (!this.callerId || !this.secret) {
      console.warn(JSON.stringify({
        level: 'warn',
        service: 'booli-scraper',
        msg: 'BOOLI_CALLER_ID or BOOLI_SECRET not set. API calls will fail authentication.',
      }));
    }

    this.client = axios.create({
      baseURL: BOOLI_API_BASE,
      timeout: 30000,
      headers: {
        'Accept': 'application/json',
        'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8',
      },
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generate HMAC-SHA1 auth parameters required by Booli API.
   *
   * Algorithm:
   *   unique = 16 random alphanumeric chars
   *   time   = current Unix timestamp (seconds)
   *   hash   = SHA1(callerId + unique + time + secret)
   */
  private buildAuthParams(): {
    callerId: string;
    unique: string;
    time: number;
    hash: string;
  } {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const unique = Array.from({ length: 16 }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    ).join('');
    const time = Math.floor(Date.now() / 1000);
    const hashInput = this.callerId + unique + time + this.secret;
    const hash = crypto.createHash('sha1').update(hashInput).digest('hex');
    return { callerId: this.callerId, unique, time, hash };
  }

  /**
   * Fetch one page of for-sale listings from Booli API.
   *
   * @param offset - Starting result index
   * @param limit  - Number of results to fetch (max 500)
   * @returns Response with listings and totalCount
   */
  private async fetchSaleListingsPage(
    offset: number,
    limit: number
  ): Promise<BooliListingsResponse> {
    const auth = this.buildAuthParams();
    const userAgent = getRandomUserAgent();

    const response = await this.client.get<BooliListingsResponse>('/listings', {
      params: {
        // Country-wide search (Sweden)
        country: 'Sverige',
        // Auth params
        callerId: auth.callerId,
        unique: auth.unique,
        time: auth.time,
        hash: auth.hash,
        // Pagination
        offset,
        limit,
      },
      headers: { 'User-Agent': userAgent },
    });

    return response.data;
  }

  /**
   * Fetch one page of rental listings from Booli API.
   *
   * @param offset - Starting result index
   * @param limit  - Number of results to fetch (max 500)
   * @returns Response with rental listings and totalCount
   */
  private async fetchRentalListingsPage(
    offset: number,
    limit: number
  ): Promise<BooliRentalsResponse> {
    const auth = this.buildAuthParams();
    const userAgent = getRandomUserAgent();

    const response = await this.client.get<BooliRentalsResponse>('/rentals', {
      params: {
        country: 'Sverige',
        callerId: auth.callerId,
        unique: auth.unique,
        time: auth.time,
        hash: auth.hash,
        offset,
        limit,
      },
      headers: { 'User-Agent': userAgent },
    });

    return response.data;
  }

  /**
   * Paginate through all for-sale listings, calling onBatch for each page.
   *
   * Returns total number of listings scraped.
   */
  private async scrapeEndpoint(
    mode: TransactionType,
    onBatch: (batch: BooliListingShort[], transactionType: TransactionType) => Promise<void>
  ): Promise<number> {
    let offset = 0;
    let totalCount = 0;
    let scraped = 0;

    console.log(JSON.stringify({
      level: 'info',
      service: 'booli-scraper',
      msg: 'Starting endpoint scrape',
      mode,
    }));

    do {
      const limit = PAGE_SIZE;

      const page =
        mode === 'sale'
          ? await this.fetchSaleListingsPage(offset, limit)
          : await this.fetchRentalListingsPage(offset, limit);

      totalCount = page.totalCount;

      if (!page.listings || page.listings.length === 0) {
        break;
      }

      await onBatch(page.listings, mode);
      scraped += page.listings.length;
      offset += page.listings.length;

      console.log(JSON.stringify({
        level: 'info',
        service: 'booli-scraper',
        msg: 'Fetched page',
        mode,
        offset,
        pageSize: page.listings.length,
        scraped,
        totalCount,
      }));

      // Stop if we got fewer than requested (last page)
      if (page.listings.length < limit) {
        break;
      }

      await this.sleep(this.requestDelay);
    } while (offset < totalCount);

    console.log(JSON.stringify({
      level: 'info',
      service: 'booli-scraper',
      msg: 'Endpoint scrape complete',
      mode,
      scraped,
      totalCount,
    }));

    return scraped;
  }

  /**
   * Scrape all for-sale and rental listings from Booli.
   *
   * Calls onBatch for each page of results, including the transaction type.
   */
  async scrapeAll(
    onBatch: (batch: BooliListingShort[], transactionType: TransactionType) => Promise<void>
  ): Promise<{ scraped: number; byMode: Record<string, number> }> {
    const byMode: Record<string, number> = {};

    // Scrape for-sale listings
    try {
      const saleCount = await this.scrapeEndpoint('sale', onBatch);
      byMode['sale'] = saleCount;
    } catch (error: any) {
      console.error(JSON.stringify({
        level: 'error',
        service: 'booli-scraper',
        msg: 'Error scraping sale listings',
        err: error.message,
        status: error.response?.status,
        data: error.response?.data,
      }));
    }

    // Brief pause between endpoint types
    await this.sleep(this.requestDelay * 3);

    // Scrape rental listings
    try {
      const rentalCount = await this.scrapeEndpoint('rent', onBatch);
      byMode['rent'] = rentalCount;
    } catch (error: any) {
      console.error(JSON.stringify({
        level: 'error',
        service: 'booli-scraper',
        msg: 'Error scraping rental listings',
        err: error.message,
        status: error.response?.status,
        data: error.response?.data,
      }));
    }

    const scraped = Object.values(byMode).reduce((a, b) => a + b, 0);
    return { scraped, byMode };
  }
}
