import { extractCsrfToken, fetchSearchResults, fetchListingDetail } from '../utils/fetchData';
import { getRandomUserAgent } from '../utils/userAgents';
import { WillhabenListing } from '../types/willhabenTypes';

export interface ScraperStats {
  totalProcessed: number;
  newListings: number;
  failedDetails: number;
}

/**
 * Scrape Willhaben real estate listings
 */
export class ListingsScraper {
  private csrfToken: string | null = null;
  private userAgent: string;

  constructor() {
    this.userAgent = getRandomUserAgent();
  }

  /**
   * Initialize the scraper by extracting CSRF token
   */
  private async initialize(): Promise<void> {
    if (!this.csrfToken) {
      console.log('Initializing Willhaben scraper...');
      this.csrfToken = await extractCsrfToken();
      console.log('CSRF token obtained successfully');
    }
  }

  /**
   * Scrape all listings from Willhaben
   */
  async scrapeAll(): Promise<WillhabenListing[]> {
    console.log('Starting Willhaben scrape...');

    // Initialize and get CSRF token
    await this.initialize();

    if (!this.csrfToken) {
      throw new Error('Failed to obtain CSRF token');
    }

    const allListings: WillhabenListing[] = [];
    const stats: ScraperStats = {
      totalProcessed: 0,
      newListings: 0,
      failedDetails: 0
    };

    const rowsPerPage = 30; // Willhaben default

    // Process pages
    const processPage = async (listings: any[], pageNumber: number) => {
      console.log(`Processing page ${pageNumber}: ${listings.length} listings`);

      // Optionally enrich each listing with detail page data
      // For now, we'll use the summary data which contains most info
      const enrichedListings = await Promise.all(
        listings.map(async (listing) => {
          try {
            // Most data is already in the summary, but we can fetch details if needed
            // Uncomment to fetch detail page for each listing:
            // const detail = await fetchListingDetail(listing.id, this.csrfToken!, this.userAgent);
            // return { ...listing, ...detail };

            return listing;
          } catch (error) {
            console.warn(`Failed to enrich listing ${listing.id}:`, (error as Error).message);
            stats.failedDetails++;
            return listing;
          }
        })
      );

      allListings.push(...enrichedListings);
      stats.totalProcessed += listings.length;
      stats.newListings += listings.length;

      console.log(`Page ${pageNumber} complete: ${allListings.length} total listings`);
    };

    await fetchSearchResults(this.csrfToken, this.userAgent, rowsPerPage, processPage);

    console.log(`\nScraping complete!`);
    console.log(`  Total processed: ${stats.totalProcessed}`);
    console.log(`  New listings: ${stats.newListings}`);
    if (stats.failedDetails > 0) {
      console.log(`  Failed detail fetches: ${stats.failedDetails}`);
    }

    return allListings;
  }

  /**
   * Scrape a specific number of pages (useful for testing)
   */
  async scrapePages(maxPages: number): Promise<WillhabenListing[]> {
    console.log(`Starting Willhaben scrape (max ${maxPages} pages)...`);

    await this.initialize();

    if (!this.csrfToken) {
      throw new Error('Failed to obtain CSRF token');
    }

    const allListings: WillhabenListing[] = [];
    let currentPage = 0;

    const processPage = async (listings: any[], pageNumber: number) => {
      if (currentPage >= maxPages) {
        return; // Stop processing
      }

      console.log(`Processing page ${pageNumber}: ${listings.length} listings`);
      allListings.push(...listings);
      currentPage++;
    };

    await fetchSearchResults(this.csrfToken, this.userAgent, 30, processPage);

    console.log(`Scraping complete: ${allListings.length} listings from ${currentPage} pages`);

    return allListings;
  }
}
