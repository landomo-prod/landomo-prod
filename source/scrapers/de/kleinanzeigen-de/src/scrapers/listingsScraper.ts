import { fetchListings, fetchListingDetail } from '../utils/fetchData';
import { getMobileUserAgent } from '../utils/userAgents';
import { KleinanzeigenListing, REAL_ESTATE_CATEGORIES } from '../types/kleinanzeigenTypes';

export interface ScraperStats {
  totalProcessed: number;
  newListings: number;
  categories: Record<string, number>;
}

/**
 * Scrape Kleinanzeigen listings from real estate categories
 */
export class ListingsScraper {
  private categories: number[];
  private locationId?: number;
  private enrichWithDetails: boolean;

  constructor(
    categories: number[] = [
      // RESIDENTIAL
      REAL_ESTATE_CATEGORIES.APARTMENTS_RENT,
      REAL_ESTATE_CATEGORIES.APARTMENTS_SALE,
      REAL_ESTATE_CATEGORIES.HOUSES_RENT,
      REAL_ESTATE_CATEGORIES.HOUSES_SALE,
      // LAND & COMMERCIAL
      REAL_ESTATE_CATEGORIES.LAND_GARDENS,
      REAL_ESTATE_CATEGORIES.COMMERCIAL,
      REAL_ESTATE_CATEGORIES.PARKING,
      // TEMPORARY & VACATION
      REAL_ESTATE_CATEGORIES.TEMPORARY_SHARED,
      REAL_ESTATE_CATEGORIES.VACATION_FOREIGN,
      // MISCELLANEOUS
      REAL_ESTATE_CATEGORIES.CONTAINERS,
      REAL_ESTATE_CATEGORIES.NEW_CONSTRUCTION,
      REAL_ESTATE_CATEGORIES.MISCELLANEOUS
    ],
    locationId?: number,
    enrichWithDetails: boolean = false
  ) {
    this.categories = categories;
    this.locationId = locationId;
    this.enrichWithDetails = enrichWithDetails;
  }

  /**
   * Scrape all listings from configured categories
   */
  async scrapeAll(): Promise<KleinanzeigenListing[]> {
    console.log(`Starting Kleinanzeigen scrape for ${this.categories.length} categories...`);
    if (this.locationId) {
      console.log(`Filtering by location ID: ${this.locationId}`);
    }

    const allListings: KleinanzeigenListing[] = [];
    const stats: ScraperStats = {
      totalProcessed: 0,
      newListings: 0,
      categories: {}
    };

    // Process categories sequentially to avoid overwhelming the API
    for (const category of this.categories) {
      try {
        const listings = await this.scrapeCategory(category);

        allListings.push(...listings);
        stats.totalProcessed += listings.length;
        stats.categories[category.toString()] = listings.length;

        console.log(`Category ${category}: ${listings.length} listings`);

        // Delay between categories
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error: any) {
        console.error(`Failed to scrape category ${category}:`, error.message);
        // Continue with next category
      }
    }

    console.log(`✅ Scraping complete: ${stats.totalProcessed} total listings`);

    return allListings;
  }

  /**
   * Scrape a single category
   */
  private async scrapeCategory(categoryId: number): Promise<KleinanzeigenListing[]> {
    const listings: KleinanzeigenListing[] = [];
    const userAgent = getMobileUserAgent();

    const processPage = async (pageListings: any[], pageNumber: number) => {
      // Optionally enrich with detail data
      if (this.enrichWithDetails) {
        const enrichedListings = await Promise.all(
          pageListings.map(async (listing) => {
            try {
              const detail = await fetchListingDetail(listing.id, userAgent);
              // Merge detail data with listing data
              return {
                ...listing,
                ...detail,
                // Preserve arrays
                images: detail.images || listing.images || [],
                pictures: detail.pictures || listing.pictures || [],
                attributes: detail.attributes || listing.attributes || []
              };
            } catch (error) {
              // If detail fetch fails, return original listing
              console.warn(`Failed to fetch detail for listing ${listing.id}:`, (error as Error).message);
              return listing;
            }
          })
        );

        listings.push(...enrichedListings);
      } else {
        listings.push(...pageListings);
      }

      // Log progress
      if (pageNumber % 5 === 0) {
        console.log(`Category ${categoryId}: page ${pageNumber + 1}, ${listings.length} listings processed`);
      }
    };

    await fetchListings(
      categoryId,
      userAgent,
      this.locationId,
      undefined,
      processPage
    );

    return listings;
  }

  /**
   * Scrape listings by search query
   */
  async scrapeByQuery(query: string): Promise<KleinanzeigenListing[]> {
    console.log(`Searching Kleinanzeigen for: "${query}"`);

    const userAgent = getMobileUserAgent();
    const listings: KleinanzeigenListing[] = [];

    const processPage = async (pageListings: any[]) => {
      listings.push(...pageListings);
    };

    await fetchListings(
      0, // No specific category
      userAgent,
      this.locationId,
      query,
      processPage
    );

    console.log(`✅ Found ${listings.length} listings for query: "${query}"`);
    return listings;
  }
}
