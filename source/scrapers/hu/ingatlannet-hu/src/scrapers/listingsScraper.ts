import * as cheerio from 'cheerio';
import { IngatlannetListing } from '../types/ingatlannetTypes';
import { getRandomUserAgent } from '../utils/userAgents';
import { fetchWithBrowserTLS, closeCycleTLS } from '../utils/cycleTLS';

/**
 * Ingatlannet.hu Listings Scraper
 * Regional Hungarian portal with focus on Szeged and surrounding areas
 * Uses CycleTLS (browser TLS fingerprinting) to bypass anti-bot protection
 */
export class ListingsScraper {
  private baseUrl = 'https://ingatlannet.hu';

  // Comprehensive Hungarian regions - All 19 counties + major cities (Szeged priority)
  private regions = [
    // Szeged priority (as per original requirement)
    'Szeged',

    // Major cities (highest listing density)
    'Budapest',
    'Debrecen',
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

  /**
   * Scrape all listings from Ingatlannet.hu
   */
  async scrapeAll(maxRegions: number = Infinity, maxPagesPerRegion: number = 100): Promise<IngatlannetListing[]> {
    console.log(JSON.stringify({ level: 'info', service: 'ingatlannet-hu', msg: 'Starting fast scan', maxRegions, maxPagesPerRegion }));
    const allListings: IngatlannetListing[] = [];

    try {
      const regionsToScrape = this.regions.slice(0, maxRegions);

      // Process regions in parallel batches of 10
      for (let i = 0; i < regionsToScrape.length; i += 10) {
        const regionBatch = regionsToScrape.slice(i, i + 10);

        const results = await Promise.allSettled(
          regionBatch.map(async (region) => {
            const listings = await this.scrapeRegion(region, maxPagesPerRegion);
            console.log(JSON.stringify({ level: 'info', service: 'ingatlannet-hu', msg: 'Region scraped', region, count: listings.length }));
            return listings;
          })
        );

        for (const result of results) {
          if (result.status === 'fulfilled') {
            allListings.push(...result.value);
          } else {
            console.error(JSON.stringify({ level: 'error', service: 'ingatlannet-hu', msg: 'Region batch failed', err: result.reason?.message }));
          }
        }

        // Delay between batches
        if (i + 10 < regionsToScrape.length) {
          await this.delay(2000 + Math.random() * 1000);
        }
      }

      console.log(JSON.stringify({ level: 'info', service: 'ingatlannet-hu', msg: 'Fast scan complete', totalListings: allListings.length }));
      return allListings;
    } finally {
      await closeCycleTLS();
    }
  }

  /**
   * Scrape a specific region
   */
  private async scrapeRegion(location: string, maxPages: number = 5): Promise<IngatlannetListing[]> {
    const allListings: IngatlannetListing[] = [];
    let page = 1;

    while (page <= maxPages) {
      try {
        // Build search URL
        // Example: https://ingatlannet.hu/elado-lakas-szeged
        const searchUrl = `${this.baseUrl}/elado-lakas-${encodeURIComponent(location.toLowerCase())}${page > 1 ? `?page=${page}` : ''}`;

        console.log(`    Fetching page ${page}...`);

        // Fetch HTML using CycleTLS (browser TLS fingerprinting)
        const html = await fetchWithBrowserTLS(searchUrl, {
          browser: 'chrome',
          userAgent: getRandomUserAgent()
        });

        // Parse HTML with Cheerio
        const $ = cheerio.load(html) as cheerio.CheerioAPI;

        // Try to extract from JSON-LD first (more reliable)
        const jsonListings = this.extractFromJsonLd($);

        // If JSON-LD extraction worked, use it
        if (jsonListings.length > 0) {
          allListings.push(...jsonListings);
          console.log(`    Page ${page}: ${jsonListings.length} listings (from JSON-LD)`);
        } else {
          // Fallback to HTML extraction
          const htmlListings = this.extractListingsFromHTML($);
          allListings.push(...htmlListings);
          console.log(`    Page ${page}: ${htmlListings.length} listings (from HTML)`);
        }

        if (jsonListings.length === 0 && allListings.length === 0) {
          console.log(`    No more listings found on page ${page}`);
          break;
        }

        // Check for next page
        const hasNextPage = this.checkForNextPage($, page);
        if (!hasNextPage) {
          break;
        }

        page++;

        // Reduced delay (speed optimized)
        await this.delay(1000 + Math.random() * 1000); // 1-2 seconds
      } catch (error: any) {
        console.error(`    Error on page ${page}:`, error.message);
        break;
      }
    }

    return allListings;
  }

  /**
   * Extract listings from JSON-LD structured data
   * Ingatlannet.hu uses schema.org ItemList format
   */
  private extractFromJsonLd($: cheerio.CheerioAPI): IngatlannetListing[] {
    const listings: IngatlannetListing[] = [];

    try {
      // Find JSON-LD script tags
      $('script[type="application/ld+json"]').each((index, element) => {
        try {
          const jsonText = $(element).html();
          if (!jsonText) return;

          const jsonData = JSON.parse(jsonText);

          // Check if it's an ItemList with property listings
          if (jsonData['@type'] === 'ItemList' && jsonData.itemListElement) {
            jsonData.itemListElement.forEach((item: any) => {
              try {
                const listing = this.parseJsonLdItem(item);
                if (listing) {
                  listings.push(listing);
                }
              } catch (error: any) {
                console.error(`    Error parsing JSON-LD item:`, error.message);
              }
            });
          }
        } catch (error: any) {
          console.error(`    Error parsing JSON-LD script:`, error.message);
        }
      });
    } catch (error: any) {
      console.error(`    Error extracting JSON-LD:`, error.message);
    }

    return listings;
  }

  /**
   * Parse a single JSON-LD item into a listing
   */
  private parseJsonLdItem(item: any): IngatlannetListing | null {
    try {
      const data = item.item || item;

      // Extract ID from URL
      const url = data.url || data.absolutUrl || '';
      const idMatch = url.match(/\/(\d+)$/);
      const id = idMatch ? idMatch[1] : `ingatlannet-${Date.now()}-${Math.random()}`;

      // Parse price (handle "M Ft" format)
      let price = 0;
      if (data.price) {
        const priceStr = String(data.price).replace(/\s/g, '');
        if (priceStr.includes('M')) {
          // Million format: "61MFt" -> 61000000
          price = parseFloat(priceStr.replace(/M|Ft/gi, '')) * 1000000;
        } else {
          price = parseFloat(priceStr.replace(/Ft/gi, ''));
        }
      }

      // Parse area
      const area = data.alapterulet || data.area || undefined;

      // Parse rooms
      const rooms = data.szoba || data.rooms || undefined;

      // Build listing
      const listing: IngatlannetListing = {
        id,
        title: data.name || data.title || 'Untitled',
        price,
        currency: 'HUF',
        location: data.telepules || data.city || '',
        propertyType: this.extractPropertyType(url, data.ingatlanTipus || ''),
        transactionType: this.extractTransactionType(url),
        url: url.startsWith('http') ? url : `${this.baseUrl}${url}`,

        city: data.telepules || data.city,
        district: data.kerulet || data.district,
        address: data.cim || data.address,

        area: area ? parseInt(area) : undefined,
        rooms: rooms ? parseInt(rooms) : undefined,
        floor: data.emelet || data.floor,
        totalFloors: data.epuletEmeletszam || data.totalFloors,

        condition: data.allapot || data.condition,
        conditionRating: data.allapotPont || data.conditionRating,
        heating: data.futes || data.heating,
        constructionType: data.epuletTipus || data.constructionType,
        buildYear: data.epitesEv || data.buildYear,

        parking: data.parkolohely === 'yes' || data.parking === true || data.parking === 'yes',
        elevator: data.lift === 'yes' || data.elevator === true || data.elevator === 'yes',
        balcony: data.erkely === 'yes' || data.balcony === true || data.balcony === 'yes',

        imageCount: data.fotoDb || data.imageCount,
        images: data.images || [],

        description: data.description || data.leiras,

        publishedDate: data.hirdetesKezdet || data.publishedDate,
        modifiedDate: data.modositva || data.modifiedDate,

        rawData: data
      };

      return listing;
    } catch (error: any) {
      console.error(`    Error parsing JSON-LD item:`, error.message);
      return null;
    }
  }

  /**
   * Extract listings from HTML (fallback method)
   */
  private extractListingsFromHTML($: cheerio.CheerioAPI): IngatlannetListing[] {
    const listings: IngatlannetListing[] = [];

    // Common selectors for ingatlannet.hu
    const selectors = [
      'a[href*="/elado-"], a[href*="/kiado-"]',
      '.listing',
      '.property-card',
      'article',
      '[class*="estate"]'
    ];

    let listingElements: any = null;

    for (const selector of selectors) {
      const elements = $(selector);
      if (elements.length > 0) {
        listingElements = elements;
        console.log(`    Found ${elements.length} listings with selector: ${selector}`);
        break;
      }
    }

    if (!listingElements || listingElements.length === 0) {
      console.log('    No listings found on page');
      return listings;
    }

    // Extract data from each listing
    listingElements.each((index: number, element: any) => {
      try {
        const $el = $(element);

        // Extract URL
        let url = $el.attr('href') || $el.find('a').first().attr('href');
        if (!url || !url.includes('/elado-') && !url.includes('/kiado-')) {
          return; // Skip if no valid URL
        }

        // Make URL absolute
        url = url.startsWith('http') ? url : `${this.baseUrl}${url}`;

        // Extract ID from URL
        const idMatch = url.match(/\/(\d+)$/);
        const id = idMatch ? idMatch[1] : `ingatlannet-${Date.now()}-${index}`;

        // Extract title
        const title = $el.text().trim().split('\n')[0] || 'Untitled';

        // Extract price
        const text = $el.text();
        const priceMatch = text.match(/(\d+(?:\s*\d+)*)\s*M?\s*Ft/i);
        let price = 0;
        if (priceMatch) {
          const priceStr = priceMatch[1].replace(/\s/g, '');
          price = text.includes('M') ? parseFloat(priceStr) * 1000000 : parseFloat(priceStr);
        }

        // Extract area
        const areaMatch = text.match(/(\d+)\s*m[²2]/i);
        const area = areaMatch ? parseInt(areaMatch[1]) : undefined;

        // Extract rooms
        const roomsMatch = text.match(/(\d+)\s*szoba/i);
        const rooms = roomsMatch ? parseInt(roomsMatch[1]) : undefined;

        // Extract location
        const locationMatch = text.match(/(?:Budapest|Szeged|Debrecen|Miskolc|Pécs|Győr)[^,\n]*/i);
        const location = locationMatch ? locationMatch[0].trim() : '';

        const listing: IngatlannetListing = {
          id,
          title,
          price,
          currency: 'HUF',
          location,
          propertyType: this.extractPropertyType(url, text),
          transactionType: this.extractTransactionType(url),
          url,
          area,
          rooms
        };

        listings.push(listing);
      } catch (error: any) {
        console.error(`    Error extracting listing ${index}:`, error.message);
      }
    });

    return listings;
  }

  /**
   * Extract property type from URL or text
   */
  private extractPropertyType(url: string, text: string): string {
    const lowerUrl = url.toLowerCase();
    const lowerText = text.toLowerCase();

    if (lowerUrl.includes('/lakas') || lowerText.includes('lakás')) return 'lakás';
    if (lowerUrl.includes('/haz') || lowerUrl.includes('/ház') || lowerText.includes('ház')) return 'ház';
    if (lowerUrl.includes('/telek') || lowerText.includes('telek')) return 'telek';
    if (lowerUrl.includes('/garazs') || lowerUrl.includes('/garázs')) return 'garázs';
    if (lowerUrl.includes('/iroda') || lowerText.includes('iroda')) return 'iroda';

    return 'egyéb';
  }

  /**
   * Extract transaction type from URL
   */
  private extractTransactionType(url: string): string {
    const lowerUrl = url.toLowerCase();

    if (lowerUrl.includes('/kiado') || lowerUrl.includes('/kiadó')) return 'kiadó';
    if (lowerUrl.includes('/elado') || lowerUrl.includes('/eladó')) return 'eladó';

    return 'eladó'; // Default to sale
  }

  /**
   * Check if there's a next page
   */
  private checkForNextPage($: cheerio.CheerioAPI, currentPage: number): boolean {
    // Look for pagination indicators
    const nextLink = $('a[rel="next"]').length > 0;
    const nextButton = $('a:contains("következő"), a:contains("next"), [class*="next"]').length > 0;

    // Check for page numbers
    const pageLinks = $('a[href*="page="]');
    let maxPage = currentPage;
    pageLinks.each((i, el) => {
      const href = $(el).attr('href') || '';
      const pageMatch = href.match(/page=(\d+)/);
      if (pageMatch) {
        maxPage = Math.max(maxPage, parseInt(pageMatch[1]));
      }
    });

    return nextLink || nextButton || maxPage > currentPage;
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
