import { Browser, Page } from 'playwright';
import * as LZString from 'lz-string';
import { ImmoweltListing, ScraperConfig } from '../types/immoweltTypes';
import { launchStealthBrowser, createStealthContext, randomDelay, naturalScroll } from '../utils/browser';

/**
 * Immowelt scraper using __UFRN_FETCHER__ data extraction
 *
 * This is much faster than the URL extraction method because:
 * 1. Extracts all listings from search page in one request (no need to visit each detail page)
 * 2. Data is already structured and complete
 * 3. No rate limiting needed between listings (just between search pages)
 */
export class ListingsScraperUFRN {
  private config: ScraperConfig;
  private browser: Browser | null = null;

  constructor() {
    this.config = {
      headless: process.env.HEADLESS !== 'false',
      timeout: parseInt(process.env.TIMEOUT || '60000'),
      maxRetries: parseInt(process.env.MAX_RETRIES || '3'),
      rateLimit: parseInt(process.env.RATE_LIMIT_DELAY || '2000'),
      stealthMode: process.env.STEALTH_MODE !== 'false',
      randomDelays: process.env.RANDOM_DELAYS !== 'false',
      minDelay: parseInt(process.env.MIN_DELAY || '1000'),
      maxDelay: parseInt(process.env.MAX_DELAY || '3000'),
    };
  }

  /**
   * Initialize stealth browser
   */
  private async initBrowser(): Promise<void> {
    if (!this.browser) {
      this.browser = await launchStealthBrowser({
        headless: this.config.headless,
      });
    }
  }

  /**
   * Close browser
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Extract and decode __UFRN_FETCHER__ data from page
   */
  private async extractUFRNData(page: Page): Promise<any> {
    try {
      // Check if page is still attached
      if (page.isClosed()) {
        console.error('   ❌ Page is closed, cannot extract data');
        return null;
      }

      const ufrnData = await page.evaluate(() => {
        const fetcher = (window as any).__UFRN_FETCHER__;
        return fetcher?.data?.['classified-serp-init-data'];
      }).catch((err: any) => {
        // Catch evaluation errors (page closed, context destroyed, etc.)
        console.error('   ❌ Page evaluation failed:', err.message);
        return null;
      });

      if (!ufrnData) {
        console.warn('   ⚠️  No __UFRN_FETCHER__ data found on page');
        return null;
      }

      // Decompress LZ-String Base64 encoded data
      const decompressed = LZString.decompressFromBase64(ufrnData);
      if (!decompressed) {
        console.error('   ❌ Failed to decompress __UFRN_FETCHER__ data');
        return null;
      }

      const parsed = JSON.parse(decompressed);
      return parsed;

    } catch (error: any) {
      console.error('   ❌ Error extracting __UFRN_FETCHER__ data:', error.message);
      return null;
    }
  }

  /**
   * Parse classified data into ImmoweltListing format
   */
  private parseClassified(classified: any): ImmoweltListing | null {
    try {
      const id = classified.id;
      if (!id) {
        console.warn('   ⚠️  Classified has no ID, skipping');
        return null;
      }

      // Extract basic info
      const title = classified.hardFacts?.title || 'Untitled';
      const url = classified.url
        ? `https://www.immowelt.de${classified.url}`
        : `https://www.immowelt.de/expose/${id}`;

      // Extract price
      const priceText = classified.hardFacts?.price?.formatted;
      const priceValue = priceText
        ? parseFloat(priceText.replace(/[^\d,]/g, '').replace(',', '.'))
        : undefined;

      // Extract location
      const location = {
        city: classified.location?.address?.city,
        district: classified.location?.address?.district,
        zipCode: classified.location?.address?.zipCode,
        state: classified.location?.address?.state,
        country: classified.location?.address?.country,
      };

      // Extract facts
      let area: number | undefined;
      let rooms: number | undefined;
      let floor: number | undefined;

      if (classified.hardFacts?.facts) {
        for (const fact of classified.hardFacts.facts) {
          if (fact.type === 'livingSpace') {
            area = parseFloat(fact.splitValue?.replace(',', '.') || '0');
          } else if (fact.type === 'numberOfRooms') {
            rooms = parseFloat(fact.splitValue?.replace(',', '.') || '0');
          } else if (fact.type === 'numberOfFloors') {
            // Extract floor number (e.g., "1. Geschoss" -> 1)
            const floorMatch = fact.splitValue?.match(/\d+/);
            if (floorMatch) {
              floor = parseInt(floorMatch[0]);
            }
          }
        }
      }

      // Extract images
      const images: string[] = [];
      if (classified.gallery?.images) {
        for (const img of classified.gallery.images) {
          if (img.url) {
            images.push(img.url);
          }
        }
      }

      // Extract description
      const description = classified.mainDescription?.description;

      // Extract energy rating
      const energyRating = classified.energyClass?.value;

      // Build listing
      const listing: ImmoweltListing = {
        id,
        title,
        url,
        price: priceValue,
        priceText,
        location,
        area,
        rooms,
        floor,
        images: images.length > 0 ? images : undefined,
        description,
        energyRating,
      };

      return listing;

    } catch (error: any) {
      console.error('   ❌ Error parsing classified:', error.message);
      return null;
    }
  }

  /**
   * Extract listings from search results page using __UFRN_FETCHER__
   */
  private async extractListingsFromPage(page: Page): Promise<ImmoweltListing[]> {
    const listings: ImmoweltListing[] = [];

    try {
      // Check if page is still attached
      if (page.isClosed()) {
        console.error('   ❌ Page is closed before extraction');
        return listings;
      }

      // Wait for content to load with proper error handling
      try {
        await page.waitForLoadState('networkidle', { timeout: this.config.timeout });
      } catch (timeoutError: any) {
        console.warn('   ⚠️  NetworkIdle timeout, continuing anyway:', timeoutError.message);
        // Continue - page might still have data even if not fully idle
      }

      await randomDelay(2000, 4000); // Wait for JS to execute

      // Extract __UFRN_FETCHER__ data
      const ufrnData = await this.extractUFRNData(page);

      if (!ufrnData || !ufrnData.pageProps) {
        console.warn('   ⚠️  No pageProps found in __UFRN_FETCHER__ data');
        return listings;
      }

      const { classifieds, classifiedsData } = ufrnData.pageProps;

      if (!Array.isArray(classifieds) || !classifiedsData) {
        console.warn('   ⚠️  Invalid classifieds structure');
        return listings;
      }

      console.log(`   ✓ Found ${classifieds.length} classified IDs`);

      // Extract each classified
      for (const classifiedId of classifieds) {
        const classifiedData = classifiedsData[classifiedId];

        if (!classifiedData) {
          console.warn(`   ⚠️  No data for classified ID: ${classifiedId}`);
          continue;
        }

        const listing = this.parseClassified(classifiedData);
        if (listing) {
          listings.push(listing);
        }
      }

      console.log(`   ✓ Successfully parsed ${listings.length} listings`);

      // Also check for total count and pagination
      const totalCount = ufrnData.pageProps.totalCount;
      const currentPage = ufrnData.pageProps.page;
      const pageSize = ufrnData.pageProps.pageSize || classifieds.length || 20;

      if (totalCount) {
        console.log(`   ℹ️  Total listings available: ${totalCount}`);
      }
      if (currentPage) {
        console.log(`   ℹ️  Current page: ${currentPage}`);
      }

      // Return pagination info alongside listings
      (listings as any)._paginationInfo = { totalCount, currentPage, pageSize };

    } catch (error: any) {
      // Don't throw - return empty array so scraper can continue
      console.error(`   ❌ Error extracting listings from page: ${error.message}`);
      if (error.message.includes('closed') || error.message.includes('detached')) {
        console.error('   ❌ Browser context crashed - this should be investigated');
      }
    }

    return listings;
  }

  /**
   * Scrape a specific category
   */
  private async scrapeCategory(
    url: string,
    category: string,
    maxPages: number = 10000
  ): Promise<ImmoweltListing[]> {
    const allListings: ImmoweltListing[] = [];
    let context = null;
    let page = null;

    try {
      await this.initBrowser();
      context = await createStealthContext(this.browser!);
      page = await context.newPage();

      console.log(`\n📄 Scraping category: ${category}`);
      console.log(`   URL: ${url}`);
      console.log(`   Method: __UFRN_FETCHER__ extraction (fast)`);

      // Navigate to first page
      if (this.config.randomDelays) {
        await randomDelay(this.config.minDelay, this.config.maxDelay);
      }

      try {
        await page.goto(url, {
          waitUntil: 'networkidle',
          timeout: this.config.timeout
        });
      } catch (navError: any) {
        console.error(`   ❌ Navigation failed: ${navError.message}`);
        throw navError;
      }

      // Wait for DataDome check
      await randomDelay(2000, 4000);

      // Check for DataDome challenge with error handling
      let isBlocked = false;
      try {
        isBlocked = await page.evaluate(() => {
          return document.body.textContent?.includes('DataDome') ||
                 document.body.textContent?.includes('Access denied') ||
                 document.querySelector('[id*="datadome"]') !== null;
        }).catch(() => false);
      } catch (evalError) {
        console.warn('   ⚠️  Could not check for DataDome, continuing...');
      }

      if (isBlocked) {
        console.error('   ❌ DataDome protection detected!');
        console.error('   💡 Try: Longer delays, residential proxies, or ScrapFly service');
        return allListings;
      }

      // Extract listings from first page
      const firstPageListings = await this.extractListingsFromPage(page);
      console.log(`   ✓ Page 1: Found ${firstPageListings.length} listings`);
      allListings.push(...firstPageListings);

      // Calculate total pages from UFRN pagination info
      const paginationInfo = (firstPageListings as any)._paginationInfo;
      let totalPages = maxPages;
      if (paginationInfo?.totalCount && paginationInfo?.pageSize) {
        totalPages = Math.min(
          Math.ceil(paginationInfo.totalCount / paginationInfo.pageSize),
          maxPages
        );
        console.log(`   ℹ️  Calculated ${totalPages} total pages (${paginationInfo.totalCount} listings / ${paginationInfo.pageSize} per page)`);
      }

      // Try to paginate using immowelt's `sp` parameter
      let currentPage = 1;
      while (currentPage < totalPages) {
        // Check if page is still valid before continuing
        if (page.isClosed()) {
          console.error('   ❌ Page closed unexpectedly, stopping pagination');
          break;
        }

        // Rate limiting between pages
        if (this.config.randomDelays) {
          await randomDelay(this.config.minDelay * 2, this.config.maxDelay * 2); // Longer delay for page changes
        } else {
          await page.waitForTimeout(this.config.rateLimit * 2);
        }

        // Immowelt uses `sp` parameter for pagination
        const nextPageNum = currentPage + 1;
        const separator = url.includes('?') ? '&' : '?';
        const nextPageUrl = `${url}${separator}sp=${nextPageNum}`;

        try {
          console.log(`   🌐 Navigating to page ${nextPageNum}/${totalPages}: ${nextPageUrl}`);
          await page.goto(nextPageUrl, {
            waitUntil: 'networkidle',
            timeout: this.config.timeout
          });

          currentPage++;

          // Wait for new data
          if (this.config.randomDelays) {
            await randomDelay(2000, 4000);
          }

          const pageListings = await this.extractListingsFromPage(page);
          console.log(`   ✓ Page ${currentPage}: Found ${pageListings.length} listings`);

          if (pageListings.length === 0) {
            console.log(`   ℹ️  No listings on page ${currentPage}, stopping`);
            break;
          }

          allListings.push(...pageListings);
        } catch (error: any) {
          console.log(`   ⚠️  Failed to navigate to page ${currentPage + 1}: ${error.message}`);
          break;
        }
      }

    } catch (error: any) {
      console.error(`   ❌ Error scraping category ${category}:`, error.message);
      if (error.stack) {
        console.error('   Stack trace:', error.stack.split('\n').slice(0, 3).join('\n'));
      }
    } finally {
      // Proper cleanup order: page -> context
      if (page && !page.isClosed()) {
        try {
          await page.close();
          console.log('   ✓ Page closed');
        } catch (closeError) {
          console.warn('   ⚠️  Error closing page:', closeError);
        }
      }

      if (context) {
        try {
          await context.close();
          console.log('   ✓ Context closed');
        } catch (closeError) {
          console.warn('   ⚠️  Error closing context:', closeError);
        }
      }
    }

    return allListings;
  }

  /**
   * Scrape all listings (sales and rentals)
   */
  async scrapeAll(): Promise<ImmoweltListing[]> {
    const allListings: ImmoweltListing[] = [];

    try {
      const maxPages = parseInt(process.env.MAX_PAGES_PER_CATEGORY || '10000');

      // Define categories (same as before)
      const categories = [
        { name: 'Apartments for Sale', url: 'https://www.immowelt.de/suche/wohnungen/kaufen', type: 'sale', propertyType: 'apartment' },
        { name: 'Apartments for Rent', url: 'https://www.immowelt.de/suche/wohnungen/mieten', type: 'rent', propertyType: 'apartment' },
        { name: 'Houses for Sale', url: 'https://www.immowelt.de/suche/haeuser/kaufen', type: 'sale', propertyType: 'house' },
        { name: 'Houses for Rent', url: 'https://www.immowelt.de/suche/haeuser/mieten', type: 'rent', propertyType: 'house' },
        { name: 'Land/Plots for Sale', url: 'https://www.immowelt.de/suche/grundstuecke/kaufen', type: 'sale', propertyType: 'land' },
        { name: 'Commercial Properties for Sale', url: 'https://www.immowelt.de/suche/gewerbe/kaufen', type: 'sale', propertyType: 'commercial' },
        { name: 'Commercial Properties for Rent', url: 'https://www.immowelt.de/suche/gewerbe/mieten', type: 'rent', propertyType: 'commercial' },
        { name: 'Offices for Sale', url: 'https://www.immowelt.de/suche/bueros/kaufen', type: 'sale', propertyType: 'office' },
        { name: 'Offices for Rent', url: 'https://www.immowelt.de/suche/bueros/mieten', type: 'rent', propertyType: 'office' },
        { name: 'Warehouses for Sale', url: 'https://www.immowelt.de/suche/hallen/kaufen', type: 'sale', propertyType: 'warehouse' },
        { name: 'Warehouses for Rent', url: 'https://www.immowelt.de/suche/hallen/mieten', type: 'rent', propertyType: 'warehouse' },
        { name: 'Hospitality Properties for Sale', url: 'https://www.immowelt.de/suche/gastgewerbe/kaufen', type: 'sale', propertyType: 'hospitality' },
        { name: 'Hospitality Properties for Rent', url: 'https://www.immowelt.de/suche/gastgewerbe/mieten', type: 'rent', propertyType: 'hospitality' },
        { name: 'Parking/Garages for Sale', url: 'https://www.immowelt.de/suche/garagen/kaufen', type: 'sale', propertyType: 'parking' },
        { name: 'Parking/Garages for Rent', url: 'https://www.immowelt.de/suche/garagen/mieten', type: 'rent', propertyType: 'parking' },
      ];

      console.log(`\n🌐 Scraping Immowelt.de`);
      console.log(`   Method: __UFRN_FETCHER__ extraction (FAST)`);
      console.log(`   Max pages per category: ${maxPages}`);
      console.log(`   Categories: ${categories.length}\n`);

      for (const category of categories) {
        const categoryListings = await this.scrapeCategory(category.url, category.name, maxPages);

        // Add transaction type and property type
        categoryListings.forEach(listing => {
          listing.transactionType = category.type;
          listing.propertyType = category.propertyType;
        });

        allListings.push(...categoryListings);

        console.log(`✅ Category complete: ${category.name} - ${categoryListings.length} listings\n`);

        // Cooldown between categories
        if (this.config.randomDelays) {
          console.log(`   ⏳ Cooling down before next category...`);
          await randomDelay(5000, 10000);
        }
      }

      console.log(`\n📊 Total listings scraped: ${allListings.length}`);

    } catch (error: any) {
      console.error('❌ Error in scrapeAll:', error.message);
      throw error;
    } finally {
      await this.close();
    }

    return allListings;
  }
}
