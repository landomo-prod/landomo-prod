import { Browser, BrowserContext, Page } from 'playwright';
import * as LZString from 'lz-string';
import { ImmoweltListing, ScrapeResult, ScraperConfig } from '../types/immoweltTypes';
import {
  launchBrowser,
  createContext,
  randomDelay,
  scrollPage,
  handleCookieConsent
} from '../utils/browser';
import { getDesktopUserAgent } from '../utils/userAgents';

export class ListingsScraper {
  private config: ScraperConfig;
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;

  constructor() {
    this.config = {
      headless: process.env.HEADLESS !== 'false',
      timeout: parseInt(process.env.TIMEOUT || '60000'),
      maxRetries: parseInt(process.env.MAX_RETRIES || '3'),
      rateLimit: parseInt(process.env.RATE_LIMIT_DELAY || '2000'),
      userAgent: getDesktopUserAgent()
    };
  }

  /**
   * Initialize browser and context
   */
  private async initBrowser(): Promise<void> {
    if (!this.browser) {
      this.browser = await launchBrowser({
        headless: this.config.headless,
        timeout: this.config.timeout
      });
    }

    if (!this.context) {
      this.context = await createContext(this.browser, {
        userAgent: this.config.userAgent
      });
    }
  }

  /**
   * Close browser
   */
  async close(): Promise<void> {
    if (this.context) {
      await this.context.close();
      this.context = null;
    }

    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Extract and decode __UFRN_FETCHER__ data from page.
   * Immowelt (both .de and .at) stores search results in a compressed
   * LZ-String Base64 format under window.__UFRN_FETCHER__.data['classified-serp-init-data'].
   */
  private async extractUFRNData(page: Page): Promise<any> {
    try {
      if (page.isClosed()) {
        console.error('   Page is closed, cannot extract data');
        return null;
      }

      const ufrnData = await page.evaluate(() => {
        const fetcher = (window as any).__UFRN_FETCHER__;
        return fetcher?.data?.['classified-serp-init-data'];
      }).catch((err: any) => {
        console.error('   Page evaluation failed:', err.message);
        return null;
      });

      if (!ufrnData) {
        console.warn('   No __UFRN_FETCHER__ data found on page');
        return null;
      }

      // Decompress LZ-String Base64 encoded data
      const decompressed = LZString.decompressFromBase64(ufrnData);
      if (!decompressed) {
        console.error('   Failed to decompress __UFRN_FETCHER__ data');
        return null;
      }

      return JSON.parse(decompressed);
    } catch (error: any) {
      console.error('   Error extracting __UFRN_FETCHER__ data:', error.message);
      return null;
    }
  }

  /**
   * Parse a classified entry from UFRN data into ImmoweltListing format
   */
  private parseClassified(classified: any): ImmoweltListing | null {
    try {
      const id = classified.id;
      if (!id) return null;

      const title = classified.hardFacts?.title || 'Untitled';
      const url = classified.url
        ? `https://www.immowelt.at${classified.url}`
        : `https://www.immowelt.at/expose/${id}`;

      // Price
      const priceText = classified.hardFacts?.price?.formatted;
      const priceValue = priceText
        ? parseFloat(priceText.replace(/[^\d,]/g, '').replace(',', '.'))
        : undefined;

      // Location
      const location = {
        city: classified.location?.address?.city,
        district: classified.location?.address?.district,
        postalCode: classified.location?.address?.zipCode,
      };

      // Facts (area, rooms, floor)
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
            const floorMatch = fact.splitValue?.match(/\d+/);
            if (floorMatch) floor = parseInt(floorMatch[0]);
          }
        }
      }

      // Images
      const images: string[] = [];
      if (classified.gallery?.images) {
        for (const img of classified.gallery.images) {
          if (img.url) images.push(img.url);
        }
      }

      // Description
      const description = classified.mainDescription?.description;

      // Energy
      const energyRating = classified.energyClass?.value;

      return {
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
    } catch (error: any) {
      console.error('   Error parsing classified:', error.message);
      return null;
    }
  }

  /**
   * Extract listings from a search page using __UFRN_FETCHER__ data
   */
  private async extractListingsFromPage(page: Page): Promise<ImmoweltListing[]> {
    const listings: ImmoweltListing[] = [];

    try {
      if (page.isClosed()) {
        console.error('   Page is closed before extraction');
        return listings;
      }

      try {
        await page.waitForLoadState('networkidle', { timeout: this.config.timeout });
      } catch (timeoutError: any) {
        console.warn('   NetworkIdle timeout, continuing:', timeoutError.message);
      }

      await randomDelay(2000, 4000);

      // Primary: try __UFRN_FETCHER__
      const ufrnData = await this.extractUFRNData(page);

      if (ufrnData?.pageProps) {
        const { classifieds, classifiedsData } = ufrnData.pageProps;

        if (Array.isArray(classifieds) && classifiedsData) {
          console.log(`   Found ${classifieds.length} classified IDs via __UFRN_FETCHER__`);

          for (const classifiedId of classifieds) {
            const classifiedData = classifiedsData[classifiedId];
            if (!classifiedData) continue;

            const listing = this.parseClassified(classifiedData);
            if (listing) listings.push(listing);
          }

          console.log(`   Parsed ${listings.length} listings`);

          // Attach pagination info
          (listings as any)._paginationInfo = {
            totalCount: ufrnData.pageProps.totalCount,
            currentPage: ufrnData.pageProps.page,
            pageSize: ufrnData.pageProps.pageSize || classifieds.length || 20,
          };

          return listings;
        }
      }

      // Fallback: try __NEXT_DATA__ (legacy)
      console.log('   __UFRN_FETCHER__ not found, trying __NEXT_DATA__ fallback...');
      const nextData = await page.evaluate(() => {
        const scriptTag = document.getElementById('__NEXT_DATA__');
        if (scriptTag?.textContent) {
          try { return JSON.parse(scriptTag.textContent); } catch { return null; }
        }
        return null;
      });

      if (nextData?.props?.pageProps) {
        const pageProps = nextData.props.pageProps;
        const searchResults = pageProps.searchResults || pageProps.results || pageProps.listings;
        const items = searchResults?.items || searchResults?.results || pageProps.items || [];

        if (Array.isArray(items) && items.length > 0) {
          console.log(`   Found ${items.length} items via __NEXT_DATA__`);
          for (const item of items) {
            const id = item.id || item.exposeid || item.exposeId || '';
            if (!id) continue;

            listings.push({
              id,
              title: item.title || item.headline || 'Untitled',
              url: item.url || `https://www.immowelt.at/expose/${id}`,
              price: item.price?.value || item.price,
              location: {
                city: item.location?.city || item.city,
                district: item.location?.district,
              },
              area: item.area?.livingArea || item.livingArea || item.squareMeter,
              rooms: item.rooms || item.numberOfRooms,
            });
          }
          console.log(`   Parsed ${listings.length} listings from __NEXT_DATA__`);
        }
      }

    } catch (error: any) {
      console.error(`   Error extracting listings from page: ${error.message}`);
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

    await this.initBrowser();

    try {
      const page = await this.context!.newPage();

      console.log(`\nScraping category: ${category}`);
      console.log(`   URL: ${url}`);
      console.log(`   Method: __UFRN_FETCHER__ extraction`);

      await randomDelay(1000, 2000);

      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: this.config.timeout
      });

      await handleCookieConsent(page);
      await randomDelay(2000, 4000);

      // Check for blocking
      const isBlocked = await page.evaluate(() => {
        return document.body.textContent?.includes('DataDome') ||
               document.body.textContent?.includes('Access denied') ||
               document.querySelector('[id*="datadome"]') !== null;
      }).catch(() => false);

      if (isBlocked) {
        console.error('   DataDome protection detected!');
        await page.close();
        return allListings;
      }

      // Extract first page
      const firstPageListings = await this.extractListingsFromPage(page);
      console.log(`   Page 1: Found ${firstPageListings.length} listings`);
      allListings.push(...firstPageListings);

      // Calculate total pages
      const paginationInfo = (firstPageListings as any)._paginationInfo;
      let totalPages = maxPages;
      if (paginationInfo?.totalCount && paginationInfo?.pageSize) {
        totalPages = Math.min(
          Math.ceil(paginationInfo.totalCount / paginationInfo.pageSize),
          maxPages
        );
        console.log(`   ${totalPages} total pages (${paginationInfo.totalCount} listings / ${paginationInfo.pageSize} per page)`);
      }

      // Paginate
      let currentPage = 1;
      while (currentPage < totalPages) {
        if (page.isClosed()) break;

        await randomDelay(this.config.rateLimit, this.config.rateLimit + 2000);

        const nextPageNum = currentPage + 1;
        const separator = url.includes('?') ? '&' : '?';
        const nextPageUrl = `${url}${separator}sp=${nextPageNum}`;

        try {
          console.log(`   Navigating to page ${nextPageNum}/${totalPages}`);
          await page.goto(nextPageUrl, {
            waitUntil: 'networkidle',
            timeout: this.config.timeout
          });

          currentPage++;
          await randomDelay(2000, 4000);

          const pageListings = await this.extractListingsFromPage(page);
          console.log(`   Page ${currentPage}: Found ${pageListings.length} listings`);

          if (pageListings.length === 0) {
            console.log(`   No listings on page ${currentPage}, stopping`);
            break;
          }

          allListings.push(...pageListings);
        } catch (error: any) {
          console.log(`   Failed to navigate to page ${currentPage + 1}: ${error.message}`);
          break;
        }
      }

      await page.close();

    } catch (error: any) {
      console.error(`Error scraping category ${category}:`, error.message);
    }

    return allListings;
  }

  /**
   * Build paginated URL
   */
  private buildPaginatedUrl(baseUrl: string, page: number): string {
    const url = new URL(baseUrl);
    url.searchParams.set('page', page.toString());
    return url.toString();
  }

  /**
   * Scrape all listings (sales and rentals)
   */
  async scrapeAll(): Promise<ImmoweltListing[]> {
    const allListings: ImmoweltListing[] = [];

    try {
      const maxPages = parseInt(process.env.MAX_PAGES_PER_CATEGORY || '999999');

      // immowelt.at uses /liste/oesterreich/ URL pattern
      const categories = [
        {
          name: 'Apartments for Sale',
          url: 'https://www.immowelt.at/liste/oesterreich/wohnungen/kaufen',
          type: 'sale',
          propertyType: 'apartment'
        },
        {
          name: 'Apartments for Rent',
          url: 'https://www.immowelt.at/liste/oesterreich/wohnungen/mieten',
          type: 'rent',
          propertyType: 'apartment'
        },
        {
          name: 'Houses for Sale',
          url: 'https://www.immowelt.at/liste/oesterreich/haeuser/kaufen',
          type: 'sale',
          propertyType: 'house'
        },
        {
          name: 'Houses for Rent',
          url: 'https://www.immowelt.at/liste/oesterreich/haeuser/mieten',
          type: 'rent',
          propertyType: 'house'
        },
        {
          name: 'Land/Plots for Sale',
          url: 'https://www.immowelt.at/liste/oesterreich/grundstuecke/kaufen',
          type: 'sale',
          propertyType: 'land'
        },
        {
          name: 'Commercial for Sale',
          url: 'https://www.immowelt.at/liste/oesterreich/gewerbe/kaufen',
          type: 'sale',
          propertyType: 'commercial'
        },
        {
          name: 'Commercial for Rent',
          url: 'https://www.immowelt.at/liste/oesterreich/gewerbe/mieten',
          type: 'rent',
          propertyType: 'commercial'
        },
        {
          name: 'Offices for Rent',
          url: 'https://www.immowelt.at/liste/oesterreich/bueros/mieten',
          type: 'rent',
          propertyType: 'office'
        },
        {
          name: 'Parking/Garages for Sale',
          url: 'https://www.immowelt.at/liste/oesterreich/garagen/kaufen',
          type: 'sale',
          propertyType: 'parking'
        },
        {
          name: 'Parking/Garages for Rent',
          url: 'https://www.immowelt.at/liste/oesterreich/garagen/mieten',
          type: 'rent',
          propertyType: 'parking'
        }
      ];

      console.log(`\nScraping Immowelt.at`);
      console.log(`   Method: __UFRN_FETCHER__ extraction`);
      console.log(`   Max pages per category: ${maxPages === 999999 ? 'unlimited' : maxPages}`);
      console.log(`   Categories: ${categories.length}`);

      for (const category of categories) {
        const categoryListings = await this.scrapeCategory(category.url, category.name, maxPages);

        categoryListings.forEach(listing => {
          listing.transactionType = category.type;
          listing.propertyType = listing.propertyType || category.propertyType;
        });

        allListings.push(...categoryListings);

        console.log(`Category complete: ${category.name} - ${categoryListings.length} listings\n`);

        await randomDelay(3000, 6000);
      }

      console.log(`\nTotal listings scraped: ${allListings.length}`);

    } catch (error: any) {
      console.error('Error in scrapeAll:', error.message);
      throw error;
    } finally {
      await this.close();
    }

    return allListings;
  }

  /**
   * Scrape detailed information from a single listing page
   */
  async scrapeListingDetails(url: string): Promise<Partial<ImmoweltListing> | null> {
    await this.initBrowser();
    const page = await this.context!.newPage();

    try {
      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: this.config.timeout
      });

      await handleCookieConsent(page);
      await randomDelay(1000, 2000);

      // Try __UFRN_FETCHER__ first
      const ufrnData = await this.extractUFRNData(page);
      if (ufrnData?.pageProps?.classifiedsData) {
        const firstId = Object.keys(ufrnData.pageProps.classifiedsData)[0];
        if (firstId) {
          const listing = this.parseClassified(ufrnData.pageProps.classifiedsData[firstId]);
          await page.close();
          return listing;
        }
      }

      // Fallback to __NEXT_DATA__
      const nextData = await page.evaluate(() => {
        const scriptTag = document.getElementById('__NEXT_DATA__');
        if (scriptTag?.textContent) {
          try { return JSON.parse(scriptTag.textContent); } catch { return null; }
        }
        return null;
      });

      if (nextData?.props?.pageProps) {
        const expose = nextData.props.pageProps.expose ||
                       nextData.props.pageProps.property ||
                       nextData.props.pageProps;

        await page.close();
        return {
          title: expose.title || expose.headline,
          url,
          price: expose.price?.value,
        };
      }

      await page.close();
      return null;

    } catch (error: any) {
      console.error(`Error scraping listing details from ${url}:`, error.message);
      if (!page.isClosed()) await page.close();
      return null;
    }
  }
}
