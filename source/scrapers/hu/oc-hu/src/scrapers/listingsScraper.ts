import * as cheerio from 'cheerio';
import { OcListing, OcSearchParams } from '../types/ocTypes';
import { getRandomUserAgent } from '../utils/userAgents';
import { fetchWithBrowserTLS, closeCycleTLS } from '../utils/cycleTLS';

/**
 * Otthon Centrum (oc.hu) Listings Scraper
 * Scrapes property listings from Hungary's #1 real estate portal by traffic
 *
 * Implementation: DataLayer extraction from server-rendered HTML
 * - Fetches HTML with CycleTLS (bypasses anti-bot)
 * - Extracts window.dataLayer.push() containing ecommerce.items
 * - Maps 12 properties per page to OcListing type
 *
 * Limitations:
 * - DataLayer only contains basic fields (ID, price, location, type, area)
 * - No images, descriptions, or agent info
 * - Can't use region-specific URLs with CycleTLS
 *
 * TODO - Future Enhancements:
 * 1. Add detail page scraping for full property data (images, description, agent)
 * 2. Consider Playwright fallback for region-specific scraping
 * 3. Add retry logic for failed pages
 * 4. Implement incremental scraping (only new/updated listings)
 */
export class ListingsScraper {
  private baseUrl = 'https://oc.hu';

  /**
   * Scrape all listings from OC.hu
   * NOTE: Due to CycleTLS limitations with complex URLs, we scrape ALL listings
   * from the basic URL and deduplicate. Region filtering would require Playwright.
   */
  async scrapeAll(maxRegions: number = Infinity, maxPagesPerRegion: number = 100): Promise<OcListing[]> {
    console.log(`Starting OC.hu scrape (CycleTLS + DataLayer mode)...`);
    console.log(`⚠️  Note: Scraping all listings (region URLs don't work with CycleTLS)`);

    const allListings: OcListing[] = [];
    const seenIds = new Set<string>();

    try {
      // Scrape all listings using basic URL
      const listings = await this.scrapeAllPages(maxPagesPerRegion);

      // Deduplicate by ID
      for (const listing of listings) {
        if (!seenIds.has(listing.id)) {
          seenIds.add(listing.id);
          allListings.push(listing);
        }
      }

      console.log(`✅ Total unique listings scraped: ${allListings.length}`);
    } finally {
      // Cleanup CycleTLS instance
      await closeCycleTLS();
    }

    return allListings;
  }

  /**
   * Scrape all pages from the basic listing URL
   */
  private async scrapeAllPages(maxPages: number = 100): Promise<OcListing[]> {
    const allListings: OcListing[] = [];
    let page = 1;

    while (page <= maxPages) {
      try {
        // Use basic listing URL
        const searchUrl = page > 1
          ? `${this.baseUrl}/ingatlanok/lista/ertekesites:elado?page=${page}`
          : `${this.baseUrl}/ingatlanok/lista/ertekesites:elado`;

        console.log(`Fetching page ${page}...`);

        // Fetch HTML page with CycleTLS
        const html = await fetchWithBrowserTLS(searchUrl, {
          browser: 'chrome',
          userAgent: getRandomUserAgent()
        });

        // Parse HTML with Cheerio
        const $ = cheerio.load(html) as cheerio.CheerioAPI;

        // Extract listings from dataLayer
        const listings = this.extractListingsFromDataLayer($);

        if (listings.length === 0) {
          console.log(`No more listings found on page ${page}`);
          break;
        }

        allListings.push(...listings);
        console.log(`  Page ${page}: ${listings.length} listings`);

        // Check for next page
        const hasNextPage = $('a[rel="next"]').length > 0 ||
                           $('.pagination .next').length > 0 ||
                           $('[class*="next"]').length > 0;

        if (!hasNextPage) {
          console.log(`No next page found, stopping at page ${page}`);
          break;
        }

        page++;

        // Delay between pages
        await this.delay(2000 + Math.random() * 1000); // 2-3 seconds
      } catch (error: any) {
        console.error(`Error on page ${page}:`, error.message);
        break;
      }
    }

    return allListings;
  }


  /**
   * Extract listings from window.dataLayer embedded in HTML
   * OC.hu embeds property data in window.dataLayer.push() for analytics
   *
   * TODO: This extracts basic listing data (12 properties per page).
   * For full details (description, images, agent info, etc.),
   * would need to scrape individual property detail pages.
   */
  private extractListingsFromDataLayer($: cheerio.CheerioAPI): OcListing[] {
    const listings: OcListing[] = [];

    try {
      // Find script tag containing window.dataLayer.push
      const scripts = $('script:not([src])');
      let dataLayerScript = '';

      scripts.each((i, script) => {
        const scriptText = $(script).html() || '';
        if (scriptText.includes('window.dataLayer.push') &&
            scriptText.includes('ecommerce') &&
            scriptText.includes('items')) {
          dataLayerScript = scriptText;
          return false; // break
        }
      });

      if (!dataLayerScript) {
        console.log('    ⚠️  No dataLayer script found on page');
        return listings;
      }

      // Extract the JSON from window.dataLayer.push()
      const matchResult = dataLayerScript.match(/window\.dataLayer\.push\((.*?)\);/s);
      if (!matchResult || !matchResult[1]) {
        console.log('    ⚠️  Could not extract dataLayer content');
        return listings;
      }

      let jsonStr = matchResult[1].trim();

      // Replace JavaScript unicode escapes with actual characters
      jsonStr = jsonStr.replace(/\\u([0-9a-fA-F]{4})/g, (_match: string, hex: string) =>
        String.fromCharCode(parseInt(hex, 16))
      );

      // Parse the dataLayer object
      let dataLayerData: any = null;

      try {
        // Try JSON.parse first (if it's valid JSON)
        dataLayerData = JSON.parse(jsonStr);
      } catch (e1) {
        // If JSON.parse fails, use Function constructor (safer than eval)
        try {
          const fn = new Function('return ' + jsonStr);
          dataLayerData = fn();
        } catch (e2: any) {
          console.log(`    ⚠️  Failed to parse dataLayer: ${e2.message}`);
          return listings;
        }
      }

      // Extract items from ecommerce.items
      const items = dataLayerData?.ecommerce?.items || [];
      if (items.length === 0) {
        console.log('    ⚠️  No items found in dataLayer');
        return listings;
      }

      // Map dataLayer items to OcListing type
      for (const item of items) {
        try {
          const listing: OcListing = {
            id: item.item_id || `oc-${Date.now()}-${Math.random()}`,
            title: item.item_name || item.item_id || 'Untitled',
            price: item.price || 0,
            currency: item.currency || 'HUF',
            location: item.location_city || '',
            city: item.location_city || undefined,
            district: item.location_district || undefined,
            address: item.location_street || undefined,
            propertyType: this.mapPropertyType(item.real_estate_type),
            transactionType: this.mapTransactionType(item.type_of_sale),
            url: `${this.baseUrl}/ingatlanok/${item.item_id}`, // Construct URL from ID
            area: item.size || undefined,
          };

          listings.push(listing);
        } catch (error: any) {
          console.error(`    Error mapping dataLayer item:`, error.message);
        }
      }

    } catch (error: any) {
      console.error(`    Error extracting dataLayer:`, error.message);
    }

    return listings;
  }

  /**
   * Map dataLayer property type to standard format
   */
  private mapPropertyType(type: string | undefined): string {
    if (!type) return 'egyéb';

    const lowerType = type.toLowerCase();

    if (lowerType.includes('lakás') || lowerType === 'lakás') return 'lakás';
    if (lowerType.includes('ház') || lowerType === 'ház') return 'ház';
    if (lowerType.includes('telek')) return 'telek';
    if (lowerType.includes('garázs')) return 'garázs';
    if (lowerType.includes('iroda')) return 'iroda';
    if (lowerType.includes('kereskedelmi') || lowerType.includes('üzlet')) return 'üzlet';
    if (lowerType.includes('nyaraló')) return 'nyaraló';

    return type; // Return as-is if no mapping found
  }

  /**
   * Map dataLayer transaction type to standard format
   */
  private mapTransactionType(type: string | undefined): string {
    if (!type) return 'eladó';

    const lowerType = type.toLowerCase();

    if (lowerType.includes('kiadó') || lowerType === 'kiadó') return 'kiadó';
    if (lowerType.includes('eladó') || lowerType === 'eladó' || lowerType.includes('használt')) return 'eladó';

    return 'eladó'; // Default to sale
  }


  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
