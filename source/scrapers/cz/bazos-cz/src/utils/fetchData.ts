/**
 * Bazos API Fetch Utilities
 * Handles API calls with proper headers, rate limiting, and error handling
 */

import axios, { AxiosInstance } from 'axios';
import { BazosAd, BazosCategory, BazosZipSearchResult } from '../types/bazosTypes';
import { getRandomUserAgent } from './userAgents';

export interface FetchOptions {
  userAgent?: string;
  delayMs?: number;
  retries?: number;
}

class BazosApiFetcher {
  private client: AxiosInstance;
  private baseUrls: Record<string, string> = {
    'cz': 'https://www.bazos.cz',
    'sk': 'https://www.bazos.sk',
    'pl': 'https://www.bazos.pl',
    'at': 'https://www.bazos.at',
  };

  private lastRequestTime = 0;
  private delayMs = 500; // Default delay between requests

  constructor(options?: FetchOptions) {
    this.delayMs = options?.delayMs || 500;

    this.client = axios.create({
      timeout: 10000,
      headers: {
        'User-Agent': options?.userAgent || getRandomUserAgent(),
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
      }
    });
  }

  private async rateLimitDelay(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const delayNeeded = Math.max(0, this.delayMs - timeSinceLastRequest);

    if (delayNeeded > 0) {
      await new Promise(resolve => setTimeout(resolve, delayNeeded));
    }

    this.lastRequestTime = Date.now();
  }

  private getBaseUrl(country: string): string {
    return this.baseUrls[country] || this.baseUrls['cz'];
  }

  async fetchAds(
    country: string = 'cz',
    options: {
      offset?: number;
      limit?: number;
      section?: string;
      query?: string;
      price_from?: number;
      price_to?: number;
      sort?: string;
    } = {}
  ): Promise<BazosAd[]> {
    const defaults = {
      offset: 0,
      limit: 20,
      ...options
    };

    const params = new URLSearchParams();
    params.append('offset', defaults.offset.toString());
    params.append('limit', defaults.limit.toString());

    if (defaults.section) params.append('section', defaults.section);
    if (defaults.query) params.append('query', defaults.query);
    if (defaults.price_from) params.append('price_from', defaults.price_from.toString());
    if (defaults.price_to) params.append('price_to', defaults.price_to.toString());
    if (defaults.sort) params.append('sort', defaults.sort);

    const url = `${this.getBaseUrl(country)}/api/v1/ads.php?${params.toString()}`;

    try {
      await this.rateLimitDelay();
      const response = await this.client.get<BazosAd[]>(url);
      return Array.isArray(response.data) ? response.data : [];
    } catch (error: any) {
      console.error(`Error fetching ads from ${country}:`, error.message);
      throw error;
    }
  }

  async fetchCategories(country: string = 'cz'): Promise<BazosCategory[]> {
    const url = `${this.getBaseUrl(country)}/api/v1/categories.php`;

    try {
      await this.rateLimitDelay();
      const response = await this.client.get<BazosCategory[]>(url);
      return Array.isArray(response.data) ? response.data : [];
    } catch (error: any) {
      console.error(`Error fetching categories from ${country}:`, error.message);
      throw error;
    }
  }

  async searchZip(
    country: string = 'cz',
    query: string
  ): Promise<BazosZipSearchResult[]> {
    const url = `${this.getBaseUrl(country)}/api/v1/zip.php?query=${encodeURIComponent(query)}`;

    try {
      await this.rateLimitDelay();
      const response = await this.client.get<BazosZipSearchResult[]>(url);
      return Array.isArray(response.data) ? response.data : [];
    } catch (error: any) {
      console.error(`Error searching zip codes in ${country}:`, error.message);
      throw error;
    }
  }

  async fetchAdDetail(
    country: string = 'cz',
    adId: string
  ): Promise<BazosAd | null> {
    const url = `${this.getBaseUrl(country)}/api/v1/ad-detail-2.php?ad_id=${adId}`;

    try {
      await this.rateLimitDelay();
      const response = await this.client.get(url);
      return response.data || null;
    } catch (error: any) {
      console.error(`Error fetching ad detail ${adId}:`, error.message);
      return null;
    }
  }
}

/**
 * Fetch all ads from a section with pagination
 * Respects the 20-unit pagination increment requirement
 */
export async function fetchSectionData(
  country: string,
  section: string,
  options: {
    userAgent?: string;
    maxPages?: number;
    delayMs?: number;
    onProgress?: (ads: BazosAd[], pageNumber: number) => Promise<void>;
  } = {}
): Promise<BazosAd[]> {
  const fetcher = new BazosApiFetcher({
    userAgent: options.userAgent,
    delayMs: options.delayMs || 1000
  });

  const allAds: BazosAd[] = [];
  const maxPages = options.maxPages || 10000; // Default to high limit (stops naturally when no more results)

  for (let pageNumber = 0; pageNumber < maxPages; pageNumber++) {
    const offset = pageNumber * 20; // CRITICAL: Must increment by 20

    try {
      const pageAds = await fetcher.fetchAds(country, {
        offset,
        limit: 20,
        section
      });

      if (!pageAds || pageAds.length === 0) {
        console.log(`No more ads found at offset ${offset}`);
        break;
      }

      allAds.push(...pageAds);
      console.log(`✓ Section ${section}, Page ${pageNumber + 1}: ${pageAds.length} ads (total: ${allAds.length})`);

      // Call progress callback
      if (options.onProgress) {
        await options.onProgress(pageAds, pageNumber + 1);
      }

      // Stop if we found fewer ads than requested (end of results)
      if (pageAds.length < 20) {
        console.log(`Reached end of results (got ${pageAds.length} < 20 requested)`);
        break;
      }
    } catch (error) {
      console.error(`Error fetching page ${pageNumber + 1}:`, error);
      // Continue with next page on error
    }
  }

  return allAds;
}

export { BazosApiFetcher };
