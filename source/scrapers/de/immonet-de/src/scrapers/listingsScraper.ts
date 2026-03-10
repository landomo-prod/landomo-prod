import { chromium, Browser, Page } from 'playwright';
import { ImmonetListing, ScrapeResult, ScraperConfig } from '../types/immonetTypes';
import { createStealthContext, waitForNetworkIdle, scrollPage, extractNextData, randomDelay, rateLimitedDelay, rotateHeadersOnPage } from '../utils/browser';
import { getRandomUserAgent } from '../utils/userAgents';
import * as LZString from 'lz-string';

export class ListingsScraper {
  private config: ScraperConfig;
  private browser: Browser | null = null;

  constructor() {
    this.config = {
      headless: process.env.HEADLESS !== 'false',
      timeout: parseInt(process.env.TIMEOUT || '30000'),
      maxRetries: parseInt(process.env.MAX_RETRIES || '3'),
      rateLimit: parseInt(process.env.RATE_LIMIT_DELAY || '1000'),
      userAgent: process.env.USER_AGENT || getRandomUserAgent() // Use random UA by default
    };
  }

  /**
   * Initialize browser
   */
  private async initBrowser(): Promise<void> {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: this.config.headless,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-software-rasterizer',
          '--disable-extensions',
          '--disable-background-networking',
          '--disable-sync',
          '--metrics-recording-only',
          '--mute-audio',
          '--no-first-run',
          '--safebrowsing-disable-auto-update'
        ],
        timeout: 60000
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
      // Wait for consent banner
      await page.waitForSelector('[class*="consent"], [class*="cookie"], [id*="consent"]', { timeout: 5000 }).catch(() => null);

      // Common selectors for AVIV Group / Usercentrics consent buttons
      const acceptSelectors = [
        'button[data-testid="uc-accept-all-button"]',
        '#uc-btn-accept-banner',
        'button[id*="accept"]',
        'button[class*="accept"]',
        'button:has-text("Akzeptieren")',
        'button:has-text("Alle akzeptieren")',
        'button:has-text("Alle Cookies akzeptieren")',
        'button:has-text("Accept")',
        '#gdpr-consent-tool-submit',
        'button[data-qa="accept-all"]',
        '.privacy-consent__accept'
      ];

      for (const selector of acceptSelectors) {
        try {
          const button = await page.$(selector);
          if (button && await button.isVisible()) {
            console.log(`   ✓ Found consent button: ${selector}`);
            await button.click();
            await page.waitForTimeout(1000);
            return;
          }
        } catch (e) {
          continue;
        }
      }

      console.log('   ℹ️  No consent popup detected');
    } catch (error) {
      console.log('   ℹ️  No consent popup found');
    }
  }

  /**
   * Extract and decode __UFRN_FETCHER__ data from page (immowelt.de format)
   * Supports both old LZ-string compressed format and new JSON.parse unicode-escaped format
   */
  private async extractUFRNData(page: Page): Promise<any> {
    try {
      if (page.isClosed()) return null;

      // Strategy 1: Try reading __UFRN_FETCHER__ from window (works for both old and new formats)
      const ufrnResult = await page.evaluate(() => {
        const fetcher = (window as any).__UFRN_FETCHER__;
        if (!fetcher) return null;
        const serpData = fetcher?.data?.['classified-serp-init-data'];
        if (!serpData) return null;
        // If it's already an object (new JSON.parse format), return it directly
        if (typeof serpData === 'object') return { parsed: serpData };
        // If it's a string, return it for decompression
        return { raw: serpData };
      }).catch(() => null);

      if (ufrnResult?.parsed) {
        console.log('   ✓ UFRN data extracted (pre-parsed JSON format)');
        return ufrnResult.parsed;
      }

      if (ufrnResult?.raw) {
        // Try LZ-string decompression (old format)
        const decompressed = LZString.decompressFromBase64(ufrnResult.raw);
        if (decompressed) {
          console.log('   ✓ UFRN data extracted (LZ-string compressed format)');
          return JSON.parse(decompressed);
        }
        // Try direct JSON parse (might be a plain JSON string)
        try {
          const directParsed = JSON.parse(ufrnResult.raw);
          console.log('   ✓ UFRN data extracted (plain JSON string format)');
          return directParsed;
        } catch {
          // Not valid JSON either
        }
      }

      // Strategy 2: Extract from script tag content directly (new pattern)
      const scriptData = await page.evaluate(() => {
        const scripts = Array.from(document.querySelectorAll('script'));
        for (const script of scripts) {
          const text = script.textContent || '';
          if (text.includes('classified-serp-init-data')) {
            // New format: window["__UFRN_FETCHER__"]=JSON.parse("...")
            const match = text.match(/classified-serp-init-data['"]\s*:\s*("(?:[^"\\]|\\.)*")/);
            if (match) return match[1];
            // Also try to get the whole UFRN object
            const fullMatch = text.match(/window\["__UFRN_FETCHER__"\]\s*=\s*JSON\.parse\("((?:[^"\\]|\\.)*)"\)/);
            if (fullMatch) return fullMatch[1];
          }
        }
        return null;
      }).catch(() => null);

      if (scriptData) {
        try {
          // Unescape unicode sequences and parse
          const unescaped = scriptData.replace(/\\u[\dA-Fa-f]{4}/g, (match: string) =>
            String.fromCharCode(parseInt(match.replace('\\u', ''), 16))
          ).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
          const parsed = JSON.parse(unescaped);
          const serpInit = parsed?.data?.['classified-serp-init-data'];
          if (serpInit) {
            console.log('   ✓ UFRN data extracted (script tag unicode-escaped format)');
            return typeof serpInit === 'string' ? JSON.parse(serpInit) : serpInit;
          }
        } catch (e: any) {
          console.log(`   ⚠️  Failed to parse script tag UFRN data: ${e.message}`);
        }
      }

      console.log('   ⚠️  No __UFRN_FETCHER__ data found on page');
      return null;
    } catch (error: any) {
      console.error('   ❌ Error extracting UFRN data:', error.message);
      return null;
    }
  }

  /**
   * Extract listings from page - tries UFRN first (fast), falls back to DOM
   */
  private async extractListingsFromPage(page: Page): Promise<ImmonetListing[]> {
    const listings: ImmonetListing[] = [];

    try {
      // Wait for page to fully hydrate (JS needs time to set __UFRN_FETCHER__)
      await randomDelay(3000, 5000);

      // Try UFRN extraction first (immowelt.de format - much faster)
      const ufrnData = await this.extractUFRNData(page);
      if (ufrnData?.pageProps?.classifieds && ufrnData?.pageProps?.classifiedsData) {
        const { classifieds, classifiedsData } = ufrnData.pageProps;
        console.log(`   ✓ UFRN: Found ${classifieds.length} classified IDs`);

        for (const classifiedId of classifieds) {
          const data = classifiedsData[classifiedId];
          if (!data) continue;

          const id = data.id;
          if (!id) continue;

          const title = data.hardFacts?.title || 'Untitled';
          const url = data.url
            ? `https://www.immowelt.de${data.url}`
            : `https://www.immowelt.de/expose/${id}`;

          const priceText = data.hardFacts?.price?.formatted;
          const price = priceText
            ? parseFloat(priceText.replace(/[^\d,]/g, '').replace(',', '.'))
            : undefined;

          let area: number | undefined;
          let rooms: number | undefined;
          if (data.hardFacts?.facts) {
            for (const fact of data.hardFacts.facts) {
              if (fact.type === 'livingSpace') area = parseFloat(fact.splitValue?.replace(',', '.') || '0');
              else if (fact.type === 'numberOfRooms') rooms = parseFloat(fact.splitValue?.replace(',', '.') || '0');
            }
          }

          const images: string[] = [];
          if (data.gallery?.images) {
            for (const img of data.gallery.images) {
              if (img.url) images.push(img.url);
            }
          }

          listings.push({
            id: id.toString(),
            title,
            url,
            price: isNaN(price!) ? undefined : price,
            priceText,
            location: {
              city: data.location?.address?.city,
              district: data.location?.address?.district,
              postalCode: data.location?.address?.zipCode,
            },
            area,
            rooms,
            images,
            description: data.mainDescription?.description,
            energyRating: data.energyClass?.value,
          });
        }

        const totalCount = ufrnData.pageProps.totalCount;
        const pageSize = ufrnData.pageProps.pageSize || classifieds.length || 20;
        if (totalCount) console.log(`   ℹ️  Total listings available: ${totalCount}`);
        (listings as any)._paginationInfo = { totalCount, pageSize };

        return listings;
      }

      // Fallback: DOM extraction
      console.log('   ℹ️  No UFRN data, falling back to DOM extraction');
      await page.waitForSelector('[class*="EstateItem"], [class*="listitem"], a[href*="/expose/"], [data-test*="estate"]', { timeout: 10000 }).catch(() => {
        console.log('   ⚠️  Timeout waiting for listings, attempting extraction anyway');
      });

      const extractedData = await page.evaluate(() => {
        const items: any[] = [];
        const seenIds = new Set<string>();

        // Try immowelt selectors first (immonet redirects to immowelt)
        // Then fall back to legacy sd-card/sd-cell selectors
        let cards = document.querySelectorAll('[class*="EstateItem"], [class*="listitem"], [data-test*="estate"]');
        if (cards.length === 0) {
          // Try finding cards by expose links
          const exposeLinks = document.querySelectorAll('a[href*="/expose/"]');
          const cardSet = new Set<Element>();
          exposeLinks.forEach(link => {
            const card = link.closest('div[class*="card"], div[class*="Card"], div[class*="item"], div[class*="Item"], article, li') || link.parentElement;
            if (card) cardSet.add(card);
          });
          cards = cardSet.size > 0 ? (Array.from(cardSet) as unknown as NodeListOf<Element>) : document.querySelectorAll('sd-card, sd-cell');
        }

        cards.forEach((card, index) => {
          try {
            const tagName = card.tagName.toLowerCase();

            // Extract basic elements
            const titleEl = card.querySelector('h2, h3, [class*="title"]');
            const linkEl = card.querySelector('a[href*="/expose/"]') || card.querySelector('a');
            const priceEl = card.querySelector('[class*="price"]') || Array.from(card.querySelectorAll('*')).find(el => el.textContent?.includes('€'));
            const locationEl = card.querySelector('[class*="location"]');

            const url = linkEl?.getAttribute('href') || '';
            const priceText = priceEl?.textContent?.trim() || '';
            const location = locationEl?.textContent?.trim() || card.textContent?.match(/Berlin[^\n]*/)?.[0] || '';

            // Extract area and rooms from card text
            const cardText = card.textContent || '';
            const areaMatch = cardText.match(/([\d.,]+)\s*m²/);
            const roomsMatch = cardText.match(/([\d.,]+)\s*Zi\./);
            const priceMatch = priceText.match(/([\d.,]+)\s*€/);

            const area = areaMatch ? parseFloat(areaMatch[1].replace('.', '').replace(',', '.')) : undefined;
            const rooms = roomsMatch ? parseFloat(roomsMatch[1].replace(',', '.')) : undefined;
            const price = priceMatch ? parseFloat(priceMatch[1].replace('.', '').replace(',', '.')) : undefined;

            // Extract ID from URL
            const idMatch = url.match(/\/expose\/([^/?]+)/);
            const id = idMatch?.[1] || `listing-${index}`;

            // Skip duplicates (same ID might appear multiple times)
            if (seenIds.has(id)) {
              return;
            }
            seenIds.add(id);

            // Build title - different strategies for sd-card vs sd-cell
            let title = '';
            if (titleEl?.textContent?.trim()) {
              // sd-card usually has a proper title
              title = titleEl.textContent.trim();
            } else {
              // sd-cell needs a constructed title
              // Try to find project name from parent or nearby elements
              const parentCard = card.parentElement?.closest('sd-card');
              const projectTitle = parentCard?.querySelector('h2, h3, [class*="title"]')?.textContent?.trim();

              if (projectTitle) {
                // Use project name + unit details
                title = `${projectTitle} - ${rooms || '?'} Zi., ${area || '?'}m²`;
              } else {
                // Fallback: construct from available data
                const roomStr = rooms ? `${rooms} Zi.` : '';
                const areaStr = area ? `${area}m²` : '';
                const priceStr = price ? `${price}€` : '';
                const locationStr = location ? location.substring(0, 30) : 'Berlin';

                title = [locationStr, roomStr, areaStr, priceStr].filter(s => s).join(', ');
              }
            }

            // Get images
            const imageEls = card.querySelectorAll('img');
            const images: string[] = [];
            imageEls.forEach(img => {
              const src = img.getAttribute('src') || img.getAttribute('data-src') || '';
              if (src && !src.includes('placeholder') && !src.includes('logo')) {
                images.push(src);
              }
            });

            if (title || url) {
              items.push({
                id,
                title: title || 'Apartment in Berlin',
                url: url.startsWith('http') ? url : `https://www.immowelt.de${url}`,
                price,
                priceText,
                location: { city: location },
                area,
                rooms,
                images
              });
            }
          } catch (err) {
            console.error('Error extracting card:', err);
          }
        });

        return items;
      });

      listings.push(...extractedData);
    } catch (error: any) {
      console.error(`Error extracting listings from page: ${error.message}`);
    }

    return listings;
  }

  /**
   * Parse entry from __NEXT_DATA__ into ImmonetListing
   */
  private parseNextDataEntry(entry: any): ImmonetListing | null {
    try {
      const id = entry.id || entry['@id'] || '';
      const title = entry.title || entry.headline || '';
      const url = entry.url || entry['@id'] || '';

      if (!id || !title) {
        return null;
      }

      const listing: ImmonetListing = {
        id: id.toString(),
        title,
        url: url.startsWith('http') ? url : `https://www.immowelt.de${url}`,
        price: this.parsePrice(entry.price),
        priceText: entry.priceFormatted || entry.price?.value || '',
        location: {
          city: entry.location?.city || entry.address?.addressLocality,
          district: entry.location?.district || entry.address?.addressRegion,
          address: entry.location?.address || entry.address?.streetAddress,
          postalCode: entry.location?.postalCode || entry.address?.postalCode
        },
        area: this.parseArea(entry.livingSpace || entry.floorSpace || entry.area),
        plotArea: this.parseArea(entry.plotArea),
        rooms: this.parseNumber(entry.numberOfRooms || entry.rooms),
        bedrooms: this.parseNumber(entry.numberOfBedrooms || entry.bedrooms),
        bathrooms: this.parseNumber(entry.numberOfBathrooms || entry.bathrooms),
        floor: this.parseFloor(entry.floor),
        propertyType: entry.propertyType || entry['@type'],
        transactionType: entry.marketingType,
        description: entry.description || entry.descriptionNote,
        images: this.extractImages(entry.images || entry.image),
        features: entry.features || entry.amenities || [],
        constructionYear: this.parseNumber(entry.constructionYear || entry.yearBuilt),
        condition: entry.condition || entry.objectCondition,
        energyRating: entry.energyEfficiencyClass || entry.energyCertificate?.class,
        heatingType: entry.heatingType || entry.firingTypes,
        parkingSpaces: this.parseNumber(entry.parkingSpaces),
        balcony: entry.hasBalcony || entry.balcony || false,
        terrace: entry.hasTerrace || entry.terrace || false,
        garden: entry.hasGarden || entry.garden || false,
        elevator: entry.hasElevator || entry.elevator || false,
        cellar: entry.hasCellar || entry.cellar || false,
        coordinates: this.extractCoordinates(entry.geo || entry.location?.geo),
        realtor: {
          name: entry.contactPerson || entry.agent?.name,
          company: entry.realEstate || entry.agent?.organization,
          phone: entry.contactPhone || entry.agent?.telephone,
          email: entry.contactEmail || entry.agent?.email,
          logo: entry.agentLogo || entry.agent?.logo
        },
        metadata: {
          listingId: id.toString(),
          estateId: entry.estateId,
          published: entry.datePublished || entry.createdAt,
          updated: entry.dateModified || entry.updatedAt
        },
        _nextData: entry
      };

      return listing;
    } catch (error) {
      console.error('Error parsing __NEXT_DATA__ entry:', error);
      return null;
    }
  }

  /**
   * Helper: Parse price from various formats
   */
  private parsePrice(priceData: any): number | undefined {
    if (typeof priceData === 'number') return priceData;
    if (!priceData) return undefined;

    if (typeof priceData === 'object') {
      const value = priceData.value || priceData.amount || priceData.price;
      if (typeof value === 'number') return value;
      if (typeof value === 'string') {
        const num = parseFloat(value.replace(/[^\d,]/g, '').replace(',', '.'));
        return isNaN(num) ? undefined : num;
      }
    }

    if (typeof priceData === 'string') {
      const num = parseFloat(priceData.replace(/[^\d,]/g, '').replace(',', '.'));
      return isNaN(num) ? undefined : num;
    }

    return undefined;
  }

  /**
   * Helper: Parse area from various formats
   */
  private parseArea(areaData: any): number | undefined {
    if (typeof areaData === 'number') return areaData;
    if (!areaData) return undefined;

    if (typeof areaData === 'object') {
      const value = areaData.value || areaData.amount;
      if (typeof value === 'number') return value;
      if (typeof value === 'string') {
        const num = parseFloat(value.replace(',', '.'));
        return isNaN(num) ? undefined : num;
      }
    }

    if (typeof areaData === 'string') {
      const num = parseFloat(areaData.replace(',', '.'));
      return isNaN(num) ? undefined : num;
    }

    return undefined;
  }

  /**
   * Helper: Parse number from various formats
   */
  private parseNumber(value: any): number | undefined {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const num = parseFloat(value.replace(',', '.'));
      return isNaN(num) ? undefined : num;
    }
    return undefined;
  }

  /**
   * Helper: Parse floor from string or number
   */
  private parseFloor(floorData: any): number | undefined {
    if (typeof floorData === 'number') return floorData;
    if (!floorData) return undefined;

    if (typeof floorData === 'string') {
      const normalized = floorData.toLowerCase();
      if (normalized.includes('erdgeschoss') || normalized.includes('eg')) return 0;

      const match = normalized.match(/(\d+)/);
      if (match) return parseInt(match[1]);
    }

    return undefined;
  }

  /**
   * Helper: Extract images from various formats
   */
  private extractImages(imagesData: any): string[] {
    if (!imagesData) return [];

    if (Array.isArray(imagesData)) {
      return imagesData.map(img => {
        if (typeof img === 'string') return img;
        if (typeof img === 'object') return img.url || img.contentUrl || img.src || '';
      }).filter(url => url);
    }

    if (typeof imagesData === 'string') return [imagesData];
    if (typeof imagesData === 'object' && imagesData.url) return [imagesData.url];

    return [];
  }

  /**
   * Helper: Extract coordinates from geo data
   */
  private extractCoordinates(geoData: any): { lat: number; lng: number } | undefined {
    if (!geoData) return undefined;

    let lat: number | undefined;
    let lng: number | undefined;

    if (typeof geoData === 'object') {
      lat = geoData.latitude || geoData.lat;
      lng = geoData.longitude || geoData.lng || geoData.lon;
    }

    if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
      return { lat, lng };
    }

    return undefined;
  }

  /**
   * Scrape a specific category
   */
  private async scrapeCategory(
    url: string,
    category: string,
    maxPages: number = 10,
    fallbackUrl?: string
  ): Promise<ImmonetListing[]> {
    const allListings: ImmonetListing[] = [];

    // Always start with fresh browser for each category to avoid state issues
    // This prevents hangs after browser disconnections/reinitializations
    console.log('   🔄 Initializing fresh browser for category...');
    await this.close(); // Close any existing browser
    await this.initBrowser();

    // Verify browser is ready
    if (!this.browser || !this.browser.isConnected()) {
      throw new Error('Failed to initialize browser for category');
    }

    // Rotate user agent for each category
    const rotatedUserAgent = getRandomUserAgent();
    const context = await createStealthContext(this.browser!, {
      userAgent: rotatedUserAgent,
      viewport: { width: 1920, height: 1080 },
      timeout: this.config.timeout
    });

    let page = null;
    try {
      page = await context.newPage();

      console.log(`\n📄 Scraping category: ${category}`);
      console.log(`   URL: ${url}`);

      // Rotate headers before first request
      await rotateHeadersOnPage(page);

      // Navigate to first page
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: this.config.timeout });
      await waitForNetworkIdle(page, this.config.timeout);

      // Handle cookie consent
      await this.handleConsent(page);

      // Check for DataDome/bot protection
      const isBlocked = await page.evaluate(() => {
        const bodyText = document.body?.textContent || '';
        return bodyText.includes('DataDome') ||
               bodyText.includes('Access denied') ||
               bodyText.includes('blocked') ||
               document.querySelector('[id*="datadome"]') !== null;
      }).catch(() => false);

      if (isBlocked) {
        console.log('   ❌ DataDome/bot protection detected! Try longer delays or residential proxies.');
      }

      // Scroll to load lazy content (3 scrolls to ensure all listings are loaded)
      await scrollPage(page, 3);

      // Extract listings from first page
      let firstPageListings = await this.extractListingsFromPage(page);

      // If primary URL returned 0 listings and we have a fallback, try it
      if (firstPageListings.length === 0 && fallbackUrl) {
        console.log(`   ⚠️  Primary URL returned 0 listings, trying fallback: ${fallbackUrl}`);
        await rotateHeadersOnPage(page);
        await page.goto(fallbackUrl, { waitUntil: 'domcontentloaded', timeout: this.config.timeout });
        await waitForNetworkIdle(page, this.config.timeout);
        await this.handleConsent(page);
        await scrollPage(page, 3);
        firstPageListings = await this.extractListingsFromPage(page);
        if (firstPageListings.length > 0) {
          // Switch to fallback URL for pagination
          url = fallbackUrl;
        }
      }

      console.log(`   ✓ Page 1: Found ${firstPageListings.length} listings`);
      allListings.push(...firstPageListings);

      // Try pagination
      let currentPage = 1;
      while (currentPage < maxPages) {
        // Use rate limited delay with jitter and occasional long pauses
        await rateLimitedDelay(currentPage);

        // Look for next page button or construct URL
        const nextPageUrl = await this.getNextPageUrl(page, url, currentPage + 1);

        if (!nextPageUrl) {
          console.log(`   ℹ️  No more pages found`);
          break;
        }

        try {
          // Check if page is still valid before navigating
          if (page.isClosed()) {
            console.log(`   ⚠️  Page closed unexpectedly, creating new page...`);
            page = await context.newPage();
          }

          // Rotate headers before each page request
          await rotateHeadersOnPage(page);

          console.log(`   🌐 Navigating to page ${currentPage + 1}...`);
          await page.goto(nextPageUrl, { waitUntil: 'domcontentloaded', timeout: this.config.timeout });
          await waitForNetworkIdle(page, this.config.timeout);
          await scrollPage(page, 3);

          currentPage++;
          const pageListings = await this.extractListingsFromPage(page);
          console.log(`   ✓ Page ${currentPage}: Found ${pageListings.length} listings`);

          if (pageListings.length === 0) {
            console.log(`   ℹ️  No listings on page ${currentPage}, stopping`);
            break;
          }

          allListings.push(...pageListings);
        } catch (error: any) {
          console.error(`   ❌ Failed to navigate to page ${currentPage + 1}: ${error.message}`);
          break;
        }
      }

      if (page) {
        await page.close().catch(() => {});
      }
    } catch (error: any) {
      console.error(`Error scraping category ${category}:`, error.message);
    } finally {
      try {
        await context.close();
      } catch (error) {
        console.log('   ⚠️  Error closing context (already closed)');
      }
    }

    return allListings;
  }

  /**
   * Get next page URL using immowelt's pagination parameters
   * New format uses &page=N, old format uses &sp=N
   */
  private async getNextPageUrl(page: Page, baseUrl: string, pageNum: number): Promise<string | null> {
    try {
      // Check pagination info from UFRN data
      const listings = (this as any)._lastPageListings;
      const paginationInfo = listings?._paginationInfo;
      if (paginationInfo?.totalCount) {
        const totalPages = Math.ceil(paginationInfo.totalCount / (paginationInfo.pageSize || 20));
        if (pageNum > totalPages) return null;
      }

      const separator = baseUrl.includes('?') ? '&' : '?';
      // New /classified-search format uses &page=N, old /suche/ format uses &sp=N
      const pageParam = baseUrl.includes('/classified-search') ? 'page' : 'sp';
      return `${baseUrl}${separator}${pageParam}=${pageNum}`;
    } catch (error) {
      return null;
    }
  }

  /**
   * Scrape all listings (sales and rentals)
   */
  async scrapeAll(): Promise<ImmonetListing[]> {
    const allListings: ImmonetListing[] = [];

    try {
      const maxPages = parseInt(process.env.MAX_PAGES_PER_CATEGORY || '999999');

      // immonet.de now redirects to immowelt.de (AVIV Group merger)
      // /suche/ URLs work with UFRN extraction; /classified-search gets DataDome blocked
      const categories = [
        // RESIDENTIAL
        { name: 'Apartments for Sale', url: 'https://www.immowelt.de/suche/wohnungen/kaufen', type: 'sale', propertyType: 'apartment' },
        { name: 'Apartments for Rent', url: 'https://www.immowelt.de/suche/wohnungen/mieten', type: 'rent', propertyType: 'apartment' },
        { name: 'Houses for Sale', url: 'https://www.immowelt.de/suche/haeuser/kaufen', type: 'sale', propertyType: 'house' },
        { name: 'Houses for Rent', url: 'https://www.immowelt.de/suche/haeuser/mieten', type: 'rent', propertyType: 'house' },
        { name: 'Land/Plots for Sale', url: 'https://www.immowelt.de/suche/grundstuecke/kaufen', type: 'sale', propertyType: 'land' },
        // COMMERCIAL
        { name: 'Commercial for Sale', url: 'https://www.immowelt.de/suche/gewerbe/kaufen', type: 'sale', propertyType: 'commercial' },
        { name: 'Commercial for Rent', url: 'https://www.immowelt.de/suche/gewerbe/mieten', type: 'rent', propertyType: 'commercial' },
        { name: 'Offices for Sale', url: 'https://www.immowelt.de/suche/bueros/kaufen', type: 'sale', propertyType: 'office' },
        { name: 'Offices for Rent', url: 'https://www.immowelt.de/suche/bueros/mieten', type: 'rent', propertyType: 'office' },
        { name: 'Warehouses for Sale', url: 'https://www.immowelt.de/suche/hallen/kaufen', type: 'sale', propertyType: 'warehouse' },
        { name: 'Warehouses for Rent', url: 'https://www.immowelt.de/suche/hallen/mieten', type: 'rent', propertyType: 'warehouse' },
        { name: 'Parking for Sale', url: 'https://www.immowelt.de/suche/garagen/kaufen', type: 'sale', propertyType: 'parking' },
        { name: 'Parking for Rent', url: 'https://www.immowelt.de/suche/garagen/mieten', type: 'rent', propertyType: 'parking' },
      ];

      console.log(`\n🌐 Scraping Immonet (via Immowelt.de - AVIV merger)`);
      console.log(`   Max pages per category: ${maxPages === 999999 ? 'unlimited' : maxPages}`);
      console.log(`   Categories: ${categories.length}`);
      console.log(`   Engine: Playwright + UFRN extraction (with DOM fallback)\n`);

      for (const category of categories) {
        const categoryListings = await this.scrapeCategory(category.url, category.name, maxPages, (category as any).fallbackUrl);

        // Add transaction type and property type
        categoryListings.forEach(listing => {
          listing.transactionType = category.type;
          if (!listing.propertyType) {
            listing.propertyType = category.propertyType;
          }
        });

        allListings.push(...categoryListings);

        console.log(`✅ Category complete: ${category.name} - ${categoryListings.length} listings\n`);
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
  async scrapeListingDetails(url: string): Promise<Partial<ImmonetListing> | null> {
    await this.initBrowser();
    // Rotate user agent for each detail request
    const rotatedUserAgent = getRandomUserAgent();
    const context = await createStealthContext(this.browser!, {
      userAgent: rotatedUserAgent,
      viewport: { width: 1920, height: 1080 },
      timeout: this.config.timeout
    });

    try {
      const page = await context.newPage();

      // Rotate headers before request
      await rotateHeadersOnPage(page);

      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: this.config.timeout });
      await waitForNetworkIdle(page, this.config.timeout);

      // Handle consent
      await this.handleConsent(page);

      // Try __NEXT_DATA__ first
      const nextData = await extractNextData(page);
      if (nextData?.props?.pageProps?.expose) {
        const expose = nextData.props.pageProps.expose;
        return this.parseNextDataEntry(expose);
      }

      // Fallback: HTML extraction
      const details = await page.evaluate(() => {
        const title = document.querySelector('h1')?.textContent?.trim() || '';
        const priceEl = document.querySelector('[class*="price"]');
        const priceText = priceEl?.textContent?.trim() || '';
        const description = document.querySelector('[class*="description"]')?.textContent?.trim() || '';

        const features: string[] = [];
        document.querySelectorAll('[class*="feature"], [class*="amenity"]').forEach(el => {
          const text = el.textContent?.trim();
          if (text) features.push(text);
        });

        const images: string[] = [];
        document.querySelectorAll('img[class*="gallery"], img[class*="image"]').forEach(img => {
          const src = img.getAttribute('src') || img.getAttribute('data-src');
          if (src && !src.includes('placeholder')) images.push(src);
        });

        return { title, priceText, description, features, images };
      });

      await page.close();
      await context.close();

      return {
        url,
        title: details.title,
        priceText: details.priceText,
        description: details.description,
        features: details.features,
        images: details.images
      };

    } catch (error: any) {
      console.error(`Error scraping listing details from ${url}:`, error.message);
      await context.close();
      return null;
    }
  }
}
