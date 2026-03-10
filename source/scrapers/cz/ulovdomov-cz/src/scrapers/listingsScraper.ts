import axios, { AxiosInstance } from 'axios';
import { UlovDomovOffer, UlovDomovFindResponse, UlovDomovCountResponse, CZ_BOUNDS, UlovDomovOfferType } from '../types/ulovdomovTypes';

/**
 * UlovDomov.cz REST API scraper
 * API: https://ud.api.ulovdomov.cz/v1
 *
 * Key notes from API inspection:
 * - offerType must be lowercase: "rent", "sale", "coliving"
 * - Body must be flat (no "filters" wrapper)
 * - "bounds" field covering CZ is required
 * - Response: data.offers[] (not data.items[])
 * - Pagination info: extraData.total/totalPages
 * - rentalPrice.value is used for both rent AND sale prices
 */
export class ListingsScraper {
  private client: AxiosInstance;
  private baseUrl = 'https://ud.api.ulovdomov.cz/v1';

  constructor() {
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });
  }

  /**
   * Build API request body with Czech Republic bounds
   */
  private buildRequestBody(offerType: UlovDomovOfferType, extra: Record<string, any> = {}): object {
    return {
      offerType,
      bounds: CZ_BOUNDS,
      ...extra
    };
  }

  /**
   * Get total count of offers for a given offer type
   */
  async getCount(offerType: UlovDomovOfferType): Promise<number> {
    try {
      const response = await this.client.post<UlovDomovCountResponse>(
        '/offer/count',
        this.buildRequestBody(offerType)
      );

      if (!response.data.success) {
        throw new Error(response.data.error || 'Count request failed');
      }

      return response.data.data.count;
    } catch (error: any) {
      console.error(`Failed to get count for ${offerType}:`, error.message);
      throw error;
    }
  }

  /**
   * Fetch one page of offers
   */
  async fetchPage(
    page: number,
    perPage: number,
    offerType: UlovDomovOfferType,
    sorting: 'latest' | 'cheapest' | 'most_expensive' | 'biggest' = 'latest'
  ): Promise<UlovDomovFindResponse> {
    try {
      const response = await this.client.post<UlovDomovFindResponse>(
        `/offer/find?page=${page}&perPage=${perPage}&sorting=${sorting}`,
        this.buildRequestBody(offerType)
      );

      if (!response.data.success) {
        throw new Error(response.data.error || 'Fetch request failed');
      }

      return response.data;
    } catch (error: any) {
      console.error(`Failed to fetch page ${page} (${offerType}):`, error.message);
      throw error;
    }
  }

  /**
   * Scrape all listings for a given offer type with per-page streaming
   * @param offerType - "rent" | "sale" | "coliving"
   * @param onBatch - Optional streaming callback per page
   */
  async scrapeByType(
    offerType: UlovDomovOfferType,
    onBatch?: (batch: UlovDomovOffer[]) => Promise<void>
  ): Promise<UlovDomovOffer[]> {
    console.log(`Starting UlovDomov ${offerType} scrape...`);

    const allListings: UlovDomovOffer[] = [];
    const perPage = 100;
    let currentPage = 1;

    try {
      const totalCount = await this.getCount(offerType);
      const totalPages = Math.ceil(totalCount / perPage);

      console.log(`[${offerType}] Total: ${totalCount} (${totalPages} pages)`);

      while (currentPage <= totalPages) {
        const response = await this.fetchPage(currentPage, perPage, offerType);
        const items = response.data.offers;

        allListings.push(...items);
        console.log(`  [${offerType}] Page ${currentPage}/${totalPages}: ${items.length} listings`);

        if (onBatch && items.length > 0) {
          try {
            await onBatch(items);
          } catch (err: any) {
            console.error(`Failed to stream batch page ${currentPage}: ${err.message}`);
          }
        }

        if (items.length === 0) break;

        currentPage++;

        if (currentPage <= totalPages) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }

      console.log(`[${offerType}] Complete: ${allListings.length} listings`);
      return allListings;

    } catch (error: any) {
      console.error(`[${offerType}] Scraping failed:`, error.message);
      throw error;
    }
  }

  /**
   * Scrape rentals
   */
  async scrapeRentals(onBatch?: (batch: UlovDomovOffer[]) => Promise<void>): Promise<UlovDomovOffer[]> {
    return this.scrapeByType('rent', onBatch);
  }

  /**
   * Scrape sales
   */
  async scrapeSales(onBatch?: (batch: UlovDomovOffer[]) => Promise<void>): Promise<UlovDomovOffer[]> {
    return this.scrapeByType('sale', onBatch);
  }

  /**
   * Scrape coliving
   */
  async scrapeColiving(onBatch?: (batch: UlovDomovOffer[]) => Promise<void>): Promise<UlovDomovOffer[]> {
    return this.scrapeByType('coliving', onBatch);
  }
}
