import { Browser, Page } from 'playwright';
import { ImmodirektListing, ScrapeResult, ScraperConfig } from '../types/immodirektTypes';
import {
  launchStealthBrowser,
  createStealthContext,
  navigateWithCloudflareBypass
} from '../utils/browser';

export class ListingsScraper {
  private config: ScraperConfig;
  private browser: Browser | null = null;

  constructor() {
    this.config = {
      headless: process.env.HEADLESS !== 'false',
      timeout: parseInt(process.env.TIMEOUT || '60000'), // 60s for Cloudflare
      maxRetries: parseInt(process.env.MAX_RETRIES || '3'),
      rateLimit: parseInt(process.env.RATE_LIMIT_DELAY || '2000'), // Slower for Cloudflare
      useStealthMode: process.env.STEALTH_MODE !== 'false',
      bypassCloudflare: process.env.BYPASS_CLOUDFLARE !== 'false',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    };
  }

  /**
   * Initialize browser with stealth mode
   */
  private async initBrowser(): Promise<void> {
    if (!this.browser) {
      this.browser = await launchStealthBrowser({
        headless: this.config.headless,
        timeout: this.config.timeout,
        useStealthMode: this.config.useStealthMode
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
   * Handle cookie consent popup
   */
  private async handleConsent(page: Page): Promise<void> {
    try {
      // Wait for various consent popup patterns
      await page.waitForTimeout(2000);

      const consentSelectors = [
        'button[id*="accept"]',
        'button[id*="consent"]',
        'button[class*="accept"]',
        'button[class*="consent"]',
        'button:has-text("Akzeptieren")',
        'button:has-text("Alle akzeptieren")',
        'button:has-text("Zustimmen")',
        '#onetrust-accept-btn-handler',
        '.uc-accept-all-button',
        '[data-testid="uc-accept-all-button"]'
      ];

      for (const selector of consentSelectors) {
        try {
          const button = await page.$(selector);
          if (button && await button.isVisible()) {
            console.log(`   ✓ Found consent button: ${selector}`);
            await button.click();
            await page.waitForTimeout(1000);
            return;
          }
        } catch (e) {
          // Continue to next selector
        }
      }

      console.log('   ⚠️  No consent button found, continuing anyway');
    } catch (error) {
      console.log('   ℹ️  No consent popup detected');
    }
  }

  /**
   * Extract listings from a single page using window.__INITIAL_STATE__
   */
  private async extractListingsFromPage(page: Page): Promise<ImmodirektListing[]> {
    const listings: ImmodirektListing[] = [];

    try {
      // Wait for the page to load
      await page.waitForTimeout(2000);

      // Extract listing data from window.__INITIAL_STATE__
      const extractedData = await page.evaluate(() => {
        const state = (window as any).__INITIAL_STATE__;
        if (state && state.properties && state.properties.hits) {
          return state.properties.hits.map((hit: any) => {
            const raw = hit.raw || {};
            const meta = raw.meta || {};
            const description = raw.description || {};
            const priceInfo = raw.priceInformation || {};
            const prices = priceInfo.prices || {};
            const area = raw.area || {};
            const localization = raw.localization || {};
            const address = localization.address || {};
            const pictures = raw.pictures || [];
            const view = hit.view || {};
            const links = view.links || {};
            const contact = raw.contact || {};
            const company = contact.company || {};

            // Extract price (try different paths)
            const price = priceInfo.primaryPrice ||
                         prices.buy?.total ||
                         prices.rent?.total ||
                         0;

            // Extract images
            const images = pictures.map((pic: any) => pic.url).filter(Boolean);

            // Build URL from view.links.toExpose
            const url = links.toExpose ?
                       `https://www.immodirekt.at${links.toExpose}` :
                       '';

            return {
              id: meta.exposeId || '',
              title: description.title || '',
              url: url,
              price: price,
              priceText: view.primaryPrice?.value || '',
              location: {
                city: address.city || '',
                state: address.state || '',
                postalCode: address.zip || '',
                address: address.street || ''
              },
              area: area.primaryArea || area.livingArea || 0,
              plotArea: area.plotArea || 0,
              rooms: area.numberOfRooms || 0,
              bedrooms: area.numberOfBedrooms || 0,
              bathrooms: area.numberOfBathrooms || 0,
              floor: localization.information?.floor || undefined,
              images: images,
              coordinates: localization.coordinates ? {
                lat: localization.coordinates.lat,
                lng: localization.coordinates.lng
              } : undefined,
              realtor: {
                name: contact.firstName && contact.lastName ?
                     `${contact.firstName} ${contact.lastName}` : '',
                company: company.name || company.contractHolderName || ''
              },
              // Store the full raw object for later processing
              raw: raw
            };
          });
        }
        return [];
      });

      listings.push(...extractedData);
    } catch (error: any) {
      console.error(`Error extracting listings from page: ${error.message}`);
    }

    return listings;
  }

  /**
   * Get total number of hits from window.__INITIAL_STATE__
   */
  private async getTotalHits(page: Page): Promise<number> {
    try {
      return await page.evaluate(() => {
        const state = (window as any).__INITIAL_STATE__;
        if (state && state.properties && state.properties.totalHits) {
          return state.properties.totalHits;
        }
        return 0;
      });
    } catch (error) {
      return 0;
    }
  }

  /**
   * Scrape a specific category (e.g., apartments for sale)
   */
  private async scrapeCategory(
    url: string,
    category: string,
    maxPages: number = 10
  ): Promise<ImmodirektListing[]> {
    const allListings: ImmodirektListing[] = [];
    const shouldFetchDetails = process.env.FETCH_DETAILS !== 'false';

    await this.initBrowser();
    const context = await createStealthContext(this.browser!);

    try {
      const page = await context.newPage();

      console.log(`\n📄 Scraping category: ${category}`);
      console.log(`   URL: ${url}`);
      console.log(`   Cloudflare bypass: ${this.config.bypassCloudflare ? '✓ Enabled' : '✗ Disabled'}`);
      console.log(`   Detail pages: ${shouldFetchDetails ? '✓ Enabled' : '✗ Disabled'}`);

      // Navigate with Cloudflare bypass
      await navigateWithCloudflareBypass(page, url, { timeout: this.config.timeout });

      // Handle cookie consent
      await this.handleConsent(page);

      // Get total available listings
      const totalHits = await this.getTotalHits(page);
      console.log(`   Total available in category: ${totalHits.toLocaleString()}`);

      // Extract listings from first page
      const firstPageListings = await this.extractListingsFromPage(page);
      console.log(`   ✓ Page 1: Found ${firstPageListings.length} listings`);
      allListings.push(...firstPageListings);

      // Try to find pagination
      let currentPage = 1;
      while (currentPage < maxPages) {
        // Rate limiting (important for Cloudflare)
        await page.waitForTimeout(this.config.rateLimit);

        currentPage++;

        // Navigate to next page using URL parameter
        const nextPageUrl = `${url}?pagenumber=${currentPage}`;

        try {
          await navigateWithCloudflareBypass(page, nextPageUrl, { timeout: this.config.timeout });
          await page.waitForTimeout(2000);

          const pageListings = await this.extractListingsFromPage(page);
          console.log(`   ✓ Page ${currentPage}: Found ${pageListings.length} listings`);

          if (pageListings.length === 0) {
            console.log(`   ℹ️  No listings on page ${currentPage}, stopping`);
            break;
          }

          allListings.push(...pageListings);
        } catch (error) {
          console.log(`   ⚠️  Failed to navigate to page ${currentPage}`);
          break;
        }
      }

      await page.close();

      // Fetch detail pages if enabled
      if (shouldFetchDetails && allListings.length > 0) {
        console.log(`\n📋 Fetching detail pages for ${allListings.length} listings...`);
        const enrichedListings: ImmodirektListing[] = [];

        for (let i = 0; i < allListings.length; i++) {
          const listing = allListings[i];
          try {
            const details = await this.scrapeListingDetails(listing.url);
            if (details) {
              enrichedListings.push({
                ...listing,
                ...details
              });

              if ((i + 1) % 10 === 0) {
                console.log(`   ✓ Enriched ${i + 1}/${allListings.length} listings`);
              }
            } else {
              enrichedListings.push(listing);
            }
          } catch (error) {
            console.warn(`   ⚠️  Failed to fetch details for listing ${listing.id}`);
            enrichedListings.push(listing);
          }

          // Rate limiting between detail fetches
          await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));
        }

        console.log(`   ✅ Detail page enrichment complete`);
        return enrichedListings;
      }
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
  async scrapeAll(): Promise<ImmodirektListing[]> {
    const allListings: ImmodirektListing[] = [];

    try {
      const maxPages = parseInt(process.env.MAX_PAGES_PER_CATEGORY || '999999');

      // Define categories to scrape (using correct URLs)
      // Nationwide searches across all property types
      const categories = [
        // RESIDENTIAL - Apartments
        {
          name: 'Apartments for Sale',
          url: 'https://www.immodirekt.at/eigentumswohnungen/oesterreich',
          type: 'sale',
          propertyType: 'apartment'
        },
        {
          name: 'Apartments for Rent',
          url: 'https://www.immodirekt.at/mietwohnungen/oesterreich',
          type: 'rent',
          propertyType: 'apartment'
        },
        {
          name: 'Maisonettes for Sale',
          url: 'https://www.immodirekt.at/maisonetten-kaufen/oesterreich',
          type: 'sale',
          propertyType: 'maisonette'
        },
        {
          name: 'Maisonettes for Rent',
          url: 'https://www.immodirekt.at/maisonetten-mieten/oesterreich',
          type: 'rent',
          propertyType: 'maisonette'
        },
        {
          name: 'Lofts for Sale',
          url: 'https://www.immodirekt.at/lofts-ateliers-kaufen/oesterreich',
          type: 'sale',
          propertyType: 'loft'
        },
        {
          name: 'Lofts for Rent',
          url: 'https://www.immodirekt.at/lofts-ateliers-mieten/oesterreich',
          type: 'rent',
          propertyType: 'loft'
        },
        // RESIDENTIAL - Houses
        {
          name: 'Houses for Sale',
          url: 'https://www.immodirekt.at/haeuser-kaufen/oesterreich',
          type: 'sale',
          propertyType: 'house'
        },
        {
          name: 'Houses for Rent',
          url: 'https://www.immodirekt.at/haeuser-mieten/oesterreich',
          type: 'rent',
          propertyType: 'house'
        },
        {
          name: 'Multi-family Houses for Sale',
          url: 'https://www.immodirekt.at/mehrfamilienhaeuser-kaufen/oesterreich',
          type: 'sale',
          propertyType: 'multi-family-house'
        },
        {
          name: 'Row Houses for Sale',
          url: 'https://www.immodirekt.at/reihenhaeuser-kaufen/oesterreich',
          type: 'sale',
          propertyType: 'row-house'
        },
        {
          name: 'Semi-detached Houses for Sale',
          url: 'https://www.immodirekt.at/doppelhaeuser-kaufen/oesterreich',
          type: 'sale',
          propertyType: 'semi-detached-house'
        },
        {
          name: 'Villas for Sale',
          url: 'https://www.immodirekt.at/villen-kaufen/oesterreich',
          type: 'sale',
          propertyType: 'villa'
        },
        {
          name: 'Farmhouses for Sale',
          url: 'https://www.immodirekt.at/bauernhaeuser-kaufen/oesterreich',
          type: 'sale',
          propertyType: 'farmhouse'
        },
        // LAND
        {
          name: 'Plots/Land for Sale',
          url: 'https://www.immodirekt.at/grundstuecke-kaufen/oesterreich',
          type: 'sale',
          propertyType: 'land'
        },
        {
          name: 'Commercial Land for Sale',
          url: 'https://www.immodirekt.at/gewerbegrundstücke-kaufen/oesterreich',
          type: 'sale',
          propertyType: 'commercial-land'
        },
        // COMMERCIAL
        {
          name: 'Offices for Sale',
          url: 'https://www.immodirekt.at/bueros-praxen-kaufen/oesterreich',
          type: 'sale',
          propertyType: 'office'
        },
        {
          name: 'Offices for Rent',
          url: 'https://www.immodirekt.at/bueros-praxen-mieten/oesterreich',
          type: 'rent',
          propertyType: 'office'
        },
        {
          name: 'Retail for Sale',
          url: 'https://www.immodirekt.at/geschaeftslokale-kaufen/oesterreich',
          type: 'sale',
          propertyType: 'retail'
        },
        {
          name: 'Retail for Rent',
          url: 'https://www.immodirekt.at/geschaeftslokale-mieten/oesterreich',
          type: 'rent',
          propertyType: 'retail'
        },
        {
          name: 'Warehouses for Sale',
          url: 'https://www.immodirekt.at/hallen-lager-kaufen/oesterreich',
          type: 'sale',
          propertyType: 'warehouse'
        },
        {
          name: 'Parking for Sale',
          url: 'https://www.immodirekt.at/garagen-stellplaetze-kaufen/oesterreich',
          type: 'sale',
          propertyType: 'parking'
        },
        // HOSPITALITY
        {
          name: 'Restaurants for Sale',
          url: 'https://www.immodirekt.at/gastgewerbe-kaufen/oesterreich',
          type: 'sale',
          propertyType: 'restaurant'
        },
        {
          name: 'Hotels for Sale',
          url: 'https://www.immodirekt.at/hotels-kaufen/oesterreich',
          type: 'sale',
          propertyType: 'hotel'
        },
        // AGRICULTURE
        {
          name: 'Agriculture/Forestry for Sale',
          url: 'https://www.immodirekt.at/land-forstwirtschaft-kaufen/oesterreich',
          type: 'sale',
          propertyType: 'agriculture'
        }
      ];

      console.log(`\n🌐 Scraping Immodirekt.at`);
      console.log(`   Max pages per category: ${maxPages === 999999 ? 'unlimited' : maxPages}`);
      console.log(`   Categories: ${categories.length}`);
      console.log(`   Cloudflare bypass: Enabled\n`);

      for (const category of categories) {
        const categoryListings = await this.scrapeCategory(category.url, category.name, maxPages);

        // Add transaction type and property type to listings
        categoryListings.forEach(listing => {
          listing.transactionType = category.type;
          listing.propertyType = category.propertyType;
        });

        allListings.push(...categoryListings);

        console.log(`✅ Category complete: ${category.name} - ${categoryListings.length} listings\n`);

        // Extra delay between categories
        await new Promise(resolve => setTimeout(resolve, 3000));
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
  async scrapeListingDetails(url: string): Promise<Partial<ImmodirektListing> | null> {
    const context = await createStealthContext(this.browser!);

    try {
      const page = await context.newPage();
      await navigateWithCloudflareBypass(page, url, { timeout: this.config.timeout });

      // Handle consent
      await this.handleConsent(page);

      // Extract detailed information
      const details = await page.evaluate(() => {
        const title = document.querySelector('h1, .expose-title')?.textContent?.trim() || '';
        const priceEl = document.querySelector('.price, .expose-price');
        const priceText = priceEl?.textContent?.trim() || '';
        const description = document.querySelector('.description, .expose-description')?.textContent?.trim() || '';

        // Extract features/amenities
        const features: string[] = [];
        document.querySelectorAll('.features li, .amenities li, [data-testid*="feature"]').forEach(el => {
          const text = el.textContent?.trim();
          if (text) features.push(text);
        });

        // Extract images
        const images: string[] = [];
        document.querySelectorAll('.gallery img, .expose-gallery img, [data-testid*="image"]').forEach(img => {
          const src = img.getAttribute('src') || img.getAttribute('data-src');
          if (src && !src.includes('placeholder')) images.push(src);
        });

        // Extract property attributes
        const attributes: Record<string, string> = {};
        document.querySelectorAll('.property-data tr, [data-testid*="property-detail"]').forEach(row => {
          const cells = row.querySelectorAll('td, th');
          if (cells.length === 2) {
            const name = cells[0]?.textContent?.trim() || '';
            const value = cells[1]?.textContent?.trim() || '';
            if (name && value) attributes[name.toLowerCase()] = value;
          }
        });

        // Extract coordinates
        let latitude: number | undefined;
        let longitude: number | undefined;

        const mapElement = document.querySelector('[data-lat], [data-lng]');
        if (mapElement) {
          const lat = mapElement.getAttribute('data-lat');
          const lng = mapElement.getAttribute('data-lng');
          if (lat && lng) {
            latitude = parseFloat(lat);
            longitude = parseFloat(lng);
          }
        }

        return { title, priceText, description, features, images, attributes, latitude, longitude };
      });

      await page.close();
      await context.close();

      const coordinates = (details.latitude && details.longitude)
        ? { lat: details.latitude, lng: details.longitude }
        : undefined;

      return {
        id: url.match(/\/(\d+)/)?.[1] || '',
        url,
        title: details.title,
        priceText: details.priceText,
        description: details.description,
        features: details.features,
        images: details.images,
        coordinates,
        _attributes: details.attributes
      };

    } catch (error: any) {
      console.error(`Error scraping listing details from ${url}:`, error.message);
      await context.close();
      return null;
    }
  }
}
