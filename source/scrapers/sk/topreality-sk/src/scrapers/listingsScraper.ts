import axios from 'axios';
import * as cheerio from 'cheerio';
import { TopRealityListing, TopRealitySearchParams } from '../types/toprealityTypes';
import { getRandomUserAgent } from '../utils/userAgents';
import { batchCreateTopRealityChecksums } from '../utils/checksumExtractor';
import { ListingChecksum } from '@landomo/core';

/**
 * TopReality.sk Listings Scraper
 * Supports both full scrape and checksum-only modes
 */
export class ListingsScraper {
  private baseUrl = 'https://www.topreality.sk';
  private regions = [
    'c100-Bratislavský kraj',
    'c200-Trnavský kraj',
    'c300-Trenčiansky kraj',
    'c400-Nitriansky kraj',
    'c500-Žilinský kraj',
    'c600-Banskobystrický kraj',
    'c700-Prešovský kraj',
    'c800-Košický kraj'
  ];

  // Property type filters to subdivide searches
  private propertyTypes = [
    { label: 'byty', value: '1' },
    { label: 'domy', value: '2' },
    { label: 'pozemky', value: '3' },
    { label: 'komerčné', value: '4' },
    { label: 'ostatné', value: '5' }
  ];

  // Transaction type filters
  private transactionTypes = [
    { label: 'predaj', value: '1' },
    { label: 'prenajom', value: '2' }
  ];

  /**
   * Scrape all listings from TopReality.sk
   * PARALLEL MODE with FILTERING to capture all 65,770+ estates
   */
  async scrapeAll(concurrency: number = 3): Promise<TopRealityListing[]> {
    console.log(`Starting TopReality.sk scrape with category filters (${concurrency} concurrent)...`);
    const allListings: TopRealityListing[] = [];

    // Generate all combinations: region × propertyType × transactionType
    const searches: Array<{region: string; propertyType: any; transactionType: any}> = [];

    for (const region of this.regions) {
      for (const propertyType of this.propertyTypes) {
        for (const transactionType of this.transactionTypes) {
          searches.push({ region, propertyType, transactionType });
        }
      }
    }

    console.log(`\nTotal search combinations: ${searches.length}`);
    console.log(`This subdivides searches to capture all listings!\n`);

    // Process searches in parallel batches
    const batches = this.chunkArray(searches, concurrency);

    for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
      const batch = batches[batchIdx];
      console.log(`\nBatch ${batchIdx + 1}/${batches.length} (${batch.length} searches)...`);

      const results = await Promise.allSettled(
        batch.map(async (search) => {
          try {
            const label = `${search.region}/${search.propertyType.label}/${search.transactionType.label}`;
            console.log(`[${label}] Starting...`);

            const listings = await this.scrapeRegionWithFilters(
              search.region,
              search.propertyType.value,
              search.transactionType.value
            );
            console.log(`[${label}] ✅ ${listings.length} listings`);
            return listings;
          } catch (error: any) {
            const label = `${search.region}/${search.propertyType.label}/${search.transactionType.label}`;
            console.error(`[${label}] ❌ ${error.message}`);
            return [];
          }
        })
      );

      // Collect results from batch
      for (const result of results) {
        if (result.status === 'fulfilled') {
          // Use for-loop instead of spread to avoid stack overflow with large arrays
          for (const listing of result.value) {
            allListings.push(listing);
          }
        }
      }

      // Small delay between batches
      if (batchIdx < batches.length - 1) {
        await this.delay(1000);
      }
    }

    // Remove duplicates by ID
    const uniqueListings = Array.from(
      new Map(allListings.map(item => [item.id, item])).values()
    );

    console.log(`\n✅ Total unique listings: ${uniqueListings.length} (filtered from ${allListings.length})`);
    return uniqueListings;
  }

  /**
   * Chunk array into batches
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Get property count using API
   */
  async getPropertyCount(params: TopRealitySearchParams): Promise<number> {
    try {
      const queryParams = new URLSearchParams({
        form: '1',
        searchType: 'string',
        obec: params.location || '',
        typ_ponuky: String(params.offerType ?? 0),
        typ_nehnutelnosti: String(params.propertyType ?? 0),
        vymera_od: String(params.areaFrom ?? 0),
        vymera_do: String(params.areaTo ?? 0),
        page: 'estate',
        fromForm: '1'
      });

      const response = await axios.get(`${this.baseUrl}/ajax.php?${queryParams}`, {
        headers: {
          'User-Agent': getRandomUserAgent(),
          'X-Requested-With': 'XMLHttpRequest',
          'Referer': this.baseUrl,
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'Accept-Language': 'sk-SK'
        },
        timeout: 10000
      });

      // Response is plain text like "9 200" (with space as thousands separator)
      const countText = response.data.toString().replace(/\s/g, '');
      return parseInt(countText) || 0;
    } catch (error: any) {
      console.error('Error getting property count:', error.message);
      return 0;
    }
  }

  /**
   * Scrape a specific region with property and transaction type filters
   */
  async scrapeRegionWithFilters(
    location: string,
    propertyType: string,
    transactionType: string,
    maxPages: number = Infinity
  ): Promise<TopRealityListing[]> {
    const allListings: TopRealityListing[] = [];
    let page = 1;

    while (page <= maxPages) {
      try {
        // Build URL with all filters
        const params = new URLSearchParams({
          obec: location,
          typ_ponuky: transactionType,
          typ_nehnutelnosti: propertyType
        });

        if (page > 1) {
          params.set('page', String(page));
        }

        const searchUrl = `${this.baseUrl}/vyhladavanie-nehnutelnosti.html?${params}`;

        console.log(`    Fetching page ${page}...`);

        // Fetch HTML page with increased timeout
        const response = await axios.get(searchUrl, {
          headers: {
            'User-Agent': getRandomUserAgent(),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9',
            'Accept-Language': 'sk-SK,sk;q=0.9',
            'Referer': this.baseUrl
          },
          timeout: 30000 // Increased to 30 seconds
        });

        // Parse HTML with Cheerio
        const $ = cheerio.load(response.data);

        // Extract listings
        const listings = this.extractListingsFromHTML($ as any);

        if (listings.length === 0) {
          console.log(`    No more listings found on page ${page}`);
          break;
        }

        // Use for-loop instead of spread to avoid stack overflow with large arrays
        for (const listing of listings) {
          allListings.push(listing);
        }
        console.log(`    Page ${page}: ${listings.length} listings`);

        // Check for next page
        const hasNextPage = $('a.next').length > 0 || $('link[rel="next"]').length > 0;
        if (!hasNextPage) {
          break;
        }

        page++;

        // Minimal delay between pages (speed optimized)
        await this.delay(300 + Math.random() * 200); // 0.3-0.5 seconds
      } catch (error: any) {
        console.error(`    Error on page ${page}:`, error.message);
        break;
      }
    }

    return allListings;
  }

  /**
   * Extract listings from HTML
   */
  private extractListingsFromHTML($: cheerio.CheerioAPI): TopRealityListing[] {
    const listings: TopRealityListing[] = [];

    // Try common selectors for property cards
    const selectors = [
      '.estate',       // page 1 featured listings
      '.topfix-item',  // page 2+ regular listings
      '.property',
      '.listing-item',
      'article',
      '[class*="property"]',
      '[class*="estate"]'
    ];

    let listingElements: any = null;

    for (const selector of selectors) {
      const elements = $(selector);
      if (elements.length > 0) {
        listingElements = elements;
        break;
      }
    }

    if (!listingElements || listingElements.length === 0) {
      return listings;
    }

    // Extract data from each listing
    listingElements.each((index: number, element: any) => {
      try {
        const $el = $(element);

        // Extract URL — try title link first, then any listing link
        const titleEl = $el.find('h2 a, h3 a, .title a, a[href*="/detail/"]').first();
        const anyLink = $el.find('a[href*="-r"]').first();
        const rawUrl = titleEl.attr('href') || anyLink.attr('href');

        if (!rawUrl) {
          return; // Skip if no URL
        }

        // Make URL absolute
        const fullUrl = rawUrl.startsWith('http') ? rawUrl : `${this.baseUrl}/${rawUrl.replace(/^\.\//, '')}`;

        // Extract ID: from URL slug, data-idinz attr, data-id attr, or fallback
        const urlIdMatch = rawUrl.match(/-r(\d+)\.html/);
        const id = urlIdMatch ? urlIdMatch[1]
          : ($el.attr('data-idinz') || $el.attr('data-ga4-container-item_id_generic')
          || $el.attr('data-id') || $el.attr('id') || `topreality-${Date.now()}-${index}`);

        // Extract title: from heading link, GA4 data attr, or description div
        const title = titleEl.text().trim()
          || $el.attr('data-ga4-container-item_name')
          || $el.find('.description').first().text().trim()
          || `Listing ${id}`;

        // Extract price: from GA4 data attr or price elements
        const ga4Price = $el.attr('data-ga4-container-price');
        const priceEl = $el.find('.price, .cena, [class*="price"], [class*="cena"]').first();
        const priceText = priceEl.text().trim();
        const price = ga4Price ? parseFloat(ga4Price) : this.parsePrice(priceText);

        // Extract location
        const locationEl = $el.find('.location, .lokalita, [class*="location"]').first();
        const location = locationEl.text().trim()
          || $el.attr('data-ga4-container-location_id')
          || '';

        // Extract area (m²)
        const text = $el.text();
        const areaMatch = text.match(/(\d+)\s*m²/);
        const area = areaMatch ? parseInt(areaMatch[1]) : undefined;

        // Extract rooms
        const roomsMatch = text.match(/(\d)\s*izb/i);
        const rooms = roomsMatch ? parseInt(roomsMatch[1]) : undefined;

        // Extract image
        const imgEl = $el.find('img').first();
        const imageUrl = imgEl.attr('src') || imgEl.attr('data-src');

        // Extract description
        const descEl = $el.find('.description, p.text').first();
        const description = descEl.text().trim() || undefined;

        // Determine property type and transaction type from URL or text
        const propertyType = this.extractPropertyType(fullUrl, text);
        const transactionType = this.extractTransactionType(fullUrl, text);

        listings.push({
          id,
          title,
          price,
          currency: '€',
          location,
          propertyType,
          transactionType,
          url: fullUrl,
          area,
          rooms,
          images: imageUrl ? [imageUrl] : undefined,
          description
        });
      } catch (error: any) {
        console.error(`    Error extracting listing ${index}:`, error.message);
      }
    });

    return listings;
  }

  /**
   * Parse price from string
   */
  private parsePrice(priceText: string): number {
    if (!priceText) return 0;

    // Extract first number with possible thousand separators
    // Matches patterns like: 238 999, 238999, 238.999, 238,999
    const match = priceText.match(/(\d{1,3}(?:[\s.,]\d{3})*(?:[.,]\d{1,2})?)/);

    if (!match) return 0;

    const cleaned = match[1]
      .replace(/\s/g, '')
      .replace(/\./g, '')
      .replace(/,/g, '');

    const price = parseFloat(cleaned);
    return isNaN(price) ? 0 : price;
  }

  /**
   * Extract property type from URL or text
   */
  private extractPropertyType(url: string, text: string): string {
    const lowerUrl = url.toLowerCase();
    const lowerText = text.toLowerCase();

    if (lowerUrl.includes('/byt') || lowerText.includes('byt')) return 'byty';
    if (lowerUrl.includes('/dom') || lowerText.includes('dom')) return 'domy';
    if (lowerUrl.includes('/pozemok') || lowerText.includes('pozemok')) return 'pozemky';
    if (lowerUrl.includes('/komercn') || lowerText.includes('komerčn')) return 'komerčné';

    return 'iné';
  }

  /**
   * Extract transaction type from URL or text
   */
  private extractTransactionType(url: string, text: string): string {
    const lowerUrl = url.toLowerCase();
    const lowerText = text.toLowerCase();

    if (lowerUrl.includes('/predaj') || lowerText.includes('predaj')) return 'predaj';
    if (lowerUrl.includes('/prenajom') || lowerUrl.includes('/prenájom') || lowerText.includes('prenájom')) return 'prenajom';

    return 'predaj'; // Default to sale
  }

  /**
   * Two-phase scrape: scan ALL pages for checksums, buffer only new/changed listings, return them.
   * Phase 1: For each search combo, paginate all pages and compare checksums per page.
   * Phase 2: Return buffered new/changed listings for ingestion by the caller.
   */
  async scrapeAllTwoPhase(
    checksumClient: { compareChecksums: (checksums: ListingChecksum[], scrapeRunId?: string) => Promise<{ new: number; changed: number; unchanged: number; results: Array<{ portalId: string; status: string }> }> },
    scrapeRunId?: string,
    onBatch?: (listings: TopRealityListing[]) => Promise<void>
  ): Promise<{
    listings: TopRealityListing[];
    allSeenChecksums: ListingChecksum[];
    stats: {
      total: number;
      new: number;
      changed: number;
      unchanged: number;
      pagesScanned: number;
    };
  }> {
    console.log('Starting TopReality.sk two-phase scrape...');

    const searches: Array<{ region: string; propertyType: any; transactionType: any }> = [];
    for (const region of this.regions) {
      for (const propertyType of this.propertyTypes) {
        for (const transactionType of this.transactionTypes) {
          searches.push({ region, propertyType, transactionType });
        }
      }
    }

    console.log(`Total search combinations: ${searches.length}`);

    const bufferedListings: TopRealityListing[] = [];
    const allSeenChecksums: ListingChecksum[] = [];
    let statsTotal = 0;
    let statsNew = 0;
    let statsChanged = 0;
    let statsUnchanged = 0;
    let pagesScanned = 0;

    for (const search of searches) {
      const label = `${search.region}/${search.propertyType.label}/${search.transactionType.label}`;
      let page = 1;
      const comboBuffered: TopRealityListing[] = [];

      while (true) {
        try {
          const params = new URLSearchParams({
            obec: search.region,
            typ_ponuky: search.transactionType.value,
            typ_nehnutelnosti: search.propertyType.value
          });

          if (page > 1) {
            params.set('page', String(page));
          }

          const searchUrl = `${this.baseUrl}/vyhladavanie-nehnutelnosti.html?${params}`;
          const response = await axios.get(searchUrl, {
            headers: {
              'User-Agent': getRandomUserAgent(),
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9',
              'Accept-Language': 'sk-SK,sk;q=0.9',
              'Referer': this.baseUrl
            },
            timeout: 30000
          });

          const $ = cheerio.load(response.data);
          const pageListings = this.extractListingsFromHTML($ as any);
          pagesScanned++;

          if (pageListings.length === 0) {
            break;
          }

          // Compare checksums for this page
          const pageChecksums = batchCreateTopRealityChecksums(pageListings);

          // Accumulate all seen checksums (for last_seen_at refresh of unchanged listings)
          allSeenChecksums.push(...pageChecksums);

          const comparison = await checksumClient.compareChecksums(pageChecksums, scrapeRunId);

          statsTotal += pageListings.length;
          statsNew += comparison.new;
          statsChanged += comparison.changed;
          statsUnchanged += comparison.unchanged;

          // Buffer/ingest only new/changed listings per page
          const changedIds = new Set(
            comparison.results
              .filter((r: any) => r.status !== 'unchanged')
              .map((r: any) => r.portalId)
          );
          const pageChanged: TopRealityListing[] = [];
          for (const listing of pageListings) {
            if (changedIds.has(String(listing.id))) {
              pageChanged.push(listing);
            }
          }
          if (pageChanged.length > 0) {
            if (onBatch) {
              await onBatch(pageChanged);
            } else {
              comboBuffered.push(...pageChanged);
            }
          }

          // Check for next page
          const hasNextPage = $('a.next').length > 0 || $('link[rel="next"]').length > 0;
          if (!hasNextPage) {
            break;
          }

          page++;
          await this.delay(300 + Math.random() * 200);
        } catch (error: any) {
          console.error(`[${label}] Error on page ${page}:`, error.message);
          break;
        }
      }

      if (!onBatch && comboBuffered.length > 0) {
        bufferedListings.push(...comboBuffered);
      }
    }

    // Deduplicate by ID (only used when onBatch is not provided)
    const uniqueListings = Array.from(
      new Map(bufferedListings.map(l => [l.id, l])).values()
    );

    return {
      listings: uniqueListings,
      allSeenChecksums,
      stats: {
        total: statsTotal,
        new: statsNew,
        changed: statsChanged,
        unchanged: statsUnchanged,
        pagesScanned
      }
    };
  }

  /**
   * Scrape with checksums (optimized mode)
   * Returns checksum objects instead of full listings
   */
  async scrapeWithChecksums(concurrency: number = 3): Promise<ListingChecksum[]> {
    console.log(`Starting TopReality.sk checksum scrape (${concurrency} concurrent)...`);
    const listings = await this.scrapeAll(concurrency);

    console.log(`\n🔐 Creating checksums for ${listings.length} listings...`);
    const checksums = batchCreateTopRealityChecksums(listings);

    console.log(`✅ Generated ${checksums.length} checksums`);
    return checksums;
  }

  /**
   * Fetch and parse a detail page for a single listing.
   * Returns extracted detail fields, or null on failure.
   */
  async fetchListingDetail(url: string): Promise<TopRealityDetailData | null> {
    const absoluteUrl = url.startsWith('http') ? url : `${this.baseUrl}${url}`;
    try {
      const response = await axios.get(absoluteUrl, {
        headers: {
          'User-Agent': getRandomUserAgent(),
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9',
          'Accept-Language': 'sk-SK,sk;q=0.9',
          'Referer': this.baseUrl
        },
        timeout: 20000
      });

      const detail = this.extractDetailFromHtml(response.data);
      if (!detail) return null;

      // Fetch full phone number via /block/kontakt.php?id={estateId}
      // The estate ID is the numeric suffix in the URL: "-r9014722.html" → "9014722"
      const estateIdMatch = absoluteUrl.match(/-r(\d+)\.html/);
      if (estateIdMatch) {
        const estateId = estateIdMatch[1];
        try {
          const phoneRes = await axios.get(`${this.baseUrl}/block/kontakt.php?id=${estateId}`, {
            headers: {
              'User-Agent': getRandomUserAgent(),
              'Accept': 'text/html,*/*',
              'X-Requested-With': 'XMLHttpRequest',
              'Referer': absoluteUrl
            },
            timeout: 10000
          });
          const $p = cheerio.load(phoneRes.data);
          const telHref = $p('a[href^="tel:"]').first().attr('href');
          if (telHref) {
            detail.phone = telHref.replace('tel:', '').trim();
          }
        } catch { /* non-fatal */ }
      }

      return detail;
    } catch (error: any) {
      // Non-fatal: return null so list-page data is used as fallback
      return null;
    }
  }

  /**
   * Extract detail data from a TopReality.sk detail page HTML.
   * Parses the attribute list items, description, energy rating, images, and GPS.
   */
  extractDetailFromHtml(html: string): TopRealityDetailData | null {
    try {
      const $ = cheerio.load(html);
      const result: TopRealityDetailData = {};

      // Extract attribute list items: each <li> has a label element and <strong> value
      // Handles: <li><generic>Label</generic><strong>Value</strong></li>
      //      and <li><div>Label</div><strong>Value</strong></li>
      $('li').each((_, el) => {
        const $li = $(el);
        const children = $li.children();
        if (children.length < 2) return;

        const label = children.first().text().trim().toLowerCase().replace(/:$/, '');
        const valueEl = $li.find('strong').first();
        const value = valueEl.text().trim();

        if (!label || !value) return;

        const valueLower = value.toLowerCase();
        const isYes = valueLower === 'áno' || valueLower === 'ano';
        const isNo = valueLower === 'nie';

        if (label.includes('podlaži') || label === 'podlažie') {
          // "7 / 11" pattern
          const match = value.match(/(\d+)\s*\/\s*(\d+)/);
          if (match) {
            result.floor = parseInt(match[1]);
            result.totalFloors = parseInt(match[2]);
          } else {
            const single = value.match(/(\d+)/);
            if (single) result.floor = parseInt(single[1]);
          }
        } else if (label.includes('materiál') || label === 'material') {
          result.constructionType = value;
        } else if (label === 'stav' || label.includes('stav nehnuteľnosti')) {
          result.condition = value;
        } else if (label.includes('vlastníctvo') || label.includes('vlastnictvo')) {
          result.ownership = value;
        } else if (label.includes('vykurovanie') || label.includes('kúrenie')) {
          result.heating = value;
        } else if (label.includes('zariadenie') || label.includes('zariadený') || label.includes('vybavenie')) {
          result.furnished = value;
        } else if (label.includes('kúpeľ') || label.includes('kupel')) {
          const num = value.match(/(\d+)/);
          if (num) result.bathrooms = parseInt(num[1]);
        } else if (label.includes('rok výstavby') || label.includes('rok vystavby') || label.includes('rok postavenia')) {
          const year = value.match(/(\d{4})/);
          if (year) result.yearBuilt = parseInt(year[1]);
        } else if (label === 'pivnica') {
          if (isYes) result.hasBasement = true;
          else if (isNo) result.hasBasement = false;
        } else if (label === 'výťah' || label === 'vytah') {
          if (isYes) result.hasElevator = true;
          else if (isNo) result.hasElevator = false;
        } else if (label === 'balkón' || label === 'balkon' || label === 'balkón / loggia' || label === 'balkon / loggia') {
          if (isYes) result.hasBalcony = true;
          else if (isNo) result.hasBalcony = false;
        } else if (label === 'garáž' || label === 'garaz') {
          if (isYes) result.hasGarage = true;
          else if (isNo) result.hasGarage = false;
        } else if (label === 'parkovanie') {
          if (isYes) result.hasParking = true;
          else if (isNo) result.hasParking = false;
        } else if (label.includes('zastavaná plocha') || label.includes('zastavana plocha')) {
          const num = value.match(/(\d[\d\s]*)/);
          if (num) result.sqm_built = parseInt(num[1].replace(/\s/g, ''));
        } else if (label === 'pozemok') {
          const num = value.match(/(\d[\d\s]*)/);
          if (num) result.sqm_plot = parseInt(num[1].replace(/\s/g, ''));
        } else if (label === 'ulica') {
          result.street = value;
        } else if (label.includes('aktualizácia') || label.includes('aktualizacia')) {
          result.updated_at = value;
        } else if (label.includes('identifikačné číslo') || label.includes('identifikacne cislo')) {
          result.portal_reference_id = value;
        } else if (label.includes('rok rekonštrukcie') || label.includes('rok rekonstrukcie') || label.includes('rekonštrukcia')) {
          const year = value.match(/(\d{4})/);
          if (year) result.renovation_year = parseInt(year[1]);
        } else if (label.includes('počet spální') || label.includes('pocet spaln')) {
          const num = value.match(/(\d+)/);
          if (num) result.bedrooms_count = parseInt(num[1]);
        } else if (label === 'záhrada' || label === 'zahrada' || label === 'záhradka') {
          if (isYes) result.hasGarden = true;
          else if (isNo) result.hasGarden = false;
        } else if (label === 'terasa' || label.includes('terasa')) {
          if (isYes) result.hasTerrace = true;
          else if (isNo) result.hasTerrace = false;
        } else if (label === 'loggia' || label === 'lodžia' || label === 'lodzia') {
          if (isYes) result.hasLoggia = true;
          else if (isNo) result.hasLoggia = false;
        }
      });

      // Extract full description
      const descEl = $('p').filter((_, el) => {
        const text = $(el).text();
        return text.length > 200;
      }).first();
      if (descEl.length) {
        result.description = descEl.text().trim();
      }

      // Extract energy rating from span inside .energy-class
      // <div class="energy-class"><div class="a"></div>...<span class="b"></span></div>
      // The span's class attribute = the rating letter (a-g), or "i" = not determined
      const energySpan = $('div.energy-class > span');
      if (energySpan.length > 0) {
        const rawRating = energySpan.attr('class')?.toUpperCase();
        // 'I' means not determined; only store A-G
        result.energyRating = rawRating && rawRating !== 'I' ? rawRating : undefined;
      }

      // Extract images from gallery links
      const images: string[] = [];
      $('a[href*="/galeria.html"] img, .gallery img, [class*="photo"] img').each((_, el) => {
        const src = $(el).attr('src') || $(el).attr('data-src');
        if (src && !src.includes('placeholder') && !src.includes('logo')) {
          const absoluteSrc = src.startsWith('http') ? src : `${this.baseUrl}${src}`;
          images.push(absoluteSrc);
        }
      });
      if (images.length > 0) {
        result.images = images;
      }

      // GPS coordinates from #map_canvas data attributes (data-gpsx = lat, data-gpsy = lon)
      const mapCanvas = $('#map_canvas');
      if (mapCanvas.length) {
        const gpsx = mapCanvas.attr('data-gpsx');
        const gpsy = mapCanvas.attr('data-gpsy');
        if (gpsx && gpsy) {
          const lat = parseFloat(gpsx);
          const lon = parseFloat(gpsy);
          if (!isNaN(lat) && !isNaN(lon)) {
            result.lat = lat;
            result.lon = lon;
          }
        }
      }

      // Extract agency and agent names
      const agencyName = $('a.a-agency').text().trim();
      if (agencyName) result.agency_name = agencyName;

      const agentName = $('.contactBox strong').first().text().trim();
      if (agentName) result.agent_name = agentName;

      // Extract agent profile URL
      const agentLink = $('a[href*="/makler/"]').first();
      if (agentLink.length) {
        const href = agentLink.attr('href');
        if (href) {
          result.agent_profile_url = href.startsWith('http') ? href : `${this.baseUrl}${href}`;
        }
      }

      // Extract agency profile URL
      const agencyLink = $('a[href*="/realitne-kancelarie/"]').first();
      if (agencyLink.length) {
        const href = agencyLink.attr('href');
        if (href) {
          result.agency_profile_url = href.startsWith('http') ? href : `${this.baseUrl}${href}`;
        }
      }

      // Extract agency address - text near the agency block
      const agencyEl = $('a.a-agency');
      if (agencyEl.length) {
        const agencyParent = agencyEl.closest('div, li, td');
        if (agencyParent.length) {
          const parentText = agencyParent.text().trim();
          // Remove agency name from text to get address portion
          const addressText = parentText.replace(agencyName, '').trim();
          if (addressText && addressText.length > 3 && addressText.length < 200) {
            result.agency_address = addressText;
          }
        }
      }

      // Extract partial phone from contact box
      const phoneLink = $('.contactBox [href^="tel:"]').first();
      if (phoneLink.length) {
        const tel = phoneLink.attr('href')?.replace('tel:', '').trim();
        if (tel) result.phone_partial = tel;
      } else {
        // Fallback: look for "Tel" pattern in contact box text
        const contactText = $('.contactBox').text();
        const telMatch = contactText.match(/Tel\s*:?\s*(\+?\d[\d\s]{2,})/i);
        if (telMatch) result.phone_partial = telMatch[1].trim();
      }

      // Fallback: extract boolean amenities from description text (only if not already set from structured data)
      const fullText = (result.description || '') + ' ' + $('body').text();
      const lowerText = fullText.toLowerCase();
      if (result.hasElevator === undefined && (lowerText.includes('výťah') || lowerText.includes('vytah'))) result.hasElevator = true;
      if (result.hasBalcony === undefined && (lowerText.includes('balkón') || lowerText.includes('balkon'))) result.hasBalcony = true;
      if (result.hasBasement === undefined && (lowerText.includes('pivnic') || lowerText.includes('suterén'))) result.hasBasement = true;
      if (result.hasParking === undefined && (lowerText.includes('parking') || lowerText.includes('parkovanie') || lowerText.includes('parkovac'))) result.hasParking = true;
      if (result.hasGarage === undefined && (lowerText.includes('garáž') || lowerText.includes('garaz'))) result.hasGarage = true;

      return result;
    } catch (error: any) {
      return null;
    }
  }

  /**
   * Enrich a listing with data from its detail page.
   * Detail data takes precedence over list-page data.
   */
  enrichListingFromDetail(listing: TopRealityListing, detail: TopRealityDetailData): TopRealityListing {
    return {
      ...listing,
      floor: detail.floor ?? listing.floor,
      totalFloors: detail.totalFloors ?? listing.totalFloors,
      condition: detail.condition ?? listing.condition,
      constructionType: detail.constructionType ?? listing.constructionType,
      ownership: detail.ownership ?? listing.ownership,
      heating: detail.heating ?? listing.heating,
      energyRating: detail.energyRating ?? listing.energyRating,
      furnished: detail.furnished ?? listing.furnished,
      bathrooms: detail.bathrooms ?? listing.bathrooms,
      yearBuilt: detail.yearBuilt ?? listing.yearBuilt,
      hasElevator: detail.hasElevator ?? listing.hasElevator,
      hasBalcony: detail.hasBalcony ?? listing.hasBalcony,
      hasBasement: detail.hasBasement ?? listing.hasBasement,
      hasParking: detail.hasParking ?? listing.hasParking,
      hasGarage: detail.hasGarage ?? listing.hasGarage,
      sqm_built: detail.sqm_built ?? listing.sqm_built,
      sqm_plot: detail.sqm_plot ?? listing.sqm_plot,
      street: detail.street ?? listing.street,
      updated_at: detail.updated_at ?? listing.updated_at,
      portal_reference_id: detail.portal_reference_id ?? listing.portal_reference_id,
      agency_name: detail.agency_name ?? listing.agency_name,
      agent_name: detail.agent_name ?? listing.agent_name,
      lat: detail.lat ?? listing.lat,
      lon: detail.lon ?? listing.lon,
      description: detail.description ?? listing.description,
      images: (detail.images && detail.images.length > 0) ? detail.images : listing.images,
      renovation_year: detail.renovation_year ?? listing.renovation_year,
      bedrooms_count: detail.bedrooms_count ?? listing.bedrooms_count,
      hasGarden: detail.hasGarden ?? listing.hasGarden,
      hasTerrace: detail.hasTerrace ?? listing.hasTerrace,
      hasLoggia: detail.hasLoggia ?? listing.hasLoggia,
      agent_profile_url: detail.agent_profile_url ?? listing.agent_profile_url,
      agency_profile_url: detail.agency_profile_url ?? listing.agency_profile_url,
      agency_address: detail.agency_address ?? listing.agency_address,
      phone_partial: detail.phone_partial ?? listing.phone_partial,
      phone: detail.phone ?? listing.phone,
    };
  }

  /**
   * Streaming scrape: runs up to `concurrency` search combinations simultaneously.
   * For each combination, paginates all pages and calls `onBatch(pageListings)` after each page.
   * Does NOT accumulate all listings in memory — suited for queue-based pipelines.
   */
  async scrapeAllStreaming(
    onBatch: (listings: TopRealityListing[]) => Promise<void>,
    concurrency = 3
  ): Promise<{ total: number }> {
    const searches: Array<{ region: string; propertyType: any; transactionType: any }> = [];
    for (const region of this.regions) {
      for (const propertyType of this.propertyTypes) {
        for (const transactionType of this.transactionTypes) {
          searches.push({ region, propertyType, transactionType });
        }
      }
    }

    console.log(`scrapeAllStreaming: ${searches.length} combinations, concurrency=${concurrency}`);

    let total = 0;

    // Semaphore: limit concurrent combo-scrapers
    let active = 0;
    let index = 0;
    const errors: string[] = [];

    await new Promise<void>((resolve, reject) => {
      const tryNext = () => {
        while (active < concurrency && index < searches.length) {
          const search = searches[index++];
          active++;
          const label = `${search.region}/${search.propertyType.label}/${search.transactionType.label}`;
          this.scrapeComboStreaming(search.region, search.propertyType.value, search.transactionType.value, onBatch)
            .then(count => {
              total += count;
            })
            .catch(err => {
              errors.push(`[${label}] ${err.message}`);
            })
            .finally(() => {
              active--;
              tryNext();
              if (active === 0 && index >= searches.length) {
                resolve();
              }
            });
        }
        if (active === 0 && index >= searches.length) {
          resolve();
        }
      };
      tryNext();
    });

    if (errors.length > 0) {
      console.warn(`scrapeAllStreaming: ${errors.length} combo errors`);
    }

    return { total };
  }

  /**
   * Scrape a single search combination, calling onBatch per page.
   */
  private async scrapeComboStreaming(
    location: string,
    propertyType: string,
    transactionType: string,
    onBatch: (listings: TopRealityListing[]) => Promise<void>
  ): Promise<number> {
    let page = 1;
    let count = 0;
    // Track IDs seen in this combo to detect when topreality cycles back to
    // already-seen listings (it never returns an empty page).
    const seenIds = new Set<string>();

    while (true) {
      try {
        const params = new URLSearchParams({
          obec: location,
          typ_ponuky: transactionType,
          typ_nehnutelnosti: propertyType
        });
        if (page > 1) {
          params.set('page', String(page));
        }

        const searchUrl = `${this.baseUrl}/vyhladavanie-nehnutelnosti.html?${params}`;
        const response = await axios.get(searchUrl, {
          headers: {
            'User-Agent': getRandomUserAgent(),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9',
            'Accept-Language': 'sk-SK,sk;q=0.9',
            'Referer': this.baseUrl
          },
          timeout: 30000
        });

        const $ = cheerio.load(response.data);
        const pageListings = this.extractListingsFromHTML($ as any);

        if (pageListings.length === 0) {
          break;
        }

        // Filter to only listings not yet seen in this combo run.
        // Topreality never returns an empty page — it cycles back to already-
        // seen listings when results are exhausted, so this is our stop signal.
        const newListings = pageListings.filter(l => !seenIds.has(String(l.id)));
        if (newListings.length === 0) {
          break; // All listings on this page were already seen → end of unique content
        }
        newListings.forEach(l => seenIds.add(String(l.id)));

        count += newListings.length;
        await onBatch(newListings);

        page++;
        await this.delay(800 + Math.random() * 400);
      } catch (error: any) {
        const status = (error as any)?.response?.status;
        if (status === 429) {
          // Rate limited — back off and retry same page
          console.warn(`scrapeComboStreaming 429 on page ${page}, backing off 10s...`);
          await this.delay(10000 + Math.random() * 5000);
          continue; // retry same page
        }
        console.error(`scrapeComboStreaming error on page ${page}:`, error.message);
        break;
      }
    }

    return count;
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Detail data extracted from a TopReality.sk detail page
 */
export interface TopRealityDetailData {
  floor?: number;
  totalFloors?: number;
  condition?: string;
  constructionType?: string;
  ownership?: string;
  heating?: string;
  energyRating?: string;
  furnished?: string;
  bathrooms?: number;
  yearBuilt?: number;
  hasElevator?: boolean;
  hasBalcony?: boolean;
  hasBasement?: boolean;
  hasParking?: boolean;
  hasGarage?: boolean;
  sqm_built?: number;
  sqm_plot?: number;
  street?: string;
  updated_at?: string;
  portal_reference_id?: string;
  agency_name?: string;
  agent_name?: string;
  description?: string;
  images?: string[];
  lat?: number;
  lon?: number;
  renovation_year?: number;
  bedrooms_count?: number;
  hasGarden?: boolean;
  hasTerrace?: boolean;
  hasLoggia?: boolean;
  agent_profile_url?: string;
  agency_profile_url?: string;
  agency_address?: string;
  phone_partial?: string;
  phone?: string;
}

// ============================================================
// Module-level singleton for standalone function exports
// ============================================================
const _scraperInstance = new ListingsScraper();

/**
 * Standalone wrapper: fetch detail page for a listing URL.
 * Used by detailQueue worker.
 */
export async function fetchListingDetail(url: string): Promise<TopRealityDetailData | null> {
  return _scraperInstance.fetchListingDetail(url);
}

/**
 * Standalone wrapper: enrich listing with detail data.
 * Used by detailQueue worker.
 */
export function enrichListingFromDetail(listing: TopRealityListing, detail: TopRealityDetailData): TopRealityListing {
  return _scraperInstance.enrichListingFromDetail(listing, detail);
}

/**
 * Standalone wrapper: streaming scrape with semaphore concurrency.
 * Used by index.ts runScraper.
 */
export async function scrapeAllStreaming(
  onBatch: (listings: TopRealityListing[]) => Promise<void>,
  concurrency = 8
): Promise<{ total: number }> {
  return _scraperInstance.scrapeAllStreaming(onBatch, concurrency);
}
