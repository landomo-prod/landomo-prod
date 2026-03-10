import { DHListing, DHSearchParams } from '../types/dhTypes';
import { getRandomUserAgent } from '../utils/userAgents';
import { fetchWithBrowserTLS, closeCycleTLS } from '../utils/cycleTLS';

/**
 * Duna House (dh.hu) Listings Scraper
 * Uses DH.hu's hidden API endpoint for efficient data retrieval
 */
export class ListingsScraper {
  private baseUrl = 'https://dh.hu';

  // Comprehensive Hungarian regions - All 19 counties + major cities
  private regions = [
    // Major cities (Priority - highest listing density)
    'budapest',
    'debrecen',
    'szeged',
    'miskolc',
    'pecs',
    'gyor',
    'nyiregyhaza',
    'kecskemet',
    'szekesfehervar',
    'szombathely',

    // Regional capitals and large cities
    'eger',
    'veszprem',
    'tatabanya',
    'sopron',
    'kaposvar',
    'zalaegerszeg',
    'szolnok',
    'erd',
    'dunaujvaros',
    'hodmezovasarhely',
    'szekszard',
    'salgotarjan',
    'nagykanizsa',
    'bekescsaba',

    // County regions (for broader coverage)
    'pest-megye',
    'bacs-kiskun-megye',
    'baranya-megye',
    'borsod-abauj-zemplen-megye',
    'csongrad-csanad-megye',
    'fejer-megye',
    'gyor-moson-sopron-megye',
    'hajdu-bihar-megye',
    'heves-megye',
    'jasz-nagykun-szolnok-megye',
    'komarom-esztergom-megye',
    'nograd-megye',
    'somogy-megye',
    'szabolcs-szatmar-bereg-megye',
    'tolna-megye',
    'vas-megye',
    'veszprem-megye',
    'zala-megye'
  ];

  /**
   * Scrape all listings from Duna House using parallel region scanning
   */
  async scrapeAll(maxRegions: number = Infinity, maxPagesPerRegion: number = 100): Promise<DHListing[]> {
    console.log(JSON.stringify({ level: 'info', service: 'dh-hu', msg: 'Fast scan starting (CycleTLS mode)' }));
    const allListings: DHListing[] = [];

    try {
      const regionsToScrape = this.regions.slice(0, maxRegions);

      // Process regions in parallel batches of 5 to avoid overwhelming the API
      const PARALLEL_BATCH = 5;
      for (let i = 0; i < regionsToScrape.length; i += PARALLEL_BATCH) {
        const regionBatch = regionsToScrape.slice(i, i + PARALLEL_BATCH);

        const results = await Promise.allSettled(
          regionBatch.map(async (region) => {
            const saleListings = await this.scrapeRegion(region, 'elado', maxPagesPerRegion);
            const rentListings = await this.scrapeRegion(region, 'kiado', maxPagesPerRegion);
            console.log(JSON.stringify({ level: 'info', service: 'dh-hu', msg: 'Region scraped', region, sale: saleListings.length, rent: rentListings.length }));
            return [...saleListings, ...rentListings];
          })
        );

        for (const result of results) {
          if (result.status === 'fulfilled') {
            allListings.push(...result.value);
          } else {
            console.error(JSON.stringify({ level: 'error', service: 'dh-hu', msg: 'Region batch failed', err: result.reason?.message }));
          }
        }

        // Delay between batches
        if (i + PARALLEL_BATCH < regionsToScrape.length) {
          await this.delay(1000 + Math.random() * 1000);
        }
      }

      console.log(JSON.stringify({ level: 'info', service: 'dh-hu', msg: 'Fast scan complete', totalListings: allListings.length }));
    } finally {
      await closeCycleTLS();
    }

    return allListings;
  }

  /**
   * Scrape a specific region and transaction type using DH.hu API
   */
  private async scrapeRegion(location: string, transactionType: 'elado' | 'kiado', maxPages: number = 5): Promise<DHListing[]> {
    const allListings: DHListing[] = [];
    let page = 1;

    while (page <= maxPages) {
      try {
        // Build URL path for form-data
        const propertyTypes = 'lakas-haz'; // apartments and houses
        const urlPath = `/${transactionType}-ingatlan/${propertyTypes}/${location}`;

        console.log(`    Fetching ${transactionType} page ${page}...`);

        // Fetch from API endpoint
        const listings = await this.fetchFromAPI(urlPath, page, transactionType);

        if (listings.length === 0) {
          console.log(`    No more listings found on page ${page}`);
          break;
        }

        allListings.push(...listings);
        console.log(`    Page ${page}: ${listings.length} listings`);

        // DH API returns 16 items per page
        // If we get less than 16, we've reached the last page
        if (listings.length < 16) {
          console.log(`    Last page reached (${listings.length} < 16 items)`);
          break;
        }

        page++;

        // Delay between pages
        await this.delay(1000 + Math.random() * 1000); // 1-2 seconds
      } catch (error: any) {
        console.error(`    Error on page ${page}:`, error.message);
        break;
      }
    }

    return allListings;
  }

  /**
   * Fetch listings from DH.hu API endpoint
   */
  private async fetchFromAPI(urlPath: string, page: number, transactionType: string): Promise<DHListing[]> {
    const apiUrl = `https://newdhapi01.dh.hu/api/getProperties?page=${page}`;

    // Generate random boundary for multipart form-data
    const boundary = `----WebKitFormBoundary${this.generateRandomString(16)}`;

    // Build multipart form-data body
    const formData = [
      `--${boundary}`,
      `Content-Disposition: form-data; name="url"`,
      ``,
      urlPath,
      `--${boundary}--`,
      ``
    ].join('\r\n');

    // Fetch with CycleTLS
    const response = await fetchWithBrowserTLS(apiUrl, {
      method: 'POST',
      browser: 'chrome',
      userAgent: getRandomUserAgent(),
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Accept': 'application/json, text/plain, */*',
        'Origin': 'https://dh.hu',
        'Referer': `https://dh.hu${urlPath}`,
        'Accept-Language': 'hu-HU,hu;q=0.9,en;q=0.8',
      },
      body: formData
    });

    // Parse JSON response
    let data: any;
    try {
      data = JSON.parse(response);
    } catch (error: any) {
      console.error(`    Failed to parse JSON response:`, error.message);
      console.error(`    Response preview:`, response.substring(0, 500));
      return [];
    }

    // Validate response structure
    if (!data.result || !Array.isArray(data.result.items)) {
      console.error(`    Unexpected API response structure:`, Object.keys(data));
      return [];
    }

    const items = data.result.items;
    console.log(`    API returned ${items.length} items`);

    // Map API items to DHListing format
    const listings: DHListing[] = [];
    for (const item of items) {
      try {
        const listing = this.mapApiItemToListing(item, transactionType);
        if (listing) {
          listings.push(listing);
        }
      } catch (error: any) {
        console.error(`    Error mapping API item:`, error.message);
      }
    }

    return listings;
  }

  /**
   * Map API response item to DHListing
   */
  private mapApiItemToListing(item: any, transactionType: string): DHListing | null {
    try {
      if (!item || !item.referenceNumber) {
        return null;
      }

      // Extract basic info
      const referenceNumber = item.referenceNumber;
      const id = `dh-${referenceNumber}`;

      // Build URL from alias
      const url = item.alias ? `https://dh.hu${item.alias}` : `https://dh.hu/ingatlan/${referenceNumber}`;

      // Parse price
      const priceNumeric = item.combined_targetPrice ? parseFloat(item.combined_targetPrice) : 0;
      const currency = item.combined_targetPriceCurrency_text || 'HUF';

      // Build address/location
      const address = item.address || '';
      const cityName = item.cityName || '';
      const districtName = item.districtName || '';
      const location = address || `${cityName}${districtName ? ' ' + districtName + '. kerület' : ''}`;

      // Property details
      const propertyTypeName = item.propertyTypeName || '';
      const propertyType = this.normalizePropertyType(propertyTypeName);
      const area = item.area ? parseInt(item.area) : undefined;
      const rooms = item.rooms ? parseInt(item.rooms) : undefined;

      // Coordinates
      const coordinates = (item.lat && item.lng) ? {
        lat: parseFloat(item.lat),
        lon: parseFloat(item.lng)
      } : undefined;

      // Extract images
      const images: string[] = [];
      if (item.coverImage) {
        images.push(item.coverImage);
      }
      if (Array.isArray(item.images)) {
        images.push(...item.images.filter((img: string) => img && !images.includes(img)));
      }

      // Build title from property type and location
      const title = `${propertyTypeName || 'Ingatlan'} ${transactionType === 'elado' ? 'eladó' : 'kiadó'} - ${cityName || location}`;

      return {
        id,
        referenceNumber,
        title,
        price: priceNumeric,
        priceNumeric,
        currency,
        location,
        address,
        city: cityName,
        district: districtName,
        propertyType,
        propertyTypeName,
        transactionType,
        url,
        area,
        rooms,
        coordinates,
        images: images.length > 0 ? images : undefined,
        description: item.description || undefined,
        agent: item.agentName ? {
          name: item.agentName,
          company: 'Duna House'
        } : undefined,
        isNew: item.isNew || item.newly || item.isNewly || false,
        isComingSoon: item.isComingSoon || false,
        isExclusive: item.isExclusive || false,
        enabledOtthonStart: item.enabledOtthonStart || false,
        rawData: item
      };
    } catch (error: any) {
      console.error(`    Error mapping item:`, error.message);
      return null;
    }
  }

  /**
   * Generate random string for form boundary
   */
  private generateRandomString(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }


  /**
   * Normalize property type to standard format
   */
  private normalizePropertyType(propertyType: string): string {
    if (!propertyType) return 'egyéb';

    const lower = propertyType.toLowerCase().trim();

    if (lower.includes('lakás') || lower.includes('lakas')) return 'lakás';
    if (lower.includes('ház') || lower.includes('haz')) return 'ház';
    if (lower.includes('telek')) return 'telek';
    if (lower.includes('garázs') || lower.includes('garazs')) return 'garázs';
    if (lower.includes('iroda')) return 'iroda';
    if (lower.includes('üzlet') || lower.includes('uzlet')) return 'üzlet';

    return 'egyéb';
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
