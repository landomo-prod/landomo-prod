import axios from 'axios';
import * as cheerio from 'cheerio';
import { NehnutelnostiListing } from '../types/nehnutelnostiTypes';

/**
 * Nehnuteľnosti.sk HTTP Scraper
 * Lightweight alternative using HTTP + Cheerio instead of browser automation
 * Extracts data from Next.js App Router embedded JSON
 */
export class HttpScraper {
  private baseUrl = 'https://www.nehnutelnosti.sk';
  private client = axios.create({
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'sk-SK,sk;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Upgrade-Insecure-Requests': '1'
    },
    timeout: 30000
  });

  /**
   * All regions in Slovakia
   */
  private readonly regions = [
    'bratislavsky-kraj',
    'trnavsky-kraj',
    'trenciansky-kraj',
    'nitriansky-kraj',
    'zilinsky-kraj',
    'banskobystricky-kraj',
    'presovsky-kraj',
    'kosicky-kraj'
  ];

  /**
   * Build the 56 search combos (8 regions × 7 category/transaction combos)
   */
  private buildSearches(): Array<{ region: string; category: string; transaction: string }> {
    const searches = [];
    for (const region of this.regions) {
      searches.push(
        { region, category: 'byty', transaction: 'predaj' },
        { region, category: 'domy', transaction: 'predaj' },
        { region, category: 'pozemky', transaction: 'predaj' },
        { region, category: 'byty', transaction: 'prenajom' },
        { region, category: 'domy', transaction: 'prenajom' },
        { region, category: 'priestory', transaction: 'predaj' },
        { region, category: 'priestory', transaction: 'prenajom' }
      );
    }
    return searches;
  }

  /**
   * Scrape all listings from Nehnuteľnosti.sk
   * SEQUENTIAL MODE: Processes searches one at a time
   */
  async scrapeAll(concurrency: number = 1): Promise<NehnutelnostiListing[]> {
    console.log(`Starting Nehnuteľnosti.sk HTTP scrape (sequential mode)...`);

    const allListings: NehnutelnostiListing[] = [];
    const searches = this.buildSearches();

    // Process searches sequentially
    for (const search of searches) {
      try {
        console.log(`[${search.region}/${search.category}/${search.transaction}] Starting...`);
        const listings = await this.scrapeSearch(search);
        console.log(`[${search.region}/${search.category}/${search.transaction}] ✅ ${listings.length} listings`);
        allListings.push(...listings);

        // Small delay between searches
        await this.delay(300);
      } catch (error: any) {
        console.error(`[${search.region}/${search.category}/${search.transaction}] ❌ ${error.message}`);
      }
    }

    console.log(`\n✅ Total listings scraped: ${allListings.length}`);
    return allListings;
  }

  /**
   * Two-phase scrape across all 40 search combos.
   * Phase 1: Fetch ALL pages, generate checksums, compare with DB.
   * Phase 2: Return only new/changed listings for ingestion.
   */
  async scrapeAllTwoPhase(
    checksumClient: any,
    batchCreateChecksums: (listings: NehnutelnostiListing[]) => any[],
    scrapeRunId?: string,
    onBatch?: (listings: NehnutelnostiListing[]) => Promise<void>
  ): Promise<{
    listings: NehnutelnostiListing[];
    allSeenChecksums: any[];
    stats: {
      total: number;
      new: number;
      changed: number;
      unchanged: number;
      pagesScanned: number;
    };
  }> {
    const searches = this.buildSearches();
    const allListings: NehnutelnostiListing[] = [];
    const allSeenChecksums: any[] = [];
    let totalNew = 0;
    let totalChanged = 0;
    let totalUnchanged = 0;
    let totalPagesScanned = 0;

    for (const search of searches) {
      const label = `[${search.region}/${search.category}/${search.transaction}]`;
      try {
        console.log(`${label} Two-phase scan starting...`);
        const result = await this.scrapeSearchTwoPhase(search, checksumClient, batchCreateChecksums, scrapeRunId, onBatch);
        allSeenChecksums.push(...result.allSeenChecksums);
        totalNew += result.stats.new;
        totalChanged += result.stats.changed;
        totalUnchanged += result.stats.unchanged;
        totalPagesScanned += result.pagesScanned;
        console.log(
          `${label} ✅ ${result.listings.length} to ingest` +
          ` (${result.stats.new} new, ${result.stats.changed} changed, ${result.stats.unchanged} unchanged)` +
          ` | pages scanned: ${result.pagesScanned}`
        );

        if (!onBatch) {
          allListings.push(...result.listings);
        }

        await this.delay(300);
      } catch (error: any) {
        console.error(`${label} ❌ ${error.message}`);
      }
    }

    const total = totalNew + totalChanged + totalUnchanged;
    console.log(`\nTwo-phase scan complete:`);
    console.log(`   Pages scanned: ${totalPagesScanned}`);
    console.log(`   Listings: ${totalNew} new, ${totalChanged} changed, ${totalUnchanged} unchanged`);
    console.log(`   Ingesting: ${totalNew + totalChanged} listings`);

    return {
      listings: allListings,
      allSeenChecksums,
      stats: {
        total,
        new: totalNew,
        changed: totalChanged,
        unchanged: totalUnchanged,
        pagesScanned: totalPagesScanned
      }
    };
  }

  /**
   * Two-phase scrape for a single search combo.
   * Fetches ALL pages, compares checksums per page, buffers only new/changed listings.
   */
  private async scrapeSearchTwoPhase(
    search: { region: string; category: string; transaction: string },
    checksumClient: any,
    batchCreateChecksums: (listings: NehnutelnostiListing[]) => any[],
    scrapeRunId?: string,
    onBatch?: (listings: NehnutelnostiListing[]) => Promise<void>
  ): Promise<{
    listings: NehnutelnostiListing[];
    allSeenChecksums: any[];
    pagesScanned: number;
    totalPages: number;
    stats: { new: number; changed: number; unchanged: number };
  }> {
    const bufferedListings: NehnutelnostiListing[] = [];
    const allSeenChecksums: any[] = [];
    let pageNum = 1;
    let maxPages: number | null = null;
    let pagesScanned = 0;
    let statsNew = 0;
    let statsChanged = 0;
    let statsUnchanged = 0;

    while (true) {
      const url = pageNum === 1
        ? `${this.baseUrl}/${search.region}/${search.category}/${search.transaction}/`
        : `${this.baseUrl}/${search.region}/${search.category}/${search.transaction}/?p[page]=${pageNum}`;

      let pageResult: { listings: NehnutelnostiListing[]; totalCount: number | null; pageSize: number | null };
      try {
        const response = await this.client.get(url);
        pageResult = this.extractListingsFromHtml(response.data);
      } catch (error: any) {
        console.error(`    Error on page ${pageNum}: ${error.message}`);
        break;
      }

      pagesScanned++;

      const { listings: pageListings, totalCount, pageSize } = pageResult;

      if (pageListings.length === 0) {
        break;
      }

      // On first page, compute max pages
      if (pageNum === 1 && totalCount && totalCount > 0) {
        const size = pageSize || pageListings.length || 20;
        maxPages = Math.ceil(totalCount / size);
      }

      // Generate checksums for this page's listings
      const pageChecksums = batchCreateChecksums(pageListings);

      // Accumulate all seen checksums (for last_seen_at refresh of unchanged listings)
      allSeenChecksums.push(...pageChecksums);

      // Compare with DB
      const compareResult = await checksumClient.compareChecksums(pageChecksums, scrapeRunId);

      const pageNew: number = compareResult.new ?? 0;
      const pageChanged: number = compareResult.changed ?? 0;
      const pageUnchanged: number = compareResult.unchanged ?? 0;

      statsNew += pageNew;
      statsChanged += pageChanged;
      statsUnchanged += pageUnchanged;

      // Buffer only new/changed listings from this page
      const newOrChangedIds = new Set(
        compareResult.results
          .filter((r: any) => r.status === 'new' || r.status === 'changed')
          .map((r: any) => String(r.portalId))
      );
      const toBuffer = pageListings.filter(l => newOrChangedIds.has(String(l.id || l.hash_id || '')));
      if (toBuffer.length > 0) {
        if (onBatch) {
          await onBatch(toBuffer);
        } else {
          bufferedListings.push(...toBuffer);
        }
      }

      console.log(`    Page ${pageNum}: ${pageNew} new, ${pageChanged} changed, ${pageUnchanged} unchanged`);

      // Check stopping conditions
      if (maxPages !== null && pageNum >= maxPages) {
        break;
      }
      if (maxPages === null && pageListings.length < (pageSize || 20)) {
        break;
      }

      pageNum++;
      await this.delay(500);
    }

    const totalPages = maxPages ?? pageNum;

    return {
      listings: bufferedListings,
      allSeenChecksums,
      pagesScanned,
      totalPages,
      stats: { new: statsNew, changed: statsChanged, unchanged: statsUnchanged }
    };
  }

  /**
   * Scrape a specific search with pagination
   */
  private async scrapeSearch(
    search: { region: string; category: string; transaction: string },
    maxPages: number = Infinity
  ): Promise<NehnutelnostiListing[]> {
    const allListings: NehnutelnostiListing[] = [];
    let pageNum = 1;
    let calculatedMaxPages: number | null = null;

    while (pageNum <= maxPages) {
      try {
        const url = pageNum === 1
          ? `${this.baseUrl}/${search.region}/${search.category}/${search.transaction}/`
          : `${this.baseUrl}/${search.region}/${search.category}/${search.transaction}/?p[page]=${pageNum}`;

        console.log(`    Fetching page ${pageNum}...`);

        // Fetch HTML
        const response = await this.client.get(url);
        const html = response.data;

        // Extract listings and pagination info from Next.js scripts
        const { listings, totalCount, pageSize } = this.extractListingsFromHtml(html);

        if (listings.length === 0) {
          console.log(`    No more listings on page ${pageNum}`);
          break;
        }

        allListings.push(...listings);

        // On first page, compute max pages from totalCount
        if (pageNum === 1 && totalCount && totalCount > 0) {
          const size = pageSize || listings.length || 20;
          calculatedMaxPages = Math.ceil(totalCount / size);
          console.log(`    Page ${pageNum}: ${listings.length} listings (total: ${totalCount}, pages: ${calculatedMaxPages})`);
        } else {
          console.log(`    Page ${pageNum}: ${listings.length} listings`);
        }

        // Stop if we've reached the calculated last page
        if (calculatedMaxPages !== null && pageNum >= calculatedMaxPages) {
          break;
        }

        // Fallback: stop if we got fewer listings than expected (last page)
        if (calculatedMaxPages === null && listings.length < (pageSize || 20)) {
          break;
        }

        pageNum++;
        await this.delay(500);
      } catch (error: any) {
        console.error(`    Error on page ${pageNum}:`, error.message);
        break;
      }
    }

    return allListings;
  }

  /**
   * Extract listings from HTML using Cheerio
   * Returns listings plus pagination metadata from embedded Next.js JSON
   */
  extractListingsFromHtml(html: string): { listings: NehnutelnostiListing[]; totalCount: number | null; pageSize: number | null } {
    const $ = cheerio.load(html);
    const listings: any[] = [];
    let totalCount: number | null = null;
    let pageSize: number | null = null;

    try {
      // Find all script tags
      $('script').each((_, element) => {
        const scriptContent = $(element).html() || '';

        // Look for Next.js data
        if (!scriptContent.includes('self.__next_f.push')) return;

        // Look for scripts containing listing data
        const hasResults = scriptContent.includes('\\"results\\":[');
        const hasDevProjects = scriptContent.includes('\\"devProjectsInitial\\":[');

        if (!hasResults && !hasDevProjects) return;

        // Extract data chunks
        const matches = scriptContent.match(/self\.__next_f\.push\(\[[\s\S]*?\]\)/g);
        if (!matches) return;

        for (const match of matches) {
          try {
            // Extract the array content [id, "json string"]
            const arrayMatch = match.match(/\[\s*(\d+)\s*,\s*"([\s\S]*)"\s*\]/);
            if (!arrayMatch || !arrayMatch[2]) continue;

            // Unescape the JSON string
            let jsonStr: string;
            try {
              jsonStr = JSON.parse('"' + arrayMatch[2] + '"');
            } catch (e) {
              continue;
            }

            // Extract totalCount and pageSize for pagination
            if (totalCount === null && jsonStr.includes('"totalCount":')) {
              const match = jsonStr.match(/"totalCount"\s*:\s*(\d+)/);
              if (match) totalCount = parseInt(match[1], 10);
            }
            if (pageSize === null && jsonStr.includes('"pageSize":')) {
              const match = jsonStr.match(/"pageSize"\s*:\s*(\d+)/);
              if (match) pageSize = parseInt(match[1], 10);
            }

            // Extract results array (regular listings)
            if (jsonStr.includes('"results":[')) {
              const resultsStart = jsonStr.indexOf('"results":[');
              if (resultsStart !== -1) {
                const fromResults = jsonStr.substring(resultsStart + '"results":['.length);

                // Extract each {"advertisement":{...}} object
                let pos = 0;
                while (pos < fromResults.length) {
                  // Skip whitespace
                  while (pos < fromResults.length && /\s/.test(fromResults[pos])) pos++;
                  if (pos >= fromResults.length || fromResults[pos] === ']') break;

                  if (fromResults[pos] === '{') {
                    let depth = 0;
                    let inString = false;
                    let escape = false;
                    let start = pos;

                    // Find matching closing brace
                    for (let i = pos; i < fromResults.length; i++) {
                      const char = fromResults[i];

                      if (escape) {
                        escape = false;
                        continue;
                      }

                      if (char === '\\') {
                        escape = true;
                        continue;
                      }

                      if (char === '"' && !escape) {
                        inString = !inString;
                        continue;
                      }

                      if (!inString) {
                        if (char === '{') depth++;
                        if (char === '}') depth--;

                        if (depth === 0) {
                          const objStr = fromResults.substring(start, i + 1);
                          try {
                            const result = JSON.parse(objStr);
                            if (result.advertisement && result.advertisement.id) {
                              listings.push(result.advertisement);
                            }
                          } catch (e) {
                            // Skip invalid object
                          }
                          pos = i + 1;
                          break;
                        }
                      }
                    }

                    // Skip comma
                    while (pos < fromResults.length && (fromResults[pos] === ',' || /\s/.test(fromResults[pos]))) pos++;
                  } else {
                    pos++;
                  }
                }
              }
            }

            // Extract devProjectsInitial array
            if (jsonStr.includes('"devProjectsInitial":[')) {
              const devStart = jsonStr.indexOf('"devProjectsInitial":[');
              if (devStart !== -1) {
                let depth = 0;
                let inString = false;
                let escape = false;
                let arrayStart = devStart + '"devProjectsInitial":['.length;
                let arrayEnd = -1;

                for (let i = arrayStart; i < jsonStr.length; i++) {
                  const char = jsonStr[i];

                  if (escape) {
                    escape = false;
                    continue;
                  }

                  if (char === '\\') {
                    escape = true;
                    continue;
                  }

                  if (char === '"' && !escape) {
                    inString = !inString;
                    continue;
                  }

                  if (!inString) {
                    if (char === '[' || char === '{') depth++;
                    if (char === ']' || char === '}') depth--;

                    if (depth < 0) {
                      arrayEnd = i;
                      break;
                    }
                  }
                }

                if (arrayEnd !== -1) {
                  const devStr = '[' + jsonStr.substring(arrayStart, arrayEnd) + ']';
                  try {
                    const devProjects = JSON.parse(devStr);
                    devProjects.forEach((project: any) => {
                      if (project.id && project.title) {
                        listings.push(project);
                      }
                    });
                  } catch (e) {
                    // Parsing failed
                  }
                }
              }
            }
          } catch (e) {
            // Skip this chunk
          }
        }
      });
    } catch (error) {
      console.error('Error extracting listings:', error);
    }

    // Remove duplicates by id
    const uniqueListings = Array.from(
      new Map(listings.map((item: any) => [item.id, item])).values()
    );

    // Transform API format to match transformer expectations
    const transformedListings = uniqueListings.map((item: any) => ({
      id: item.id,
      hash_id: item.id,
      title: item.title,
      name: item.title,
      description: item.description,

      // Price
      price: item.price?.priceNum || item.price?.priceValue || 0,
      price_value: item.price?.priceNum || item.price?.priceValue,
      price_eur: item.price?.priceNum || item.price?.priceValue,
      currency: 'EUR',
      price_note: item.price?.price || item.priceInfo?.price,

      // Location
      locality: item.location?.name,
      address: item.location?.name,
      city: item.location?.city,
      region: item.location?.county,
      district: item.location?.district,

      // Property type & transaction
      property_type: item.parameters?.category?.mainValue?.toLowerCase(),
      category: item.parameters?.category?.mainValue?.toLowerCase(),
      transaction_type: item.transaction || item.parameters?.transaction,

      // Area
      area: item.parameters?.area || item.area,
      usable_area: item.parameters?.area || item.area,

      // Photos
      photos: item.photos?.map((p: any) => ({ url: p.url })) || [],
      images: item.photos?.map((p: any) => p.url) || [],
      image_count: item.photos?.length || 0,

      // URLs
      url: item.detailUrl || item.detail_url,
      detail_url: item.detailUrl || item.detail_url,

      // Status
      is_active: true,
      status: 'active',

      // Timestamps
      created_at: item.createdAt,
      updated_at: item.updatedAt,

      // Raw data
      _raw: item
    }));

    return { listings: transformedListings, totalCount, pageSize };
  }

  /**
   * Fetch full detail data for a listing by its URL.
   * Extracts the `advertisement` object from Next.js App Router inline scripts.
   * Returns the raw advertisement object with parameters.attributes populated.
   */
  async fetchListingDetail(url: string): Promise<Record<string, any> | null> {
    const absoluteUrl = url.startsWith('http') ? url : `${this.baseUrl}${url}`;
    try {
      const response = await this.client.get(absoluteUrl, { timeout: 20000 });
      const html: string = response.data;
      return this.extractAdvertisementFromHtml(html);
    } catch (error: any) {
      // Non-fatal: return null so the list-page data is used as fallback
      return null;
    }
  }

  /**
   * Extract the full `advertisement` object from a detail page HTML.
   * Parses self.__next_f.push([...]) inline scripts to find the object
   * that contains `"advertisement":{`.
   */
  extractAdvertisementFromHtml(html: string): Record<string, any> | null {
    // Find all self.__next_f.push([id, "..."]) blocks
    const pushPattern = /self\.__next_f\.push\(\[[\d]+\s*,\s*"((?:[^"\\]|\\[\s\S])*?)"\s*\]\)/g;
    let match: RegExpExecArray | null;

    while ((match = pushPattern.exec(html)) !== null) {
      let jsonStr: string;
      try {
        jsonStr = JSON.parse('"' + match[1] + '"');
      } catch {
        continue;
      }

      if (!jsonStr.includes('"advertisement":{')) continue;

      // Extract the advertisement object using brace-counting
      const advKey = '"advertisement":';
      const advStart = jsonStr.indexOf(advKey);
      if (advStart === -1) continue;

      const objStart = jsonStr.indexOf('{', advStart + advKey.length);
      if (objStart === -1) continue;

      let depth = 0;
      let inString = false;
      let escape = false;
      let objEnd = -1;

      for (let i = objStart; i < jsonStr.length; i++) {
        const ch = jsonStr[i];
        if (escape) { escape = false; continue; }
        if (ch === '\\') { escape = true; continue; }
        if (ch === '"') { inString = !inString; continue; }
        if (!inString) {
          if (ch === '{') depth++;
          else if (ch === '}') {
            depth--;
            if (depth === 0) { objEnd = i; break; }
          }
        }
      }

      if (objEnd === -1) continue;

      try {
        const adv = JSON.parse(jsonStr.substring(objStart, objEnd + 1));
        return adv;
      } catch {
        continue;
      }
    }

    return null;
  }

  /**
   * Enrich a listing from its detail page advertisement object.
   * Merges parameters.attributes into the listing fields.
   */
  enrichListingFromDetail(listing: NehnutelnostiListing, adv: Record<string, any>): NehnutelnostiListing {
    const params = adv.parameters || {};
    const attrs: Array<{ label: string; value: string }> = params.attributes || [];

    // Build a lowercase label → value map for easy lookup
    const attrMap: Record<string, string> = {};
    for (const attr of attrs) {
      attrMap[attr.label.toLowerCase().trim()] = attr.value;
    }

    const getAttr = (keys: string[]): string | undefined => {
      for (const k of keys) {
        const v = attrMap[k];
        if (v !== undefined) return v;
      }
      return undefined;
    };

    const parseNum = (s: string | undefined): number | undefined => {
      if (!s) return undefined;
      const m = s.replace(/\s/g, '').match(/(\d+(?:[.,]\d+)?)/);
      return m ? parseFloat(m[1].replace(',', '.')) : undefined;
    };

    // GPS coordinates from detail (more precise)
    const point = adv.location?.point;
    const coordinates = point?.latitude && point?.longitude
      ? { latitude: point.latitude, longitude: point.longitude, lat: point.latitude, lon: point.longitude }
      : undefined;

    // Floor
    const floorRaw = getAttr(['poschodie', 'floor']);
    let floor: number | undefined;
    if (floorRaw) {
      const fl = floorRaw.toLowerCase();
      if (fl.includes('prízemie') || fl.includes('prizemie')) floor = 0;
      else { const fm = fl.match(/(\d+)/); floor = fm ? parseInt(fm[1]) : undefined; }
    }

    // Total floors from "počet podlaží" or "počet poschodí"
    const totalFloorsRaw = getAttr(['počet podlaží', 'pocet podlazi', 'počet poschodí', 'pocet poschodí']);
    const totalFloors = parseNum(totalFloorsRaw);

    // Ownership
    const ownershipRaw = getAttr(['vlastníctvo', 'vlastnictvo', 'ownership']);

    // Condition - from realEstateState or attribute
    const conditionRaw = params.realEstateState || getAttr(['stav', 'condition', 'stav nehnuteľnosti']);

    // Heating
    const heatingRaw = getAttr(['vykurovanie', 'heating', 'typ vykurovania']);

    // Energy rating
    const energyRaw = getAttr(['energetická trieda', 'energeticka trieda', 'energy class', 'energetický certifikát']);

    // Construction type
    const constructionRaw = getAttr(['materiál stavby', 'material stavby', 'stavebný materiál', 'construction type']);

    // Furnished
    const furnishedRaw = getAttr(['vybavenie', 'zariadenie', 'furnished']);

    // Elevator - direct boolean from parameters
    const hasElevator: boolean | undefined = params.hasElevator;

    // Bathrooms
    const bathroomsRaw = getAttr(['kúpeľňa', 'kupelna', 'počet kúpeľní', 'bathroom']);
    const bathrooms = parseNum(bathroomsRaw);

    // Year built
    const yearBuiltRaw = getAttr(['rok výstavby', 'rok vystavby', 'year built', 'rok postavenia']);
    const yearBuilt = parseNum(yearBuiltRaw);

    // Deposit
    const depositRaw = getAttr(['kaucia', 'depozit', 'deposit']);
    const deposit = parseNum(depositRaw);

    // Parking
    const parkingRaw = getAttr(['parkovanie', 'parking', 'parkovacie miesto']);

    // Balcony, garden etc. from attributes
    const balconyRaw = getAttr(['balkón', 'balkon', 'balcony', 'loggia', 'lódžia']);
    const basementRaw = getAttr(['pivnica', 'basement', 'sklep']);
    const gardenRaw = getAttr(['záhrada', 'zahrada', 'garden']);
    const garageRaw = getAttr(['garáž', 'garaz', 'garage']);

    // Plot/land area (for houses)
    const plotAreaRaw = getAttr(['plocha pozemku', 'výmera pozemku', 'pozemok']);
    const plotArea = parseNum(plotAreaRaw);

    // Bedrooms count
    const bedroomsCountRaw = getAttr(['počet spální', 'pocet spalni']);
    const bedroomsCount = parseNum(bedroomsCountRaw);

    // Parking spaces in garage
    const parkingSpacesRaw = getAttr(['počet parkovacích miest v garáži', 'pocet parkovacich miest']);
    const parkingSpacesCount = parseNum(parkingSpacesRaw);

    // Balcony area
    const balconyAreaRaw = getAttr(['plocha balkóna', 'plocha balkona']);
    const balconyArea = parseNum(balconyAreaRaw);

    // Cellar area
    const cellarAreaRaw = getAttr(['plocha pivnice', 'plocha pivnice']);
    const cellarArea = parseNum(cellarAreaRaw);

    // Terrain
    const terrain = getAttr(['terén pozemku', 'teren pozemku']);

    // Building permit / readiness for construction
    const buildingPermit = getAttr(['pripravenosť k výstavbe', 'pripravnost k vystavbe']);

    // Land use / functional use
    const landUse = getAttr(['funkčné využitie', 'funkcne vyuzitie']);

    // Orientation
    const orientation = getAttr(['orientácia', 'orientacia']);

    // WC count
    const wcCountRaw = getAttr(['počet wc', 'pocet wc']);
    const wcCount = parseNum(wcCountRaw);

    // Year approved (kolaudácia)
    const yearApprovedRaw = getAttr(['rok kolaudácie', 'rok kolaudasie']);
    const yearApproved = parseNum(yearApprovedRaw);

    // Loggia count
    const loggiaCountRaw = getAttr(['počet loggí', 'pocet loggi']);
    const loggiaCount = parseNum(loggiaCountRaw);

    // Built-up area
    const sqmBuiltRaw = getAttr(['zastavaná plocha', 'zastavana plocha']);
    const sqmBuilt = parseNum(sqmBuiltRaw);

    // Advertiser / agency info from adv object
    const agentName: string | undefined = adv.advertiser?.name;
    const agencyName: string | undefined = adv.advertiser?.agency?.name;

    // Price per sqm
    const pricePerSqm: string | undefined = adv.price?.unitPrice;

    // Published date — use publishedAt (actual publication date) with createdAt fallback
    const publishedDate: string | undefined = adv.publishedAt ?? adv.createdAt;

    // Structured street address from location object
    const street: string | undefined = adv.location?.street;
    const streetNumber: string | undefined = adv.location?.streetNumber;

    // Advertiser type (AGENT, OWNER, DEVELOPER, etc.)
    const advertiserType: string | undefined = adv.advertiser?.type;

    // Contact fields from advertiser object
    const agentProfileUrl: string | undefined = adv.advertiser?.profileUrl || adv.advertiser?.url;
    const agencyProfileUrl: string | undefined = adv.advertiser?.agency?.profileUrl || adv.advertiser?.agency?.url;
    const agencyWebsite: string | undefined = adv.advertiser?.agency?.web || adv.advertiser?.agency?.website;
    const agencyAddressParts = adv.advertiser?.agency?.address;
    const agencyAddress: string | undefined = agencyAddressParts
      ? [agencyAddressParts.streetAddress || agencyAddressParts.street, agencyAddressParts.addressLocality || agencyAddressParts.city].filter(Boolean).join(', ')
      : undefined;
    const phonePartial: string | undefined = adv.advertiser?.phone || adv.advertiser?.phonePrefix;

    // Utility / power costs (for rentals)
    const powerCostValue: string | undefined = adv.price?.powerCosts?.value;
    const powerCostIncluded: boolean | undefined = adv.price?.powerCosts?.areIncluded;

    // Additional area measurements
    const terraceAreaRaw = getAttr(['plocha terasy', 'plocha terasy v m2']);
    const terraceArea = parseNum(terraceAreaRaw);

    const loggiaAreaRaw = getAttr(['plocha lodžie', 'plocha lodzie']);
    const loggiaArea = parseNum(loggiaAreaRaw);

    const renovationYearRaw = getAttr(['rok poslednej rekonštrukcie', 'rok poslednej rekonstrukcie']);
    const renovationYear = parseNum(renovationYearRaw);

    const plotWidthRaw = getAttr(['šírka pozemku', 'sirka pozemku']);
    const plotWidth = parseNum(plotWidthRaw);

    const plotLengthRaw = getAttr(['dĺžka pozemku', 'dlzka pozemku']);
    const plotLength = parseNum(plotLengthRaw);

    const heatSource = getAttr(['zdroj tepla', 'zdroj vykurovania']);

    const landZone = getAttr(['územie']);

    const balconyCountRaw = getAttr(['počet balkónov', 'pocet balkonov']);
    const balconyCount = parseNum(balconyCountRaw);

    const roomCountRaw = getAttr(['počet izieb / miestností', 'pocet izieb']);
    const roomCount = parseNum(roomCountRaw);

    // Utility connections (for land)
    const waterRaw = getAttr(['voda', 'vodovod', 'prípojka vody']);
    const sewageRaw = getAttr(['kanalizácia', 'kanalizacia', 'odkanalizovanie']);
    const electricityRaw = getAttr(['elektrická energia', 'elektrina', 'elektrická prípojka', 'elektrické']);
    const gasRaw = getAttr(['plyn', 'plynová prípojka']);

    // Images from detail (higher quality, full set)
    const detailImages = (adv.media?.photos || []).map((p: any) => p.origUrl || p.largeUrl || p.mediumUrl).filter(Boolean);

    return {
      ...listing,

      // Enrich coordinates
      location: coordinates
        ? { ...listing.location, latitude: coordinates.latitude, longitude: coordinates.longitude, lat: coordinates.lat, lon: coordinates.lon }
        : listing.location,
      gps: coordinates,

      // Enrich structural fields
      floor: floor ?? listing.floor,
      total_floors: totalFloors ?? listing.total_floors,

      // Enrich text fields with raw Slovak values (transformer normalizes them)
      condition: conditionRaw ?? listing.condition,
      heating: heatingRaw ?? listing.heating,
      energy_rating: energyRaw ?? listing.energy_rating,
      construction_type: constructionRaw ?? listing.construction_type,
      furnished: furnishedRaw ?? listing.furnished,
      ownership: ownershipRaw ?? listing.ownership,

      // Boolean amenities
      ...(hasElevator !== undefined ? { has_elevator: hasElevator } : {}),
      ...(balconyRaw ? { has_balcony: true } : {}),
      ...(basementRaw ? { has_basement: true } : {}),
      ...(gardenRaw ? { has_garden: true } : {}),
      ...(garageRaw ? { has_garage: true } : {}),

      // Numeric fields
      ...(bathrooms !== undefined ? { bathrooms } : {}),
      ...(yearBuilt !== undefined ? { year_built: yearBuilt } : {}),
      ...(deposit !== undefined ? { deposit } : {}),
      ...(parkingRaw ? { has_parking: true } : {}),
      ...(plotArea !== undefined ? { area_land: plotArea } : {}),

      // Utility connections (land)
      ...(waterRaw ? { water_supply: waterRaw.toLowerCase().includes('nie') ? 'none' : 'mains' } : {}),
      ...(sewageRaw ? { sewage: sewageRaw.toLowerCase().includes('nie') ? 'none' : 'mains' } : {}),
      ...(electricityRaw ? { electricity: electricityRaw.toLowerCase().includes('nie') ? 'none' : 'connected' } : {}),
      ...(gasRaw ? { gas: gasRaw.toLowerCase().includes('nie') ? 'none' : 'connected' } : {}),

      // Full description from detail (may be truncated on list page)
      ...(adv.description && typeof adv.description === 'string' ? { description: adv.description } : {}),

      // Full image set from detail
      ...(detailImages.length > 0 ? { images: detailImages } : {}),

      // Store raw detail attributes for debugging
      items: attrs.map(a => ({ name: a.label, value: a.value })),

      // New detail-enriched fields
      ...(bedroomsCount !== undefined ? { bedrooms_count: bedroomsCount } : {}),
      ...(parkingSpacesCount !== undefined ? { parking_spaces_count: parkingSpacesCount } : {}),
      ...(balconyArea !== undefined ? { balcony_area: balconyArea } : {}),
      ...(cellarArea !== undefined ? { cellar_area: cellarArea } : {}),
      ...(terrain ? { terrain } : {}),
      ...(buildingPermit ? { building_permit: buildingPermit } : {}),
      ...(landUse ? { land_use: landUse } : {}),
      ...(orientation ? { orientation } : {}),
      ...(wcCount !== undefined ? { wc_count: wcCount } : {}),
      ...(yearApproved !== undefined ? { year_approved: yearApproved } : {}),
      ...(loggiaCount !== undefined ? { loggia_count: loggiaCount } : {}),
      ...(sqmBuilt !== undefined ? { sqm_built: sqmBuilt } : {}),
      ...(agentName ? { agent_name: agentName } : {}),
      ...(agencyName ? { agency_name: agencyName } : {}),
      ...(pricePerSqm ? { price_per_sqm: pricePerSqm } : {}),
      ...(publishedDate ? { published_date: publishedDate } : {}),

      // Street address from location object
      ...(street ? { street } : {}),
      ...(streetNumber ? { street_number: streetNumber } : {}),

      // Advertiser type
      ...(advertiserType ? { advertiser_type: advertiserType } : {}),

      // Contact fields
      ...(agentProfileUrl ? { agent_profile_url: agentProfileUrl } : {}),
      ...(agencyProfileUrl ? { agency_profile_url: agencyProfileUrl } : {}),
      ...(agencyWebsite ? { agency_website: agencyWebsite } : {}),
      ...(agencyAddress ? { agency_address: agencyAddress } : {}),
      ...(phonePartial ? { phone_partial: phonePartial } : {}),

      // Utility/power costs
      ...(powerCostValue ? { utility_cost: powerCostValue } : {}),
      ...(powerCostIncluded !== undefined ? { utility_included: powerCostIncluded } : {}),

      // Additional area measurements
      ...(terraceArea !== undefined ? { terrace_area: terraceArea } : {}),
      ...(loggiaArea !== undefined ? { loggia_area: loggiaArea } : {}),
      ...(renovationYear !== undefined ? { renovation_year: renovationYear } : {}),
      ...(plotWidth !== undefined ? { plot_width: plotWidth } : {}),
      ...(plotLength !== undefined ? { plot_length: plotLength } : {}),
      ...(heatSource ? { heat_source: heatSource } : {}),
      ...(landZone ? { land_zone: landZone } : {}),
      ...(balconyCount !== undefined ? { balcony_count: balconyCount } : {}),
      ...(roomCount !== undefined ? { room_count: roomCount } : {})
    };
  }

  /**
   * Check if there's a next page
   */
  private hasNextPage(html: string): boolean {
    const $ = cheerio.load(html);

    // Look for next page button
    const nextButton = $('a[aria-label="Go to next page"], button[aria-label="Go to next page"], a.pagination-next, .pagination .next:not(.disabled)');

    return nextButton.length > 0 && !nextButton.hasClass('disabled');
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
