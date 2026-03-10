import { ZengaListing, ZengaSearchParams } from '../types/zengaTypes';
import { getRandomUserAgent } from '../utils/userAgents';
import { fetchWithBrowserTLS, closeCycleTLS } from '../utils/cycleTLS';

const log = (level: string, msg: string, extra: Record<string, any> = {}) =>
  console.log(JSON.stringify({ level, service: 'zenga-hu', msg, ...extra }));

/**
 * Zenga.hu Listings Scraper
 * Uses REST API endpoint: POST https://www.zenga.hu/api/rels/v1/adverts/search
 * AI-enhanced Hungarian real estate portal with modern Angular architecture
 */
export class ListingsScraper {
  private baseUrl = 'https://zenga.hu';

  // Comprehensive Hungarian regions - All 19 counties + major cities
  private regions = [
    // Major cities (Priority - highest listing density)
    'Budapest',
    'Debrecen',
    'Szeged',
    'Miskolc',
    'Pécs',
    'Győr',
    'Nyíregyháza',
    'Kecskemét',
    'Székesfehérvár',
    'Szombathely',

    // Regional capitals and large cities
    'Eger',
    'Veszprém',
    'Tatabánya',
    'Sopron',
    'Kaposvár',
    'Zalaegerszeg',
    'Szolnok',
    'Érd',
    'Dunaújváros',
    'Hódmezővásárhely',
    'Szekszárd',
    'Salgótarján',
    'Nagykanizsa',
    'Békéscsaba',

    // County regions (for broader coverage)
    'Pest megye',
    'Bács-Kiskun megye',
    'Baranya megye',
    'Borsod-Abaúj-Zemplén megye',
    'Csongrád-Csanád megye',
    'Fejér megye',
    'Győr-Moson-Sopron megye',
    'Hajdú-Bihar megye',
    'Heves megye',
    'Jász-Nagykun-Szolnok megye',
    'Komárom-Esztergom megye',
    'Nógrád megye',
    'Somogy megye',
    'Szabolcs-Szatmár-Bereg megye',
    'Tolna megye',
    'Vas megye',
    'Veszprém megye',
    'Zala megye'
  ];

  constructor() {}

  getRegionCount(): number {
    return this.regions.length;
  }

  /**
   * Scrape all listings from Zenga.hu
   */
  async scrapeAll(maxRegions: number = Infinity, maxPagesPerRegion: number = 100): Promise<ZengaListing[]> {
    log('info', 'Starting Zenga.hu scrape (CycleTLS mode)');
    const allListings: ZengaListing[] = [];

    try {
      const regionsToScrape = this.regions.slice(0, maxRegions);

      for (const region of regionsToScrape) {
        log('info', 'Scraping region', { region });

        try {
          const listings = await this.scrapeRegionWeb(region, maxPagesPerRegion);
          allListings.push(...listings);
          log('info', 'Region scraped', { region, count: listings.length });

          // Delay between regions
          await this.delay(1000 + Math.random() * 1000);
        } catch (error: any) {
          log('error', 'Failed to scrape region', { region, err: error.message });
        }
      }

      log('info', 'Total listings scraped', { count: allListings.length });
    } finally {
      // Cleanup CycleTLS instance
      await closeCycleTLS();
    }

    return allListings;
  }

  /**
   * Scrape a specific region using REST API
   * Zenga.hu API endpoint: POST https://www.zenga.hu/api/rels/v1/adverts/search
   */
  private async scrapeRegionWeb(location: string, maxPages: number = 5): Promise<ZengaListing[]> {
    const allListings: ZengaListing[] = [];
    let page = 1;

    // Build textSearch parameter (location+transaction+type)
    const textSearch = this.buildTextSearch(location, 'elado', 'lakas');
    const apiUrl = 'https://www.zenga.hu/api/rels/v1/adverts/search';

    while (page <= maxPages) {
      try {
        log('info', 'Fetching page', { page });

        // Build API request payload
        const payload = {
          pageSize: 20,
          page: page,
          agency: null,
          textSearch: textSearch,
          searchObject: {}
        };

        // Make API request with CycleTLS
        const responseBody = await fetchWithBrowserTLS(apiUrl, {
          browser: 'chrome',
          method: 'POST',
          body: JSON.stringify(payload),
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/plain, */*',
            'Origin': 'https://www.zenga.hu',
            'Referer': `https://www.zenga.hu/${textSearch}`
          },
          userAgent: getRandomUserAgent()
        });

        // Parse JSON response
        const data = JSON.parse(responseBody);

        // Check if we have results
        if (!data.result || !data.result.items || data.result.items.length === 0) {
          log('info', 'No more listings on page', { page });
          break;
        }

        // Extract listings from API response
        const listings = this.extractListingsFromAPI(data.result.items);
        allListings.push(...listings);
        log('info', 'Page fetched', { page, count: listings.length });

        // Check if we've reached the last page
        const totalPages = data.result.totalPage || 0;
        if (page >= totalPages || page >= maxPages) {
          break;
        }

        page++;

        // Delay between pages
        await this.delay(1000 + Math.random() * 1000); // 1-2 seconds
      } catch (error: any) {
        log('error', 'Error on page', { page, err: error.message });
        break;
      }
    }

    return allListings;
  }

  /**
   * Build textSearch parameter for API request
   * Format: {location}+{transaction}+{type}
   * Example: budapest+elado+lakas
   */
  private buildTextSearch(location: string, transaction: string, propertyType: string): string {
    return `${location.toLowerCase()}+${transaction}+${propertyType}`;
  }

  /**
   * Extract listings from API response
   * Maps API fields to ZengaListing type
   */
  private extractListingsFromAPI(items: any[]): ZengaListing[] {
    const listings: ZengaListing[] = [];

    for (const item of items) {
      try {
        // Build property URL from urlSlug
        const url = `https://www.zenga.hu/i/${item.urlSlug}`;

        // Map API fields to ZengaListing
        const listing: ZengaListing = {
          id: String(item.advertId || ''),
          title: item.advertTitle || '',
          price: item.price || 0,
          currency: item.currency || 'HUF',
          location: item.address || '',
          propertyType: this.mapPropertyCategory(item.propertyCategory, item.type),
          transactionType: this.mapSaleType(item.saleType),
          url,

          // Location details
          city: item.address || '',
          district: '', // Not available in basic API response

          // Property details
          area: item.floorAreaSize || undefined,
          rooms: item.numberOfRooms || undefined,
          halfRooms: item.numberOfHalfRooms || undefined,
          floor: item.floor || undefined,
          totalFloors: item.buildingLevels || undefined,

          // Property characteristics
          energyRating: item.energyRating || undefined,
          buildYear: undefined, // Not in basic response

          // Additional features
          balcony: (item.balconySize && item.balconySize > 0) || undefined,

          // Financial
          pricePerSqm: item.pricePerSquareMeter || undefined,

          // Media
          images: item.thumbnails || [],
          description: undefined, // Not in search results

          // Metadata
          publishedDate: item.createDate || undefined,
          modifiedDate: item.modificationDate || undefined,
          isPremier: item.premier || false,

          // Raw data
          rawData: item
        };

        listings.push(listing);
      } catch (error: any) {
        log('error', 'Error extracting listing', { advertId: item.advertId, err: error.message });
      }
    }

    return listings;
  }

  /**
   * Map API property category to Hungarian property type
   */
  private mapPropertyCategory(category: string, type: number): string {
    if (category === 'FLAT' || category === 'lakas') return 'lakás';
    if (category === 'HOUSE' || category === 'haz') return 'ház';
    if (category === 'LAND' || category === 'telek') return 'telek';
    if (category === 'GARAGE' || category === 'garazs') return 'garázs';
    if (category === 'OFFICE' || category === 'iroda') return 'iroda';
    if (category === 'COMMERCIAL' || category === 'uzlet') return 'üzlet';
    return 'egyéb';
  }

  /**
   * Map API sale type to Hungarian transaction type
   */
  private mapSaleType(saleType: string): string {
    if (saleType === 'SALE' || saleType === 'elado') return 'eladó';
    if (saleType === 'RENT' || saleType === 'kiado') return 'kiadó';
    return 'eladó'; // Default to sale
  }



  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
