import * as cheerio from 'cheerio';
import { IngatlanListing } from '../types/ingatlanTypes';
import { getRandomUserAgent } from '../utils/userAgents';
import { fetchWithBrowserTLS, closeCycleTLS } from '../utils/cycleTLS';

const REGION_CONCURRENCY = parseInt(process.env.REGION_CONCURRENCY || '10');

/**
 * Ingatlan.com Listings Scraper
 * Uses CycleTLS (browser TLS fingerprinting) to bypass Cloudflare protection
 *
 * Fast scanner mode: extracts all available data from listing pages
 * (ingatlan.com has no separate detail endpoint - all data is on listing pages)
 */
export class ListingsScraper {
  private baseUrl = 'https://ingatlan.com';
  private regions = [
    // Major cities (Priority - highest listing density)
    'Budapest', 'Debrecen', 'Szeged', 'Miskolc', 'Pécs',
    'Győr', 'Nyíregyháza', 'Kecskemét', 'Székesfehérvár', 'Szombathely',
    // Regional capitals and large cities
    'Eger', 'Veszprém', 'Tatabánya', 'Sopron', 'Kaposvár',
    'Zalaegerszeg', 'Szolnok', 'Érd', 'Dunaújváros', 'Hódmezővásárhely',
    'Szekszárd', 'Salgótarján', 'Nagykanizsa', 'Békéscsaba',
    // County regions (for broader coverage)
    'Pest megye', 'Bács-Kiskun megye', 'Baranya megye',
    'Borsod-Abaúj-Zemplén megye', 'Csongrád-Csanád megye', 'Fejér megye',
    'Győr-Moson-Sopron megye', 'Hajdú-Bihar megye', 'Heves megye',
    'Jász-Nagykun-Szolnok megye', 'Komárom-Esztergom megye', 'Nógrád megye',
    'Somogy megye', 'Szabolcs-Szatmár-Bereg megye', 'Tolna megye',
    'Vas megye', 'Veszprém megye', 'Zala megye'
  ];

  getRegionCount(): number {
    return this.regions.length;
  }

  async close(): Promise<void> {
    await closeCycleTLS();
  }

  /**
   * Scrape all listings with parallel region scanning
   */
  async scrapeAll(maxRegions: number = Infinity, maxPagesPerRegion: number = 100): Promise<IngatlanListing[]> {
    console.log(JSON.stringify({ level: 'info', service: 'ingatlan-com', msg: 'Starting fast scan', regionConcurrency: REGION_CONCURRENCY }));
    const allListings: IngatlanListing[] = [];

    try {
      const regionsToScrape = this.regions.slice(0, maxRegions);

      // Process regions in parallel batches
      for (let i = 0; i < regionsToScrape.length; i += REGION_CONCURRENCY) {
        const batch = regionsToScrape.slice(i, i + REGION_CONCURRENCY);

        const results = await Promise.allSettled(
          batch.map(region => this.scrapeRegion(region, maxPagesPerRegion))
        );

        for (let j = 0; j < results.length; j++) {
          const result = results[j];
          const region = batch[j];
          if (result.status === 'fulfilled') {
            allListings.push(...result.value);
            console.log(JSON.stringify({ level: 'info', service: 'ingatlan-com', msg: 'Region complete', region, count: result.value.length }));
          } else {
            console.log(JSON.stringify({ level: 'error', service: 'ingatlan-com', msg: 'Region failed', region, err: result.reason?.message }));
          }
        }

        // Delay between batches
        if (i + REGION_CONCURRENCY < regionsToScrape.length) {
          await this.delay(2000 + Math.random() * 1000);
        }
      }

      console.log(JSON.stringify({ level: 'info', service: 'ingatlan-com', msg: 'Fast scan complete', totalListings: allListings.length }));
      return allListings;
    } finally {
      await closeCycleTLS();
    }
  }

  /**
   * Scrape a specific region using CycleTLS
   */
  private async scrapeRegion(location: string, maxPages: number = 100): Promise<IngatlanListing[]> {
    const allListings: IngatlanListing[] = [];
    let pageNum = 1;

    while (pageNum <= maxPages) {
      try {
        const searchUrl = `${this.baseUrl}/lista/elado+lakas+${encodeURIComponent(location.toLowerCase())}${pageNum > 1 ? `?page=${pageNum}` : ''}`;

        const html = await fetchWithBrowserTLS(searchUrl, {
          browser: 'chrome',
          userAgent: getRandomUserAgent()
        });

        const $ = cheerio.load(html) as cheerio.CheerioAPI;
        const listings = this.extractListingsFromHTML($);

        if (listings.length === 0) break;

        allListings.push(...listings);

        const hasNextPage = $('a.pagination__button--next').length > 0 ||
                           $('link[rel="next"]').length > 0 ||
                           $('[class*="next"]').length > 0;

        if (!hasNextPage) break;

        pageNum++;
        await this.delay(1000 + Math.random() * 1000);
      } catch (error: any) {
        console.log(JSON.stringify({ level: 'error', service: 'ingatlan-com', msg: 'Page fetch failed', location, page: pageNum, err: error.message }));
        break;
      }
    }

    return allListings;
  }

  /**
   * Extract listings from HTML
   */
  private extractListingsFromHTML($: cheerio.CheerioAPI): IngatlanListing[] {
    const listings: IngatlanListing[] = [];

    const selectors = [
      '.listing', '.listing-card', '.results__item',
      '[data-id*="listing"]', '[class*="card"]', 'article', '.card'
    ];

    let listingElements: any = null;

    for (const selector of selectors) {
      const elements = $(selector);
      if (elements.length > 0) {
        listingElements = elements;
        break;
      }
    }

    if (!listingElements || listingElements.length === 0) return listings;

    listingElements.each((index: number, element: any) => {
      try {
        const $el = $(element);

        const id = $el.attr('data-id') ||
                   $el.attr('id') ||
                   $el.find('[data-id]').first().attr('data-id') ||
                   `ingatlan-${Date.now()}-${index}`;

        const titleEl = $el.find('a[href*="/"], h2 a, h3 a, .card__title a').first();
        const title = titleEl.text().trim() || $el.find('h2, h3, .title').first().text().trim();
        let url = titleEl.attr('href') || $el.find('a').first().attr('href');

        if (!title || !url) return;

        url = url.startsWith('http') ? url : `${this.baseUrl}${url}`;

        const priceEl = $el.find('.price, [class*="price"], .card__price').first();
        const priceText = priceEl.text().trim();
        const price = this.parsePrice(priceText);

        const locationEl = $el.find('.location, [class*="location"], .card__location').first();
        const location = locationEl.text().trim() || '';

        const text = $el.text();
        const areaMatch = text.match(/(\d+)\s*m[²2]/i);
        const area = areaMatch ? parseInt(areaMatch[1]) : undefined;

        const roomsMatch = text.match(/(\d+)\s*szoba|(\d+)\s*szobás/i);
        const rooms = roomsMatch ? parseInt(roomsMatch[1] || roomsMatch[2]) : undefined;

        const halfRoomsMatch = text.match(/(\d+)\s*fél/i);
        const halfRooms = halfRoomsMatch ? parseInt(halfRoomsMatch[1]) : undefined;

        const imgEl = $el.find('img').first();
        const imageUrl = imgEl.attr('src') || imgEl.attr('data-src') || imgEl.attr('data-lazy-src');
        const images = imageUrl ? [imageUrl] : undefined;

        const descEl = $el.find('.description, p.text, .card__description').first();
        const description = descEl.text().trim() || undefined;

        const propertyType = this.extractPropertyType(url, text);
        const transactionType = this.extractTransactionType(url, text);
        const currency = priceText.includes('€') ? 'EUR' : 'HUF';

        listings.push({
          id, title, price, currency, location, propertyType,
          transactionType, url, area, rooms, halfRooms, images, description
        });
      } catch (error: any) {
        // Skip individual listing errors
      }
    });

    return listings;
  }

  private parsePrice(priceText: string): number {
    if (!priceText) return 0;
    const cleaned = priceText.replace(/Ft|HUF|€|EUR|\/hó|\/mo|millió|M/gi, '').trim();
    const match = cleaned.match(/(\d{1,3}(?:[\s.]\d{3})*(?:[,]\d{1,2})?)/);
    if (!match) return 0;
    const number = match[1].replace(/\s/g, '').replace(/\./g, '').replace(/,/g, '.');
    const price = parseFloat(number);
    if (priceText.toLowerCase().includes('millió') || priceText.toLowerCase().includes('m ')) {
      return isNaN(price) ? 0 : price * 1000000;
    }
    return isNaN(price) ? 0 : price;
  }

  private extractPropertyType(url: string, text: string): string {
    const lowerUrl = url.toLowerCase();
    const lowerText = text.toLowerCase();
    if (lowerUrl.includes('/lakas') || lowerText.includes('lakás')) return 'lakás';
    if (lowerUrl.includes('/haz') || lowerUrl.includes('/ház') || lowerText.includes('ház')) return 'ház';
    if (lowerUrl.includes('/telek') || lowerText.includes('telek')) return 'telek';
    if (lowerUrl.includes('/garazs') || lowerUrl.includes('/garázs') || lowerText.includes('garázs')) return 'garázs';
    if (lowerUrl.includes('/iroda') || lowerText.includes('iroda')) return 'iroda';
    if (lowerUrl.includes('/uzlet') || lowerUrl.includes('/üzlet') || lowerText.includes('üzlet')) return 'üzlet';
    return 'egyéb';
  }

  private extractTransactionType(url: string, text: string): string {
    const lowerUrl = url.toLowerCase();
    const lowerText = text.toLowerCase();
    if (lowerUrl.includes('/kiado') || lowerUrl.includes('/kiadó') || lowerText.includes('kiadó')) return 'kiadó';
    if (lowerUrl.includes('/elado') || lowerUrl.includes('/eladó') || lowerText.includes('eladó')) return 'eladó';
    return 'eladó';
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
