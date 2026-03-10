import axios from 'axios';
import { BezRealitkyListResponse, BezRealitkyListingItem } from '../types/bezrealitkyTypes';
import { getRandomUserAgent } from '../utils/userAgents';
import { batchCreateBezrealitkyChecksums } from '../utils/checksumExtractor';
import { ChecksumClient, ChecksumBatchResponse } from '@landomo/core';

const BEZREALITKY_API_BASE = 'https://api.bezrealitky.cz/graphql/';

const ESTATE_TYPE_MAP: Record<string, string> = {
  BYT: 'apartment',
  DUM: 'house',
  POZEMEK: 'land',
  GARAZ: 'commercial',
  KANCELAR: 'commercial',
  NEBYTOVY_PROSTOR: 'commercial',
  REKREACNI_OBJEKT: 'house',
};

interface ScrapeOptions {
  maxListings?: number;
  offerType?: 'PRODEJ' | 'PRONAJEM';
  estateType?: 'BYT' | 'DUM' | 'POZEMEK' | 'GARAZ' | 'KANCELAR' | 'NEBYTOVY_PROSTOR' | 'REKREACNI_OBJEKT';
}

/**
 * GraphQL query for fetching listings
 */
const LISTINGS_QUERY = `query ListAdverts(
  $offerType: [OfferType],
  $estateType: [EstateType],
  $order: ResultOrder,
  $limit: Int,
  $offset: Int,
  $locale: Locale!
) {
  listAdverts(
    offerType: $offerType
    estateType: $estateType
    order: $order
    limit: $limit
    offset: $offset
    locale: $locale
  ) {
    totalCount
    list {
      id
      externalId
      hash
      uri
      code
      active
      isPausedBySystem
      isPausedByUser
      activationPending
      archived
      reserved
      highlighted
      isNew
      isEditable
      timeActivated
      timeDeactivated
      timeExpiration
      timeOrder
      daysActive
      title
      titleEnglish
      description
      descriptionEnglish
      descriptionSk
      imageAltText(locale: $locale)
      estateType
      offerType
      disposition
      landType
      houseType
      surface
      surfaceLand
      balconySurface
      loggiaSurface
      terraceSurface
      cellarSurface
      price
      priceFormatted(locale: $locale)
      deposit
      charges
      serviceCharges
      utilityCharges
      fee
      currency
      originalPrice
      isDiscounted
      serviceChargesNote
      utilityChargesNote
      gps {
        lat
        lng
      }
      address(locale: $locale)
      addressInput
      street
      houseNumber
      city(locale: $locale)
      cityDistrict(locale: $locale)
      zip
      region {
        id
        name
        uri
      }
      ruianId
      addressPointId
      isPrague
      isBrno
      isPragueWest
      isPragueEast
      isCityWithDistricts
      isTSRegion
      condition
      ownership
      equipped
      construction
      position
      situation
      floor
      totalFloors
      age
      execution
      reconstruction
      penb
      lowEnergy
      heating
      water
      sewage
      parking
      garage
      lift
      balcony
      terrace
      cellar
      loggia
      frontGarden
      newBuilding
      petFriendly
      barrierFree
      roommate
      shortTerm
      minRentDays
      maxRentDays
      availableFrom
      publicImages {
        id
        url(filter: RECORD_MAIN)
        order
        main
        filename
      }
      tour360
      visitCount
      conversationCount
      locale
      charity
      showOwnest
      showPriceSuggestionButton
      threesome
      fivesome
      brizCount
      realmanExportEnabled
      hasContractRent
      rentPlatformStatus
      rentPlatformOrder
      tags(locale: $locale)
    }
  }
}`;

/**
 * Scrape BezRealitky listings
 */
export class ListingsScraper {
  private offerTypes: Array<'PRODEJ' | 'PRONAJEM'>;
  private estateTypes: string[];

  constructor() {
    // Scrape both sales and rentals
    this.offerTypes = ['PRODEJ', 'PRONAJEM'];
    // Include all 7 estate types
    this.estateTypes = [
      'BYT',              // Apartments
      'DUM',              // Houses
      'POZEMEK',          // Land
      'GARAZ',            // Garages
      'KANCELAR',         // Offices/Commercial
      'NEBYTOVY_PROSTOR', // Non-residential spaces
      'REKREACNI_OBJEKT'  // Recreational facilities
    ];
  }

  /**
   * Scrape all listings
   * @param onBatch - Optional streaming callback. Called after each page-batch with those listings.
   */
  async scrapeAll(onBatch?: (batch: BezRealitkyListingItem[]) => Promise<void>, categories?: string[]): Promise<BezRealitkyListingItem[]> {
    console.log(JSON.stringify({ level: 'info', service: 'bezrealitky-scraper', msg: 'Starting BezRealitky scrape', streamingMode: !!onBatch }));

    const allListings: BezRealitkyListingItem[] = [];

    // Filter estate types if categories specified
    const effectiveEstateTypes = categories
      ? this.estateTypes.filter(et => categories.includes(ESTATE_TYPE_MAP[et]))
      : this.estateTypes;

    if (categories) {
      console.log(JSON.stringify({ level: 'info', service: 'bezrealitky-scraper', msg: 'Category filter', categories, estateTypes: effectiveEstateTypes }));
    }

    // Process all combinations of offer types and estate types
    for (const offerType of this.offerTypes) {
      for (const estateType of effectiveEstateTypes) {
        console.log(JSON.stringify({ level: 'info', service: 'bezrealitky-scraper', msg: 'Scraping category', offerType, estateType }));

        const listings = await this.scrapeCategory(offerType, estateType as any, onBatch);
        allListings.push(...listings);

        console.log(JSON.stringify({ level: 'info', service: 'bezrealitky-scraper', msg: 'Listings found', count: listings.length, offerType, estateType }));

        // Small delay between categories
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log(JSON.stringify({ level: 'info', service: 'bezrealitky-scraper', msg: 'Scraping complete', totalListings: allListings.length }));
    return allListings;
  }

  /**
   * Scrape a specific category (offer type + estate type).
   * Calls onBatch after each parallel page-fetch (max ~1,200 listings per call).
   */
  private async scrapeCategory(
    offerType: 'PRODEJ' | 'PRONAJEM',
    estateType: string,
    onBatch?: (batch: BezRealitkyListingItem[]) => Promise<void>
  ): Promise<BezRealitkyListingItem[]> {
    const allListings: BezRealitkyListingItem[] = [];
    const ITEMS_PER_PAGE = 60;
    const CONCURRENT_PAGES = 20; // Fetch 20 pages at once

    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      // Calculate offsets for this batch
      const offsetsInBatch = Array.from(
        { length: CONCURRENT_PAGES },
        (_, i) => offset + (i * ITEMS_PER_PAGE)
      );

      // Fetch all pages in parallel
      const pageResults = await Promise.allSettled(
        offsetsInBatch.map(off => this.fetchPage(off, ITEMS_PER_PAGE, offerType, estateType))
      );

      // Collect this page-batch's listings
      const pageBatchListings: BezRealitkyListingItem[] = [];
      let pagesWithData = 0;
      let totalCount = 0;

      for (const result of pageResults) {
        if (result.status === 'fulfilled') {
          const { listings: pageListings, totalCount: tc } = result.value;
          totalCount = tc;

          if (pageListings.length > 0) {
            pagesWithData++;
            pageBatchListings.push(...pageListings);
          }
        } else {
          console.error(JSON.stringify({ level: 'error', service: 'bezrealitky-scraper', msg: 'Failed to fetch page', err: result.reason?.message || String(result.reason) }));
        }
      }

      // Stream this page-batch immediately (one batch per 20 parallel pages)
      if (pageBatchListings.length > 0) {
        allListings.push(...pageBatchListings);

        if (onBatch) {
          try {
            await onBatch(pageBatchListings);
          } catch (err: any) {
            console.error(JSON.stringify({ level: 'error', service: 'bezrealitky-scraper', msg: 'Failed to stream batch', offerType, estateType, err: err.message }));
          }
        }

        // Check if we've reached the end
        if (allListings.length >= totalCount) {
          hasMore = false;
        }
      }

      // If no pages had data, we're done
      if (pagesWithData === 0) {
        hasMore = false;
      }

      // Move to next batch
      offset += CONCURRENT_PAGES * ITEMS_PER_PAGE;

      // Brief pause between batches
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    return allListings;
  }

  /**
   * Fetch a single page of listings with retry logic
   */
  private async fetchPage(
    offset: number,
    limit: number,
    offerType: string,
    estateType: string
  ): Promise<{ listings: BezRealitkyListingItem[], totalCount: number }> {
    const MAX_RETRIES = 3;
    const BASE_DELAY_MS = 2000;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const variables = {
          offerType: [offerType],
          estateType: [estateType],
          order: 'TIMEORDER_DESC',
          limit,
          offset,
          locale: 'CS',
        };

        const response = await axios.post<BezRealitkyListResponse>(
          BEZREALITKY_API_BASE,
          {
            operationName: 'ListAdverts',
            variables,
            query: LISTINGS_QUERY,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': getRandomUserAgent(),
              Accept: 'application/json',
            },
            timeout: 30000,
          }
        );

        // Validate response
        if (response.data.errors) {
          throw new Error(`GraphQL errors: ${JSON.stringify(response.data.errors)}`);
        }

        if (!response.data.data?.listAdverts) {
          throw new Error('Invalid API response structure');
        }

        const data = response.data.data.listAdverts;
        const listings = data.list || [];

        return {
          listings,
          totalCount: data.totalCount || 0,
        };
      } catch (err: any) {
        const status = err?.response?.status;
        const isRetryable = status === 429 || (status >= 500 && status < 600) || !status;

        if (isRetryable && attempt < MAX_RETRIES) {
          const delay = BASE_DELAY_MS * Math.pow(2, attempt);
          console.error(JSON.stringify({ level: 'warn', service: 'bezrealitky-scraper', msg: 'Retrying fetchPage', attempt: attempt + 1, status, offset, delay }));
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw err;
      }
    }

    // Should not reach here, but TypeScript needs it
    throw new Error('fetchPage: exhausted retries');
  }
}

/**
 * Scrape with checksum-aware filtering
 *
 * This function wraps scrapeAll() with checksum comparison to dramatically reduce
 * ingestion volume by filtering out unchanged properties.
 *
 * Process:
 * 1. Fetch all listing pages (just list data - cheap)
 * 2. Generate checksums (price, title, description, sqm, bedrooms, floor)
 * 3. Compare checksums against database (identify new/changed/unchanged)
 * 4. Filter to only new/changed listings (10-20% typically)
 * 5. Update checksums in database for all listings seen
 *
 * @param ingestApiUrl - Ingest API base URL (e.g., http://localhost:3008)
 * @param ingestApiKey - API key for authentication
 * @param scrapeRunId - Optional scrape run ID for tracking
 * @returns Object with filtered listings and statistics
 *
 * @example
 * const result = await scrapeWithChecksums(
 *   'http://ingest-czech:3000',
 *   'dev_key_cz_1',
 *   'run_12345'
 * );
 * console.log(`Reduced from ${result.stats.total} to ${result.listings.length}`);
 * console.log(`Savings: ${result.stats.savingsPercent}%`);
 */
export async function scrapeWithChecksums(
  ingestApiUrl: string,
  ingestApiKey: string,
  scrapeRunId?: string,
  categories?: string[]
): Promise<{
  listings: BezRealitkyListingItem[];
  checksums: import('@landomo/core').ListingChecksum[];
  checksumClient: ChecksumClient;
  stats: {
    total: number;
    new: number;
    changed: number;
    unchanged: number;
    savingsPercent: number;
  };
  comparison: ChecksumBatchResponse;
}> {
  console.log(JSON.stringify({ level: 'info', service: 'bezrealitky-scraper', msg: 'Starting checksum-aware scraping' }));

  // 1. Fetch all listings using existing scraper
  const scraper = new ListingsScraper();
  const allListings = await scraper.scrapeAll(undefined, categories);
  console.log(JSON.stringify({ level: 'info', service: 'bezrealitky-scraper', msg: 'Fetched listing pages', count: allListings.length }));

  // 2. Generate checksums from all listings
  console.log(JSON.stringify({ level: 'info', service: 'bezrealitky-scraper', msg: 'Generating checksums' }));
  const checksums = batchCreateBezrealitkyChecksums(allListings);
  console.log(JSON.stringify({ level: 'info', service: 'bezrealitky-scraper', msg: 'Generated checksums', count: checksums.length }));

  // 3. Compare against database
  console.log(JSON.stringify({ level: 'info', service: 'bezrealitky-scraper', msg: 'Comparing checksums against database' }));
  const checksumClient = new ChecksumClient(ingestApiUrl, ingestApiKey);
  const comparison = await checksumClient.compareChecksums(checksums, scrapeRunId);
  console.log(JSON.stringify({ level: 'info', service: 'bezrealitky-scraper', msg: 'Checksum comparison complete', new: comparison.new, changed: comparison.changed, unchanged: comparison.unchanged }));

  // 4. Filter to only new/changed listings
  const changedPortalIds = new Set(
    comparison.results
      .filter(r => r.status === 'new' || r.status === 'changed')
      .map(r => r.portalId)
  );

  const filteredListings = allListings.filter(listing =>
    changedPortalIds.has(listing.id)
  );

  console.log(JSON.stringify({ level: 'info', service: 'bezrealitky-scraper', msg: 'Filtered listings needing ingestion', count: filteredListings.length }));

  // 5. Checksums are NOT saved here. They will be saved by the caller
  //    after each batch is successfully ingested, to avoid the bug where
  //    checksums are recorded but ingest never happened.

  // Calculate savings percentage
  const savingsPercent = allListings.length > 0
    ? Math.round((comparison.unchanged / allListings.length) * 100)
    : 0;

  console.log(JSON.stringify({ level: 'info', service: 'bezrealitky-scraper', msg: 'Checksum-aware scraping complete', totalListings: allListings.length, needIngestion: filteredListings.length, savingsPercent, skipped: comparison.unchanged }));

  return {
    listings: filteredListings,
    checksums,
    checksumClient,
    stats: {
      total: allListings.length,
      new: comparison.new,
      changed: comparison.changed,
      unchanged: comparison.unchanged,
      savingsPercent,
    },
    comparison,
  };
}
