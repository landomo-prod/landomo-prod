import axios from 'axios';
import {
  VuokrauviAnnouncement,
  VuokrauviSearchRequest,
  VuokrauviSearchResponse,
} from '../types/vuokrauviTypes';
import { getRandomUserAgent } from '../utils/userAgents';

/**
 * Vuokraovi.com Search API
 *
 * Base URL:  https://api.vuokraovi.com/distant/swordsman/v3
 * Endpoint:  POST /announcements/rental/search/listpage
 *
 * Authentication: No user auth required (no session cookies needed).
 * Required headers:
 *   - X-PORTAL-IDENTIFIER: VUOKRAOVI
 *   - Content-Type: application/json
 *
 * Verified working via curl without browser session (2026-02-24).
 * Runs behind AWS API Gateway + CloudFront (x-amz-cf-pop: PRG50-P2).
 *
 * Pagination: page-based with firstResult + maxResults.
 * API supports up to 30 results per page. We use 30 for efficiency.
 *
 * Total listings: ~30,000 RESIDENTIAL + ~400 OTHER rentals.
 * Scrape time: ~17 minutes at 30 results/page with 10 concurrent requests.
 *
 * Real browser request body (captured 2026-02-24):
 * {
 *   locationSearchCriteria: {},
 *   lessorType: "ALL",
 *   publishingTimeSearchCriteria: "ANY_DAY",
 *   officeIds: null,
 *   rentMin/rentMax/checkIfHasImages/checkIfHasVideo/checkIfHasShowingWithinSevenDays: null,
 *   pagination: { sortingOrder: { property: "PUBLISHED_OR_UPDATED_AT", direction: "DESC" },
 *                 firstResult: 0, maxResults: 30, page: 1 },
 *   propertyType: "RESIDENTIAL",
 *   freeTextSearch: "",
 *   residentialPropertyTypes: [],
 *   roomCounts: null,
 *   sizeMin/sizeMax/yearMin/yearMax/overallConditions/kitchenTypes: null,
 *   livingFormTypes: [],
 *   rentalAgreements: [],
 *   rentalAvailabilities: [],
 *   rightOfOccupancy: "ALL",
 *   newBuildingSearchCriteria: "ALL_PROPERTIES"
 * }
 */

const API_BASE = 'https://api.vuokraovi.com/distant/swordsman/v3';
const SEARCH_ENDPOINT = `${API_BASE}/announcements/rental/search/listpage`;
const PAGE_SIZE = 30;
const MAX_CONCURRENT = 10;
const DELAY_BETWEEN_BATCHES_MS = 500;

function buildHeaders(): Record<string, string> {
  return {
    'User-Agent': getRandomUserAgent(),
    'Accept': 'application/json',
    'Accept-Language': 'fi-FI,fi;q=0.9,en;q=0.8',
    'Content-Type': 'application/json',
    'X-PORTAL-IDENTIFIER': 'VUOKRAOVI',
    'Origin': 'https://www.vuokraovi.com',
    'Referer': 'https://www.vuokraovi.com/vuokra-asunnot',
  };
}

function buildSearchRequest(page: number): VuokrauviSearchRequest {
  return {
    locationSearchCriteria: {},
    lessorType: 'ALL',
    publishingTimeSearchCriteria: 'ANY_DAY',
    officeIds: null,
    rentMin: null,
    rentMax: null,
    checkIfHasImages: null,
    checkIfHasPanorama: null,
    checkIfHasVideo: null,
    checkIfHasShowingWithinSevenDays: null,
    pagination: {
      sortingOrder: {
        property: 'PUBLISHED_OR_UPDATED_AT',
        direction: 'DESC',
      },
      firstResult: (page - 1) * PAGE_SIZE,
      maxResults: PAGE_SIZE,
      page,
    },
    propertyType: 'RESIDENTIAL',
    freeTextSearch: '',
    residentialPropertyTypes: [],
    roomCounts: null,
    sizeMin: null,
    sizeMax: null,
    yearMin: null,
    yearMax: null,
    overallConditions: null,
    kitchenTypes: null,
    livingFormTypes: [],
    rentalAgreements: [],
    rentalAvailabilities: [],
    rightOfOccupancy: 'ALL',
    newBuildingSearchCriteria: 'ALL_PROPERTIES',
  };
}

/**
 * Fetch a single page of listings from the Vuokraovi API.
 */
async function fetchPage(page: number): Promise<{ announcements: VuokrauviAnnouncement[]; total: number }> {
  const response = await axios.post<VuokrauviSearchResponse>(
    SEARCH_ENDPOINT,
    buildSearchRequest(page),
    {
      headers: buildHeaders(),
      timeout: 30000,
    }
  );

  const data = response.data;
  return {
    announcements: data.announcements || [],
    total: data.countOfAllResults || 0,
  };
}

/**
 * Main scraper class for Vuokraovi.com rental listings.
 *
 * Vuokraovi is a pure rental portal - all listings are rentals.
 * Only RESIDENTIAL and OTHER property types exist.
 * This scraper fetches RESIDENTIAL only (99% of listings).
 *
 * Strategy:
 *   1. Fetch page 1 to get total count
 *   2. Calculate total pages
 *   3. Fetch remaining pages in parallel batches of MAX_CONCURRENT
 *   4. Call onBatch callback after each parallel batch (streaming ingestion)
 */
export class ListingsScraper {
  /**
   * Scrape all RESIDENTIAL rental listings.
   * Calls onBatch for each page batch to enable streaming ingestion.
   */
  async scrapeAll(onBatch?: (batch: VuokrauviAnnouncement[]) => Promise<void>): Promise<VuokrauviAnnouncement[]> {
    console.log(JSON.stringify({
      level: 'info',
      service: 'vuokraovi-scraper',
      msg: 'Starting Vuokraovi scrape',
      streamingMode: !!onBatch,
    }));

    // Fetch page 1 to get total count
    const firstPage = await fetchPage(1);
    const totalFound = firstPage.total;

    console.log(JSON.stringify({
      level: 'info',
      service: 'vuokraovi-scraper',
      msg: 'Total listings found',
      total: totalFound,
    }));

    if (totalFound === 0 || firstPage.announcements.length === 0) {
      return [];
    }

    const allAnnouncements: VuokrauviAnnouncement[] = [...firstPage.announcements];

    if (onBatch && firstPage.announcements.length > 0) {
      await onBatch(firstPage.announcements);
    }

    // Calculate remaining pages (page 2 onwards)
    const totalPages = Math.ceil(totalFound / PAGE_SIZE);
    if (totalPages <= 1) {
      return allAnnouncements;
    }

    const remainingPages: number[] = [];
    for (let p = 2; p <= totalPages; p++) {
      remainingPages.push(p);
    }

    // Fetch remaining pages in parallel batches
    for (let i = 0; i < remainingPages.length; i += MAX_CONCURRENT) {
      const batchPages = remainingPages.slice(i, i + MAX_CONCURRENT);

      const results = await Promise.allSettled(
        batchPages.map(page => fetchPage(page))
      );

      const batchAnnouncements: VuokrauviAnnouncement[] = [];
      for (const result of results) {
        if (result.status === 'fulfilled') {
          batchAnnouncements.push(...result.value.announcements);
        } else {
          console.error(JSON.stringify({
            level: 'error',
            service: 'vuokraovi-scraper',
            msg: 'Page fetch failed',
            err: result.reason?.message || String(result.reason),
          }));
        }
      }

      allAnnouncements.push(...batchAnnouncements);

      if (onBatch && batchAnnouncements.length > 0) {
        await onBatch(batchAnnouncements);
      }

      console.log(JSON.stringify({
        level: 'info',
        service: 'vuokraovi-scraper',
        msg: 'Batch fetched',
        batchStart: i + 2,
        batchSize: batchAnnouncements.length,
        totalSoFar: allAnnouncements.length,
        totalExpected: totalFound,
      }));

      // Rate limit between batches
      if (i + MAX_CONCURRENT < remainingPages.length) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES_MS));
      }
    }

    console.log(JSON.stringify({
      level: 'info',
      service: 'vuokraovi-scraper',
      msg: 'Scrape complete',
      totalListings: allAnnouncements.length,
    }));

    return allAnnouncements;
  }
}
