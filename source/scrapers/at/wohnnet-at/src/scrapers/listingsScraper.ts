import { fetchListingPage, fetchDetailPage, rateLimitWithHumanBehavior } from '../utils/fetchData';
import { parseListingsPage, extractPaginationMeta, parseDetailPage } from '../utils/htmlParser';
import { WohnnetListing, ScraperStats } from '../types/wohnnetTypes';

export interface ScraperOptions {
  maxPages?: number;
  requestsPerSecond?: number;
  enableDetailScraping?: boolean;
  startPage?: number;
}

/**
 * Scrape Wohnnet.at listings
 */
export class ListingsScraper {
  private options: ScraperOptions;

  constructor(options: ScraperOptions = {}) {
    this.options = {
      maxPages: parseInt(process.env.MAX_PAGES || '1500'),
      requestsPerSecond: parseFloat(process.env.REQUESTS_PER_SECOND || '2'),
      enableDetailScraping: process.env.ENABLE_DETAIL_SCRAPING === 'true',
      startPage: 1,
      ...options
    };
  }

  /**
   * Scrape all listings with pagination
   */
  async scrapeAll(): Promise<WohnnetListing[]> {
    console.log('Starting Wohnnet.at scrape...');
    console.log(`Options:`, {
      maxPages: this.options.maxPages,
      requestsPerSecond: this.options.requestsPerSecond,
      enableDetailScraping: this.options.enableDetailScraping
    });

    const stats: ScraperStats = {
      totalPages: 0,
      totalListings: 0,
      successfulListings: 0,
      failedListings: 0,
      detailsEnriched: 0,
      startTime: Date.now()
    };

    const allListings: WohnnetListing[] = [];
    let currentPage = this.options.startPage || 1;
    let hasMorePages = true;

    while (hasMorePages && currentPage <= (this.options.maxPages || 1500)) {
      try {
        console.log(`\n📄 Scraping page ${currentPage}...`);

        // Fetch page HTML (headers are rotated automatically)
        const html = await fetchListingPage(currentPage);

        // Parse listings
        const listings = parseListingsPage(html, currentPage);
        console.log(`   Found ${listings.length} listings on page ${currentPage}`);

        stats.totalPages++;
        stats.totalListings += listings.length;

        if (listings.length === 0) {
          console.log('   No listings found, assuming end of results');
          hasMorePages = false;
          break;
        }

        // Optionally enrich with detail pages
        if (this.options.enableDetailScraping) {
          for (let i = 0; i < listings.length; i++) {
            try {
              await rateLimitWithHumanBehavior();

              const listing = listings[i];
              console.log(`   Fetching details ${i + 1}/${listings.length}: ${listing.id}`);

              const detailHtml = await fetchDetailPage(listing.url);
              const detailData = parseDetailPage(detailHtml, listing.url);

              // Merge detail data
              listings[i] = {
                ...listing,
                description: detailData.description || listing.description,
                details: {
                  ...listing.details,
                  ...detailData.details
                },
                images: detailData.images?.map(img => img.url) || listing.images,
                jsonLd: detailData.jsonLd || listing.jsonLd
              };

              stats.detailsEnriched++;
            } catch (error) {
              console.warn(`   Failed to fetch details for ${listings[i].id}:`, (error as Error).message);
              stats.failedListings++;
              // Continue with next listing
            }
          }
        }

        allListings.push(...listings);
        stats.successfulListings += listings.length;

        // Extract pagination metadata
        const paginationMeta = extractPaginationMeta(html, currentPage);
        console.log(`   Pagination: page ${currentPage}/${paginationMeta.totalPages}, hasNext: ${paginationMeta.hasNextPage}`);

        // Check if there are more pages
        if (!paginationMeta.hasNextPage || currentPage >= paginationMeta.totalPages) {
          console.log('   Reached last page');
          hasMorePages = false;
          break;
        }

        // Rate limit between pages with human-like behavior
        await rateLimitWithHumanBehavior();
        currentPage++;

      } catch (error) {
        console.error(`❌ Error scraping page ${currentPage}:`, (error as Error).message);
        stats.failedListings++;

        // Continue to next page on error (don't stop entire scrape)
        if (currentPage < (this.options.maxPages || 1500)) {
          currentPage++;
          await rateLimitWithHumanBehavior();
        } else {
          hasMorePages = false;
        }
      }
    }

    stats.endTime = Date.now();
    stats.duration = stats.endTime - stats.startTime;

    console.log('\n✅ Scraping completed!');
    console.log('Statistics:');
    console.log(`   Total pages: ${stats.totalPages}`);
    console.log(`   Total listings: ${stats.totalListings}`);
    console.log(`   Successful: ${stats.successfulListings}`);
    console.log(`   Failed: ${stats.failedListings}`);
    console.log(`   Details enriched: ${stats.detailsEnriched}`);
    console.log(`   Duration: ${(stats.duration / 1000).toFixed(2)}s`);

    return allListings;
  }

  /**
   * Scrape a single page
   */
  async scrapePage(pageNumber: number): Promise<WohnnetListing[]> {
    console.log(`Scraping single page: ${pageNumber}`);

    // Fetch page HTML (headers are rotated automatically)
    const html = await fetchListingPage(pageNumber);
    const listings = parseListingsPage(html, pageNumber);

    console.log(`Found ${listings.length} listings on page ${pageNumber}`);

    // Optionally enrich with detail pages
    if (this.options.enableDetailScraping) {
      for (let i = 0; i < listings.length; i++) {
        try {
          await rateLimitWithHumanBehavior();

          const listing = listings[i];
          const detailHtml = await fetchDetailPage(listing.url);
          const detailData = parseDetailPage(detailHtml, listing.url);

          // Merge detail data
          listings[i] = {
            ...listing,
            description: detailData.description || listing.description,
            details: {
              ...listing.details,
              ...detailData.details
            },
            images: detailData.images?.map(img => img.url) || listing.images,
            jsonLd: detailData.jsonLd || listing.jsonLd
          };
        } catch (error) {
          console.warn(`Failed to fetch details for ${listings[i].id}:`, (error as Error).message);
        }
      }
    }

    return listings;
  }
}
