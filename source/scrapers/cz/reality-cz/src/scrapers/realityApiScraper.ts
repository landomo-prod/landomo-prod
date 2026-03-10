import { getRealityAuth, RealityAuth } from '../utils/realityAuth';
import {
  RealityListing,
  RealityApiSearchResponse,
  RealityApiDetailResponse,
  RealityApiListItem,
  ScrapingContext,
  PropertyTypeCzech,
  apiDetailToListing,
} from '../types/realityTypes';

const ITEMS_PER_REQUEST = 100;
const RATE_LIMIT_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Reality.cz API scraper - replaces Puppeteer-based HTML scraper.
 * Uses the reverse-engineered mobile API for faster, more reliable data extraction.
 */
export class RealityApiScraper {
  private auth: RealityAuth;

  constructor() {
    this.auth = getRealityAuth();
  }

  /**
   * Scrape listings for a given offer type and property kind.
   * Fetches search results then detail pages for full data.
   *
   * @param onBatch - Optional callback that receives batches of listings as they're fetched (50 at a time)
   */
  async scrape(
    offerType: 'prodej' | 'pronajem',
    propertyType: PropertyTypeCzech,
    region?: string,
    take: number = ITEMS_PER_REQUEST,
    onBatch?: (batch: RealityListing[]) => Promise<void>
  ): Promise<RealityListing[]> {
    const transactionType = offerType === 'prodej' ? 'sale' : 'rent';
    console.log(`[RealityAPI] Scraping ${offerType}/${propertyType}${region ? `/${region}` : ''}...`);

    // 1. Discover all listing IDs via search pagination
    const listItems = await this.fetchAllSearchResults(offerType, propertyType, region, take);
    console.log(`[RealityAPI] Found ${listItems.length} listings in search`);

    if (listItems.length === 0) return [];

    // 2. Fetch detail for each listing, sending batches as we go
    const listings: RealityListing[] = [];
    const BATCH_SIZE = 50; // Send every 50 listings
    let currentBatch: RealityListing[] = [];

    for (let i = 0; i < listItems.length; i++) {
      try {
        const detail = await this.fetchDetail(listItems[i].id);
        if (detail && !detail.err) {
          const listing = apiDetailToListing(detail, transactionType);
          listings.push(listing);
          currentBatch.push(listing);

          // Send batch when it reaches BATCH_SIZE
          if (currentBatch.length >= BATCH_SIZE && onBatch) {
            console.log(`[RealityAPI] Sending batch of ${currentBatch.length} listings...`);
            await onBatch(currentBatch);
            currentBatch = [];
          }
        }
      } catch (err: any) {
        console.warn(`[RealityAPI] Failed to fetch detail for ${listItems[i].id}: ${err.message}`);
      }

      if (i < listItems.length - 1) {
        await sleep(RATE_LIMIT_MS);
      }

      if ((i + 1) % 50 === 0) {
        console.log(`[RealityAPI] Fetched ${i + 1}/${listItems.length} details`);
      }
    }

    // Send remaining batch if any
    if (currentBatch.length > 0 && onBatch) {
      console.log(`[RealityAPI] Sending final batch of ${currentBatch.length} listings...`);
      await onBatch(currentBatch);
    }

    console.log(`[RealityAPI] Completed ${offerType}/${propertyType}: ${listings.length} listings`);
    return listings;
  }

  /**
   * Paginate through search results to collect all listing IDs + GPS.
   * Public so the three-phase orchestrator can call it directly for Phase 1.
   */
  async fetchAllSearchResults(
    offerType: string,
    propertyType: string,
    region: string | undefined,
    take: number
  ): Promise<RealityApiListItem[]> {
    const allItems: RealityApiListItem[] = [];
    let skip = 0;
    let totalCount = Infinity;

    while (skip < totalCount) {
      const loc = region || 'Ceska-republika';
    const path = `/${offerType}/${propertyType}/${loc}/?skip=${skip}&take=${take}`;

      const response = await this.auth.request<RealityApiSearchResponse>(path);

      if (response.err) {
        console.warn(`[RealityAPI] Search error: ${response.err}`);
        break;
      }

      totalCount = response.count;

      if (!response.advertisements || response.advertisements.length === 0) {
        break;
      }

      allItems.push(...response.advertisements);
      skip += response.advertisements.length;

      console.log(`[RealityAPI] Search progress: ${allItems.length}/${totalCount}`);

      if (response.advertisements.length < take) {
        break; // Last page
      }

      await sleep(RATE_LIMIT_MS);
    }

    return allItems;
  }

  /**
   * Fetch full detail for a single listing.
   */
  private async fetchDetail(id: string): Promise<RealityApiDetailResponse> {
    return this.auth.request<RealityApiDetailResponse>(`/${id}/`);
  }

  /**
   * Scrape all sales listings (apartments, houses, land, commercial).
   *
   * @param onBatch - Optional callback that receives batches of listings as they're fetched
   */
  async scrapeSales(onBatch?: (batch: RealityListing[]) => Promise<void>): Promise<RealityListing[]> {
    const types: PropertyTypeCzech[] = ['byty', 'domy', 'pozemky', 'komercni'];
    const all: RealityListing[] = [];

    for (const type of types) {
      const listings = await this.scrape('prodej', type, undefined, ITEMS_PER_REQUEST, onBatch);
      all.push(...listings);
    }

    return all;
  }

  /**
   * Scrape all rental listings.
   *
   * @param onBatch - Optional callback that receives batches of listings as they're fetched
   */
  async scrapeRentals(onBatch?: (batch: RealityListing[]) => Promise<void>): Promise<RealityListing[]> {
    const types: PropertyTypeCzech[] = ['byty', 'domy', 'pozemky', 'komercni'];
    const all: RealityListing[] = [];

    for (const type of types) {
      const listings = await this.scrape('pronajem', type, undefined, ITEMS_PER_REQUEST, onBatch);
      all.push(...listings);
    }

    return all;
  }

  /**
   * Scrape everything (sales + rentals).
   *
   * @param onBatch - Optional callback that receives batches of listings as they're fetched
   */
  async scrapeAll(onBatch?: (batch: RealityListing[]) => Promise<void>): Promise<RealityListing[]> {
    console.log('[RealityAPI] Starting full scrape...');
    const sales = await this.scrapeSales(onBatch);
    const rentals = await this.scrapeRentals(onBatch);
    const all = [...sales, ...rentals];
    console.log(`[RealityAPI] Full scrape complete: ${all.length} total listings`);
    return all;
  }
}
