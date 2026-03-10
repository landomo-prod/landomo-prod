import { Browser, Page } from 'playwright';
import { ImmoweltListing, NextDataStructure, NextDataProperty, ScraperConfig } from '../types/immoweltTypes';
import { launchStealthBrowser, createStealthContext, randomDelay, naturalScroll } from '../utils/browser';

export class ListingsScraper {
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
   * Extract __NEXT_DATA__ from page
   */
  private async extractNextData(page: Page): Promise<NextDataStructure | null> {
    try {
      const nextData = await page.evaluate(() => {
        const scriptTag = document.querySelector('#__NEXT_DATA__');
        if (!scriptTag || !scriptTag.textContent) return null;

        try {
          return JSON.parse(scriptTag.textContent);
        } catch (e) {
          console.error('Failed to parse __NEXT_DATA__:', e);
          return null;
        }
      });

      return nextData;
    } catch (error: any) {
      console.error('Error extracting __NEXT_DATA__:', error.message);
      return null;
    }
  }

  /**
   * Extract classified-serp-init-data from script tags
   */
  private async extractSerpData(page: Page): Promise<any[] | null> {
    try {
      const serpData = await page.evaluate(() => {
        const scripts = Array.from(document.querySelectorAll('script:not([src])'));

        for (const script of scripts) {
          const content = script.textContent || '';

          // Look for classified-serp-init-data or similar patterns
          if (content.includes('classified-serp-init-data') ||
              content.includes('window.__INITIAL_STATE__') ||
              content.includes('window.__DATA__')) {

            // Try to extract JSON data
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              try {
                const data = JSON.parse(jsonMatch[0]);
                return data;
              } catch (e) {
                continue;
              }
            }
          }
        }

        return null;
      });

      return serpData;
    } catch (error: any) {
      console.error('Error extracting SERP data:', error.message);
      return null;
    }
  }

  /**
   * Parse property from NextData structure
   */
  private parseNextDataProperty(data: NextDataProperty): ImmoweltListing | null {
    try {
      // Extract ID
      const id = data.id || data.estateid || data.EstateId || data.globalObjectKey || data.onlineId || '';

      if (!id) {
        console.warn('Property has no ID, skipping');
        return null;
      }

      // Extract location
      const location = {
        city: data.generalData?.city ||
              data.location?.address?.city ||
              data.geoHierarchy?.city?.name,
        district: data.generalData?.district ||
                  data.location?.address?.quarter ||
                  data.geoHierarchy?.quarter?.name,
        address: data.generalData?.street ||
                 (data.location?.address?.street ?
                   `${data.location.address.street} ${data.location.address.houseNumber || ''}`.trim() :
                   undefined),
        zipCode: data.generalData?.zip || data.location?.address?.postcode,
        state: data.generalData?.state || data.geoHierarchy?.region?.name,
      };

      // Extract price
      const price = data.price?.value;
      const priceText = price ? `${price} ${data.price?.currency || 'EUR'}` : undefined;

      // Extract areas
      const area = data.areas?.livingArea || data.equipmentAreas?.livingArea?.value;
      const plotArea = data.areas?.plotArea || data.equipmentAreas?.plotArea?.value;
      const rooms = data.equipmentAreas?.numberOfRooms?.value;

      // Extract images
      const images: string[] = [];

      if (data.images) {
        data.images.forEach(img => {
          const url = img.urls?.large || img.urls?.original || img.urls?.medium || img.url;
          if (url) images.push(url);
        });
      }

      if (data.galleries) {
        data.galleries.forEach(gallery => {
          gallery.items?.forEach(item => {
            const url = item.large || item.thumbnail;
            if (url && !images.includes(url)) images.push(url);
          });
        });
      }

      // Extract coordinates
      const coordinates = data.EstateMapData?.LocationCoordinates ? {
        lat: data.EstateMapData.LocationCoordinates.Latitude || 0,
        lng: data.EstateMapData.LocationCoordinates.Longitude || 0,
      } : undefined;

      // Extract main key facts
      const features: string[] = [];
      if (data.mainKeyFacts) {
        data.mainKeyFacts.forEach(fact => {
          if (fact.label) features.push(fact.label);
        });
      }

      // Extract metadata
      const metadata = {
        published: data.distributionData?.publicationDate,
        updated: data.distributionData?.modificationDate,
      };

      return {
        id,
        title: data.title || data.headline || 'Untitled',
        url: `https://www.immowelt.de/expose/${id}`,
        price,
        priceText,
        location,
        area,
        plotArea,
        rooms,
        images,
        features,
        coordinates,
        metadata,
        _nextData: data,
      };

    } catch (error: any) {
      console.error('Error parsing NextData property:', error.message);
      return null;
    }
  }

  /**
   * Extract listing URLs from search results page
   */
  private async extractListingUrls(page: Page): Promise<string[]> {
    try {
      // Wait for content to load
      await page.waitForLoadState('networkidle', { timeout: this.config.timeout });

      // Scroll to trigger lazy loading
      if (this.config.stealthMode) {
        await naturalScroll(page);
        await randomDelay(500, 1500);
      }

      // Extract listing URLs from DOM
      const urls = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href*="/expose/"]'));
        const uniqueUrls = new Set<string>();

        links.forEach(link => {
          const anchor = link as HTMLAnchorElement;
          const url = anchor.href;
          // Only add valid expose URLs
          if (url && url.includes('/expose/')) {
            uniqueUrls.add(url);
          }
        });

        return Array.from(uniqueUrls);
      });

      return urls;

    } catch (error: any) {
      console.error(`Error extracting listing URLs from page: ${error.message}`);
      return [];
    }
  }

  /**
   * Extract data from a detail page (either from __NEXT_DATA__ or HTML fallback)
   */
  private async extractDetailPageData(page: Page, url: string): Promise<ImmoweltListing | null> {
    try {
      // Extract ID from URL
      const idMatch = url.match(/\/expose\/([^?]+)/);
      const id = idMatch ? idMatch[1] : '';

      if (!id) {
        console.warn(`Could not extract ID from URL: ${url}`);
        return null;
      }

      // Try to extract __NEXT_DATA__ first
      const nextData = await this.extractNextData(page);

      if (nextData) {
        // Try to find property data in different locations
        const propertyData =
          nextData.props?.pageProps?.propertyData ||
          nextData.props?.pageProps?.estateData ||
          nextData.props?.pageProps?.initialEstateData ||
          (nextData.props?.pageProps as any)?.data;

        if (propertyData) {
          const listing = this.parseNextDataProperty(propertyData);
          if (listing) {
            return listing;
          }
        }
      }

      // Wait for page content to load (wait for any of these selectors)
      try {
        await page.waitForSelector('h1, [data-test], main, article', { timeout: 10000 });
        await randomDelay(1000, 2000); // Additional wait for dynamic content
      } catch (e) {
        console.warn(`Timeout waiting for page content on ${url}`);
      }

      // HTML Fallback - extract data from page DOM with comprehensive selectors
      return await page.evaluate(({ listingId, listingUrl }: { listingId: string; listingUrl: string }) => {
        const extractText = (selectors: string[]): string | undefined => {
          for (const selector of selectors) {
            const el = document.querySelector(selector);
            if (el?.textContent?.trim()) {
              return el.textContent.trim();
            }
          }
          return undefined;
        };

        const extractNumber = (text: string | undefined): number | undefined => {
          if (!text) return undefined;
          const match = text.replace(/\./g, '').match(/[\d,]+/);
          if (match) {
            return parseFloat(match[0].replace(',', '.'));
          }
          return undefined;
        };

        // Extract title with multiple selector attempts
        const title = extractText([
          'h1',
          '[data-test="expose-title"]',
          '.Title, [class*="Title"]',
          '[class*="heading"]',
          '[class*="Heading"]',
          'main h1',
          'article h1'
        ]) || 'Untitled';

        // Extract price with comprehensive selectors
        const priceText = extractText([
          '[data-test="price"]',
          '[class*="Price"]:not([class*="Text"])',
          '[class*="price"]:not([class*="text"])',
          '[class*="kaufpreis"]',
          '[class*="Kaufpreis"]',
          '[class*="kaltmiete"]',
          '[class*="Kaltmiete"]',
          'strong',
          '[class*="value"]',
          '[class*="Value"]'
        ]);
        const price = extractNumber(priceText);

        // Extract location with comprehensive selectors
        const locationText = extractText([
          '[data-test="location"]',
          '[data-test="address"]',
          '[class*="Location"]',
          '[class*="location"]',
          '[class*="Address"]',
          '[class*="address"]',
          '[class*="Stadt"]',
          '[class*="stadt"]'
        ]);

        // Extract area and rooms from multiple sources
        let area: number | undefined;
        let rooms: number | undefined;

        // Try structured data first
        const keyFactSelectors = [
          '[data-test="area"]',
          '[data-test="rooms"]',
          '[class*="KeyFact"]',
          '[class*="keyfact"]',
          '[class*="Feature"]',
          '[class*="feature"]',
          '[class*="Fact"]',
          '[class*="fact"]',
          'dl dt, dl dd',
          'ul li'
        ];

        keyFactSelectors.forEach(selector => {
          const elements = Array.from(document.querySelectorAll(selector));
          elements.forEach(el => {
            const text = el.textContent || '';
            if ((text.includes('m²') || text.includes('qm') || text.includes('Wohnfläche')) && !area) {
              const areaMatch = extractNumber(text);
              if (areaMatch && areaMatch > 5 && areaMatch < 10000) { // Sanity check
                area = areaMatch;
              }
            }
            if ((text.includes('Zimmer') || text.includes('Zi.')) && !rooms) {
              const roomsMatch = extractNumber(text);
              if (roomsMatch && roomsMatch > 0 && roomsMatch < 50) { // Sanity check
                rooms = roomsMatch;
              }
            }
          });
        });

        // If still no area/rooms, scan entire text content
        if (!area || !rooms) {
          const bodyText = document.body.textContent || '';

          if (!area) {
            const areaMatches = bodyText.match(/(\d+(?:[.,]\d+)?)\s*(?:m²|qm|Quadratmeter)/gi);
            if (areaMatches && areaMatches.length > 0) {
              const areaNum = extractNumber(areaMatches[0]);
              if (areaNum && areaNum > 5 && areaNum < 10000) {
                area = areaNum;
              }
            }
          }

          if (!rooms) {
            const roomMatches = bodyText.match(/(\d+(?:[.,]\d+)?)\s*(?:Zimmer|Zi\.)/gi);
            if (roomMatches && roomMatches.length > 0) {
              const roomsNum = extractNumber(roomMatches[0]);
              if (roomsNum && roomsNum > 0 && roomsNum < 50) {
                rooms = roomsNum;
              }
            }
          }
        }

        // Extract images with comprehensive selectors
        const images: string[] = [];
        const imgSelectors = [
          'img[src*="immowelt"]',
          'img[class*="gallery"]',
          'img[class*="Gallery"]',
          'img[class*="image"]',
          'img[class*="Image"]',
          'img[class*="photo"]',
          'img[class*="Photo"]',
          '[data-test="gallery"] img',
          'picture img',
          'figure img'
        ];

        imgSelectors.forEach(selector => {
          const imgElements = document.querySelectorAll(selector);
          imgElements.forEach(img => {
            const src = (img as HTMLImageElement).src;
            if (src && !src.includes('placeholder') && !src.includes('icon') && !images.includes(src)) {
              images.push(src);
            }
          });
        });

        return {
          id: listingId,
          title,
          url: listingUrl,
          price,
          priceText,
          location: locationText ? { city: locationText } : undefined,
          area,
          rooms,
          images: images.length > 0 ? images : undefined,
        } as any;

      }, { listingId: id, listingUrl: url });

    } catch (error: any) {
      console.error(`Error extracting detail page data from ${url}: ${error.message}`);
      return null;
    }
  }

  /**
   * Extract listings from search results page (new two-step approach)
   */
  private async extractListingsFromPage(page: Page): Promise<ImmoweltListing[]> {
    const listings: ImmoweltListing[] = [];

    try {
      // Step 1: Extract listing URLs from search page
      const urls = await this.extractListingUrls(page);

      if (urls.length === 0) {
        console.log('   ℹ️  No listing URLs found on page');
        return listings;
      }

      console.log(`   ✓ Found ${urls.length} listing URLs`);

      // Step 2: Visit each detail page to extract data
      // Limit to first few URLs for testing (can be adjusted)
      const maxListingsPerPage = parseInt(process.env.MAX_LISTINGS_PER_PAGE || '60');
      const urlsToScrape = urls.slice(0, maxListingsPerPage);

      for (let i = 0; i < urlsToScrape.length; i++) {
        const url = urlsToScrape[i];

        try {
          // Rate limiting
          if (i > 0) {
            if (this.config.randomDelays) {
              await randomDelay(this.config.minDelay, this.config.maxDelay);
            } else {
              await page.waitForTimeout(this.config.rateLimit);
            }
          }

          // Navigate to detail page
          await page.goto(url, {
            waitUntil: 'networkidle',
            timeout: this.config.timeout
          });

          // Wait for DataDome check
          await randomDelay(1000, 2000);

          // Extract data from detail page
          const listing = await this.extractDetailPageData(page, url);

          if (listing) {
            listings.push(listing);
            if ((i + 1) % 10 === 0) {
              console.log(`   ✓ Scraped ${i + 1}/${urlsToScrape.length} listings`);
            }
          }

        } catch (error: any) {
          console.error(`   ⚠️  Failed to scrape ${url}: ${error.message}`);
        }
      }

      console.log(`   ✓ Successfully scraped ${listings.length} of ${urlsToScrape.length} listings`);

    } catch (error: any) {
      console.error(`Error extracting listings from page: ${error.message}`);
    }

    return listings;
  }

  /**
   * Scrape a specific category
   */
  private async scrapeCategory(
    url: string,
    category: string,
    maxPages: number = 10
  ): Promise<ImmoweltListing[]> {
    const allListings: ImmoweltListing[] = [];

    await this.initBrowser();
    const context = await createStealthContext(this.browser!);

    try {
      const page = await context.newPage();

      console.log(`\n📄 Scraping category: ${category}`);
      console.log(`   URL: ${url}`);
      console.log(`   Stealth mode: ${this.config.stealthMode ? '✓ Enabled' : '✗ Disabled'}`);

      // Navigate to first page with realistic delay
      if (this.config.randomDelays) {
        await randomDelay(this.config.minDelay, this.config.maxDelay);
      }

      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: this.config.timeout
      });

      // Wait a bit for DataDome check
      await randomDelay(2000, 4000);

      // Check for DataDome challenge
      const isBlocked = await page.evaluate(() => {
        return document.body.textContent?.includes('DataDome') ||
               document.body.textContent?.includes('Access denied') ||
               document.querySelector('[id*="datadome"]') !== null;
      });

      if (isBlocked) {
        console.error('   ❌ DataDome protection detected!');
        console.error('   💡 Try: Longer delays, residential proxies, or ScrapFly service');
        await page.close();
        await context.close();
        return allListings;
      }

      // Extract listings from first page
      const firstPageListings = await this.extractListingsFromPage(page);
      console.log(`   ✓ Page 1: Found ${firstPageListings.length} listings`);
      allListings.push(...firstPageListings);

      // Try to find pagination
      let currentPage = 1;
      while (currentPage < maxPages) {
        // Rate limiting
        if (this.config.randomDelays) {
          await randomDelay(this.config.minDelay, this.config.maxDelay);
        } else {
          await page.waitForTimeout(this.config.rateLimit);
        }

        // Use URL-based pagination - immowelt uses `sp` parameter
        const nextPageNum = currentPage + 1;
        const separator = url.includes('?') ? '&' : '?';
        const nextPageUrl = `${url}${separator}sp=${nextPageNum}`;

        try {
          console.log(`   🌐 Navigating to page ${nextPageNum}: ${nextPageUrl}`);
          await page.goto(nextPageUrl, {
            waitUntil: 'networkidle',
            timeout: this.config.timeout
          });

          currentPage++;

          // Random delay after page load
          if (this.config.randomDelays) {
            await randomDelay(1500, 3000);
          }

          const pageListings = await this.extractListingsFromPage(page);
          console.log(`   ✓ Page ${currentPage}: Found ${pageListings.length} listings`);

          if (pageListings.length === 0) {
            console.log(`   ℹ️  No listings on page ${currentPage}, stopping`);
            break;
          }

          allListings.push(...pageListings);
        } catch (error) {
          console.log(`   ⚠️  Failed to navigate to page ${currentPage + 1}`);
          break;
        }
      }

      await page.close();

    } catch (error: any) {
      console.error(`Error scraping category ${category}:`, error.message);
    } finally {
      await context.close();
    }

    return allListings;
  }

  /**
   * Scrape all listings (sales and rentals)
   */
  async scrapeAll(): Promise<ImmoweltListing[]> {
    const allListings: ImmoweltListing[] = [];

    try {
      // Max pages per category
      const maxPages = parseInt(process.env.MAX_PAGES_PER_CATEGORY || '50');

      // Define categories to scrape
      // Nationwide searches using immowelt.de URL structure
      const categories = [
        // RESIDENTIAL - Apartments
        {
          name: 'Apartments for Sale',
          url: 'https://www.immowelt.de/suche/wohnungen/kaufen',
          type: 'sale',
          propertyType: 'apartment'
        },
        {
          name: 'Apartments for Rent',
          url: 'https://www.immowelt.de/suche/wohnungen/mieten',
          type: 'rent',
          propertyType: 'apartment'
        },
        // RESIDENTIAL - Houses
        {
          name: 'Houses for Sale',
          url: 'https://www.immowelt.de/suche/haeuser/kaufen',
          type: 'sale',
          propertyType: 'house'
        },
        {
          name: 'Houses for Rent',
          url: 'https://www.immowelt.de/suche/haeuser/mieten',
          type: 'rent',
          propertyType: 'house'
        },
        // LAND
        {
          name: 'Land/Plots for Sale',
          url: 'https://www.immowelt.de/suche/grundstuecke/kaufen',
          type: 'sale',
          propertyType: 'land'
        },
        // COMMERCIAL
        {
          name: 'Commercial Properties for Sale',
          url: 'https://www.immowelt.de/suche/gewerbe/kaufen',
          type: 'sale',
          propertyType: 'commercial'
        },
        {
          name: 'Commercial Properties for Rent',
          url: 'https://www.immowelt.de/suche/gewerbe/mieten',
          type: 'rent',
          propertyType: 'commercial'
        },
        {
          name: 'Offices for Sale',
          url: 'https://www.immowelt.de/suche/bueros/kaufen',
          type: 'sale',
          propertyType: 'office'
        },
        {
          name: 'Offices for Rent',
          url: 'https://www.immowelt.de/suche/bueros/mieten',
          type: 'rent',
          propertyType: 'office'
        },
        {
          name: 'Warehouses for Sale',
          url: 'https://www.immowelt.de/suche/hallen/kaufen',
          type: 'sale',
          propertyType: 'warehouse'
        },
        {
          name: 'Warehouses for Rent',
          url: 'https://www.immowelt.de/suche/hallen/mieten',
          type: 'rent',
          propertyType: 'warehouse'
        },
        // HOSPITALITY
        {
          name: 'Hospitality Properties for Sale',
          url: 'https://www.immowelt.de/suche/gastgewerbe/kaufen',
          type: 'sale',
          propertyType: 'hospitality'
        },
        {
          name: 'Hospitality Properties for Rent',
          url: 'https://www.immowelt.de/suche/gastgewerbe/mieten',
          type: 'rent',
          propertyType: 'hospitality'
        },
        // PARKING
        {
          name: 'Parking/Garages for Sale',
          url: 'https://www.immowelt.de/suche/garagen/kaufen',
          type: 'sale',
          propertyType: 'parking'
        },
        {
          name: 'Parking/Garages for Rent',
          url: 'https://www.immowelt.de/suche/garagen/mieten',
          type: 'rent',
          propertyType: 'parking'
        },
      ];

      console.log(`\n🌐 Scraping Immowelt.de`);
      console.log(`   Max pages per category: ${maxPages}`);
      console.log(`   Categories: ${categories.length}`);
      console.log(`   DataDome protection: Active (using stealth mode)\n`);

      for (const category of categories) {
        const categoryListings = await this.scrapeCategory(category.url, category.name, maxPages);

        // Add transaction type and property type to listings
        categoryListings.forEach(listing => {
          listing.transactionType = category.type;
          listing.propertyType = category.propertyType;
        });

        allListings.push(...categoryListings);

        console.log(`✅ Category complete: ${category.name} - ${categoryListings.length} listings\n`);

        // Delay between categories
        if (this.config.randomDelays) {
          console.log(`   ⏳ Cooling down before next category...`);
          await randomDelay(5000, 10000);
        }
      }

      console.log(`\n📊 Total listings scraped: ${allListings.length}`);

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
    const context = await createStealthContext(this.browser!);

    try {
      const page = await context.newPage();

      // Random delay before request
      if (this.config.randomDelays) {
        await randomDelay(this.config.minDelay, this.config.maxDelay);
      }

      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: this.config.timeout
      });

      // Wait for DataDome check
      await randomDelay(2000, 4000);

      // Use the new extraction method (tries __NEXT_DATA__ first, then HTML fallback)
      const listing = await this.extractDetailPageData(page, url);

      await page.close();
      await context.close();

      return listing;

    } catch (error: any) {
      console.error(`Error scraping listing details from ${url}:`, error.message);
      await context.close();
      return null;
    }
  }
}
