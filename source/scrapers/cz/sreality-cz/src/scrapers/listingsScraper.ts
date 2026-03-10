import { fetchAllListingPages } from '../utils/fetchData';
import { SRealityListing, SRealityDetailResponse } from '../types/srealityTypes';
import { fetchDetailsBatch, getDetailFetchStats } from './detailScraper';
import { detectChangedListings } from '../utils/changeDetector';

export interface EnrichedListing extends SRealityListing {
  _inactive?: boolean;
  _inactiveReason?: 'http_410' | 'logged_in_false';
}

export interface ScraperStats {
  totalProcessed: number;
  newEstates: number;
  categories: Record<string, number>;
}

export interface CategoryConfig {
  main: number;
  type: number;
}

/**
 * Scrape SReality listings from multiple categories
 */
export class ListingsScraper {
  private configs: CategoryConfig[];

  constructor(configs: CategoryConfig[] = [
    { main: 1, type: 1 }, // Apartments Sale
    { main: 1, type: 2 }, // Apartments Rent
    { main: 2, type: 1 }, // Houses Sale
    { main: 2, type: 2 }, // Houses Rent
    { main: 3, type: 1 }, // Land Sale
    { main: 3, type: 2 }, // Land Rent
    { main: 4, type: 1 }, // Commercial Sale
    { main: 4, type: 2 }, // Commercial Rent
  ]) {
    this.configs = configs;
  }

  /**
   * Scrape all listings from configured categories
   */
  async scrapeAll(onBatch?: (batch: EnrichedListing[]) => Promise<void>): Promise<EnrichedListing[]> {
    console.log(JSON.stringify({ level: 'info', service: 'sreality-scraper', msg: 'Starting SReality scrape', combinations: this.configs.length }));

    const allListings: SRealityListing[] = [];
    const stats: ScraperStats = {
      totalProcessed: 0,
      newEstates: 0,
      categories: {}
    };

    // Process categories SEQUENTIALLY to avoid overwhelming the API with too much concurrency
    // (Each category already does parallel page fetching internally)
    for (const config of this.configs) {
      const listings = await this.scrapeCategory(config.main, config.type, onBatch);

      allListings.push(...listings);
      stats.totalProcessed += listings.length;
      const key = `${config.main}-${config.type}`;
      stats.categories[key] = listings.length;

      console.log(JSON.stringify({ level: 'info', service: 'sreality-scraper', msg: 'Category scraped', category: config.main, type: config.type, count: listings.length }));
    }

    console.log(JSON.stringify({ level: 'info', service: 'sreality-scraper', msg: 'Scraping complete', totalProcessed: stats.totalProcessed }));

    return allListings;
  }

  /**
   * Scrape a single category using 3-phase execution model with change detection
   *
   * Phase 1: Collect all listing IDs (parallel pages)
   * Phase 1.5: Detect changes (skip details for unchanged listings)
   * Phase 2: Fetch detail pages only for new/changed (rate-limited, bounded concurrency)
   * Phase 3: Merge and stream in batches
   */
  private async scrapeCategory(
    category: number,
    categoryType: number,
    onBatch?: (batch: EnrichedListing[]) => Promise<void>
  ): Promise<EnrichedListing[]> {
    const startTime = Date.now();

    // PHASE 1: Collect all listing IDs (parallel pages with rotating headers)
    console.log(JSON.stringify({ level: 'info', service: 'sreality-scraper', msg: 'Phase 1: Collecting listings', category, categoryType }));
    const phase1Start = Date.now();

    const listings = await fetchAllListingPages(category, categoryType);

    console.log(JSON.stringify({ level: 'info', service: 'sreality-scraper', msg: 'Phase 1 complete', category, categoryType, count: listings.length, durationMs: Date.now() - phase1Start }));

    if (listings.length === 0) {
      console.log(JSON.stringify({ level: 'info', service: 'sreality-scraper', msg: 'No listings found', category, categoryType }));
      return [];
    }

    // PHASE 1.5: Detect changes (skip details for unchanged)
    console.log(JSON.stringify({ level: 'info', service: 'sreality-scraper', msg: 'Phase 1.5: Detecting changes', category, categoryType }));
    const changeDetection = detectChangedListings(listings);

    console.log(JSON.stringify({ level: 'info', service: 'sreality-scraper', msg: 'Change detection results', category, categoryType, new: changeDetection.totalNew, changed: changeDetection.totalChanged, unchanged: changeDetection.totalUnchanged }));

    const needsDetails = [...changeDetection.newListings, ...changeDetection.changedListings];
    console.log(JSON.stringify({ level: 'info', service: 'sreality-scraper', msg: 'Fetching details for changed properties', needsDetails: needsDetails.length, skipped: changeDetection.totalUnchanged }));

    // PHASE 2: Fetch detail pages only for new/changed (rate-limited, bounded concurrency)
    let detailResults = new Map();

    if (needsDetails.length > 0) {
      console.log(JSON.stringify({ level: 'info', service: 'sreality-scraper', msg: 'Phase 2: Fetching detail pages', category, categoryType, count: needsDetails.length }));
      const phase2Start = Date.now();

      detailResults = await fetchDetailsBatch(needsDetails, (current, total) => {
        // Log progress every 100 details
        if (current % 100 === 0) {
          console.log(JSON.stringify({ level: 'info', service: 'sreality-scraper', msg: 'Detail progress', category, categoryType, current, total }));
        }
      });

      const detailStats = getDetailFetchStats(detailResults);
      console.log(JSON.stringify({ level: 'info', service: 'sreality-scraper', msg: 'Phase 2 complete', category, categoryType, successful: detailStats.successful, inactive: detailStats.inactive, failed: detailStats.failed, durationMs: Date.now() - phase2Start }));
    } else {
      console.log(JSON.stringify({ level: 'info', service: 'sreality-scraper', msg: 'Phase 2: Skipped, no new/changed properties', category, categoryType }));
    }

    // PHASE 3: Merge and stream in batches (memory-efficient)
    console.log(JSON.stringify({ level: 'info', service: 'sreality-scraper', msg: 'Phase 3: Merging and streaming data', category, categoryType }));
    const phase3Start = Date.now();

    const BATCH_SIZE = 25; // Reduced from 100 to avoid database timeout issues
    const enrichedListings: EnrichedListing[] = [];

    for (let i = 0; i < listings.length; i += BATCH_SIZE) {
      const batch = listings.slice(i, i + BATCH_SIZE);

      const enrichedBatch = batch.map(listing => {
        const detailResult = detailResults.get(listing.hash_id);

        if (!detailResult) {
          return listing;
        }

        if (detailResult.error) {
          return listing;
        }

        if (detailResult.isInactive) {
          return {
            ...listing,
            _inactive: true,
            _inactiveReason: detailResult.inactiveReason
          };
        }

        // Merge detail data into listing, preserving list-only fields (e.g., gps, labelsAll)
        // Detail fields take priority except for gps (list has it, detail uses map.*)
        const detail = detailResult.detail;
        return {
          ...listing,
          items: [...(listing.items || []), ...(detail?.items || [])],
          text: detail?.text || listing.text,
          // Merge detail-only structured fields
          codeItems: detail?.codeItems,
          map: detail?.map,
          // Merge _embedded: detail seller/images override list defaults
          _embedded: {
            ...(listing._embedded || {}),
            ...(detail?._embedded || {}),
          },
        };
      });

      // Stream batch immediately if callback provided
      if (onBatch) {
        await onBatch(enrichedBatch);
      } else {
        // Fallback: accumulate if no callback (for backwards compatibility)
        enrichedListings.push(...enrichedBatch);
      }
    }

    console.log(JSON.stringify({ level: 'info', service: 'sreality-scraper', msg: 'Phase 3 complete', category, categoryType, durationMs: Date.now() - phase3Start, totalMs: Date.now() - startTime }));

    return enrichedListings;
  }
}
