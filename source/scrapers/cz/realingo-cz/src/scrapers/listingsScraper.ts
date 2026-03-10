import axios, { AxiosInstance } from 'axios';
import { RealingoOffer, RealingoSearchResponse, RealingoSearchVariables } from '../types/realingoTypes';

/**
 * Realingo.cz GraphQL API scraper
 * Based on API inspection: https://www.realingo.cz/graphql
 */
export class ListingsScraper {
  private client: AxiosInstance;
  private graphqlUrl = 'https://www.realingo.cz/graphql';

  constructor() {
    this.client = axios.create({
      baseURL: this.graphqlUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });
  }

  /**
   * GraphQL SearchOffer query
   */
  private getSearchOfferQuery(): string {
    return `
      query SearchOffer(
        $purpose: OfferPurpose,
        $property: PropertyType,
        $saved: Boolean,
        $categories: [OfferCategory!],
        $area: RangeInput,
        $plotArea: RangeInput,
        $price: RangeInput,
        $first: Int,
        $skip: Int
      ) {
        searchOffer(
          filter: {
            purpose: $purpose
            property: $property
            saved: $saved
            categories: $categories
            area: $area
            plotArea: $plotArea
            price: $price
          }
          first: $first
          skip: $skip
        ) {
          total
          items {
            id
            adId
            category
            url
            property
            purpose
            location {
              address
              latitude
              longitude
            }
            price {
              total
              currency
              vat
            }
            area {
              main
              floor
              plot
              garden
              built
              cellar
              balcony
              terrace
              loggia
            }
            photos {
              main
              list
            }
            updatedAt
            createdAt
          }
        }
      }
    `;
  }

  /**
   * Execute GraphQL query
   */
  private async executeQuery(
    query: string,
    variables: RealingoSearchVariables
  ): Promise<RealingoSearchResponse> {
    try {
      const response = await this.client.post<RealingoSearchResponse>('', {
        query,
        variables
      });

      return response.data;
    } catch (error: any) {
      console.error('GraphQL query failed:', error.message);
      if (error.response?.data) {
        console.error('GraphQL errors:', JSON.stringify(error.response.data.errors, null, 2));
      }
      throw error;
    }
  }

  /**
   * Fetch offers with pagination
   */
  async fetchOffers(
    variables: RealingoSearchVariables,
    first: number = 100,
    skip: number = 0
  ): Promise<{ items: RealingoOffer[]; total: number }> {
    const query = this.getSearchOfferQuery();
    const vars = { ...variables, first, skip };

    const response = await this.executeQuery(query, vars);

    return {
      items: response.data.searchOffer.items,
      total: response.data.searchOffer.total
    };
  }

  /**
   * Scrape all listings matching criteria
   * @param variables - GraphQL search variables
   * @param onBatch - Optional streaming callback. When provided, each page of results
   *                  is passed to this callback as it's fetched, enabling streaming ingestion.
   *                  The full list is still returned for backward compatibility.
   */
  async scrapeAll(
    variables: RealingoSearchVariables = {},
    onBatch?: (batch: RealingoOffer[]) => Promise<void>
  ): Promise<RealingoOffer[]> {
    console.log('Starting Realingo scrape...');
    console.log('Filters:', JSON.stringify(variables, null, 2));
    if (onBatch) console.log('Streaming mode: enabled');

    const allListings: RealingoOffer[] = [];
    const first = 100; // Items per page
    let skip = 0;
    let total = 0;
    let pageCount = 0;

    try {
      // First request to get total count
      const firstPage = await this.fetchOffers(variables, first, skip);
      total = firstPage.total;
      allListings.push(...firstPage.items);
      pageCount = 1;

      console.log(`Total properties to fetch: ${total}`);
      console.log(`Fetched page 1: ${firstPage.items.length} items (total: ${allListings.length}/${total})`);

      // Stream first batch
      if (onBatch && firstPage.items.length > 0) {
        try {
          await onBatch(firstPage.items);
        } catch (err: any) {
          console.error(`Failed to stream batch 1: ${err.message}`);
        }
      }

      // Fetch remaining pages
      while (allListings.length < total) {
        pageCount++;
        skip = allListings.length;
        console.log(`Fetching page ${pageCount} (skip: ${skip})...`);

        const page = await this.fetchOffers(variables, first, skip);
        allListings.push(...page.items);

        console.log(`  ✓ Fetched ${page.items.length} items (total: ${allListings.length}/${total})`);

        // Stream this page
        if (onBatch && page.items.length > 0) {
          try {
            await onBatch(page.items);
          } catch (err: any) {
            console.error(`Failed to stream batch ${pageCount}: ${err.message}`);
          }
        }

        // Break if no more items
        if (page.items.length === 0) {
          break;
        }

        // Small delay to be respectful to API
        if (allListings.length < total) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }

      console.log(`Scraping complete: ${allListings.length} total listings`);

      return allListings;

    } catch (error: any) {
      console.error('Scraping failed:', error.message);
      throw error;
    }
  }

}
