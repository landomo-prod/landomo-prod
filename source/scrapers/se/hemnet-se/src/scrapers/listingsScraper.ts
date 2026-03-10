import axios, { AxiosInstance } from 'axios';
import { getRandomUserAgent } from '../utils/userAgents';
import {
  HemnetListing,
  HemnetGraphQLResponse,
  HousingFormGroup,
  HOUSING_FORM_GROUPS,
} from '../types/hemnetTypes';

const HEMNET_GRAPHQL_URL = 'https://www.hemnet.se/graphql';

/**
 * Max results per API call: limit + offset must be <= 3000
 * (Hemnet imposes a hard 3000 result window per search query)
 */
const MAX_OFFSET = 3000;
const PAGE_SIZE = 500;

/**
 * GraphQL query for listing search.
 * Fields discovered by iterative error probing against the live API.
 */
const LISTINGS_QUERY = `
  query HemnetSearchListings($limit: Int!, $offset: Int!, $housingFormGroups: [HousingFormGroup!]) {
    searchListings(
      limit: $limit
      offset: $offset
      search: { housingFormGroups: $housingFormGroups }
    ) {
      total
      listings {
        __typename
        id
        title
        fee { amount }
        squareMeterPrice { amount }
        askingPrice { amount }
        livingArea
        landArea
        area
        numberOfRooms
        locationName
        streetAddress
        postCode
        postalArea
        housingForm {
          name
          groups
        }
        ... on ActivePropertyListing {
          daysOnHemnet
          publishedAt
        }
      }
    }
  }
`;

export interface ScrapeStats {
  total: number;
  scraped: number;
  byGroup: Record<string, number>;
}

/**
 * Hemnet listings scraper using GraphQL API.
 *
 * Strategy:
 * 1. For each housing form group (APARTMENTS, HOUSES, etc.), fetch all listings
 * 2. Each group is paginated using offset (max window: 3000 per group)
 * 3. APARTMENTS has ~28k listings - these are the same listings the site shows,
 *    but due to the 3000 limit, we get the ~3000 most recently added per run.
 *    For full coverage, run frequently (daily) to catch all new listings.
 */
export class ListingsScraper {
  private client: AxiosInstance;
  private requestDelay: number;

  constructor() {
    this.requestDelay = parseInt(process.env.REQUEST_DELAY_MS || '300', 10);
    this.client = axios.create({
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Origin': 'https://www.hemnet.se',
        'Referer': 'https://www.hemnet.se/bostader',
      },
    });
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Fetch one page of listings for a given group
   */
  private async fetchPage(
    group: HousingFormGroup,
    offset: number,
    limit: number
  ): Promise<{ total: number; listings: HemnetListing[] }> {
    const userAgent = getRandomUserAgent();

    const response = await this.client.post<HemnetGraphQLResponse>(
      HEMNET_GRAPHQL_URL,
      {
        query: LISTINGS_QUERY,
        variables: {
          limit,
          offset,
          housingFormGroups: [group],
        },
      },
      {
        headers: { 'User-Agent': userAgent },
      }
    );

    if (response.data.errors && response.data.errors.length > 0) {
      const errorMessages = response.data.errors.map(e => e.message).join('; ');
      throw new Error(`GraphQL errors: ${errorMessages}`);
    }

    const result = response.data.data?.searchListings;
    if (!result) {
      throw new Error('No searchListings in response');
    }

    return {
      total: result.total,
      listings: result.listings,
    };
  }

  /**
   * Scrape all listings for one housing form group.
   * Due to Hemnet's 3000-record window limit, we collect at most 3000 listings per group.
   * For APARTMENTS (~28k total), this means we get the most recently published ones.
   */
  private async scrapeGroup(
    group: HousingFormGroup,
    onBatch: (batch: HemnetListing[]) => Promise<void>
  ): Promise<number> {
    let offset = 0;
    let total = 0;
    let scraped = 0;

    console.log(JSON.stringify({
      level: 'info',
      service: 'hemnet-scraper',
      msg: 'Starting group scrape',
      group,
    }));

    do {
      const limit = Math.min(PAGE_SIZE, MAX_OFFSET - offset);
      if (limit <= 0) {
        console.log(JSON.stringify({
          level: 'info',
          service: 'hemnet-scraper',
          msg: 'Reached 3000-record window limit for group',
          group,
          offset,
          scraped,
          total,
        }));
        break;
      }

      const page = await this.fetchPage(group, offset, limit);
      total = page.total;

      if (page.listings.length === 0) {
        break;
      }

      await onBatch(page.listings);
      scraped += page.listings.length;
      offset += page.listings.length;

      console.log(JSON.stringify({
        level: 'info',
        service: 'hemnet-scraper',
        msg: 'Fetched page',
        group,
        offset,
        pageSize: page.listings.length,
        scraped,
        total,
        windowMax: MAX_OFFSET,
      }));

      if (page.listings.length < limit) {
        // Last page
        break;
      }

      await this.sleep(this.requestDelay);
    } while (offset < Math.min(total, MAX_OFFSET));

    console.log(JSON.stringify({
      level: 'info',
      service: 'hemnet-scraper',
      msg: 'Group scrape complete',
      group,
      scraped,
      total,
    }));

    return scraped;
  }

  /**
   * Scrape all housing form groups.
   * Calls onBatch for each page of results.
   */
  async scrapeAll(
    onBatch: (batch: HemnetListing[]) => Promise<void>
  ): Promise<ScrapeStats> {
    const stats: ScrapeStats = {
      total: 0,
      scraped: 0,
      byGroup: {},
    };

    for (const group of HOUSING_FORM_GROUPS) {
      try {
        const groupScraped = await this.scrapeGroup(group, onBatch);
        stats.byGroup[group] = groupScraped;
        stats.scraped += groupScraped;

        // Brief pause between groups
        await this.sleep(this.requestDelay * 2);
      } catch (error: any) {
        console.error(JSON.stringify({
          level: 'error',
          service: 'hemnet-scraper',
          msg: 'Error scraping group',
          group,
          err: error.message,
        }));
        // Continue with other groups
      }
    }

    // Get rough total from first group's reported count
    stats.total = stats.scraped;

    return stats;
  }
}
