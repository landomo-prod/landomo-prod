import * as cheerio from 'cheerio';
import { closeCycleTLS } from '../utils/cycleTLS';
import { fetchWithCurlImpersonate } from '../utils/curlImpersonate';
import { getRandomUserAgent } from '../utils/userAgents';
import { RealityListing } from '../types/realityTypes';

/**
 * Reality.sk Listings Scraper
 * Uses CycleTLS (browser TLS fingerprinting) with Cheerio for HTML parsing
 */
export class ListingsScraper {
  private baseUrl = 'https://www.reality.sk';
  private categories = ['byty', 'domy', 'pozemky', 'priestory'];
  private types = ['predaj', 'prenajom'];

  // Room filters to avoid hitting 600 page limit
  private roomFilters = [
    { label: '1-room', rooms: '1' },
    { label: '2-room', rooms: '2' },
    { label: '3-room', rooms: '3' },
    { label: '4-room', rooms: '4' },
    { label: '5-room', rooms: '5' },
    { label: '6+-room', rooms: '6' }
  ];

  // Price ranges (in EUR) for byty/domy to further subdivide if needed
  private priceRanges = [
    { label: '0-50k', min: 0, max: 50000 },
    { label: '50k-100k', min: 50000, max: 100000 },
    { label: '100k-150k', min: 100000, max: 150000 },
    { label: '150k-200k', min: 150000, max: 200000 },
    { label: '200k-300k', min: 200000, max: 300000 },
    { label: '300k+', min: 300000, max: 9999999 }
  ];

  /**
   * Scrape all listings from Reality.sk
   * PARALLEL MODE with ROOM FILTERING to avoid 600 page limit
   */
  async scrapeAll(concurrency: number = 3): Promise<RealityListing[]> {
    console.log(`Starting Reality.sk scrape with room filters (${concurrency} concurrent)...`);
    const allListings: RealityListing[] = [];

    try {
      // Generate all combinations WITH room filters for byty/domy
      const combinations: Array<{category: string; type: string; roomFilter?: any}> = [];

      for (const category of this.categories) {
        for (const type of this.types) {
          if (category === 'byty' || category === 'domy') {
            // For apartments and houses, use room filters to avoid 600 page limit
            for (const roomFilter of this.roomFilters) {
              combinations.push({ category, type, roomFilter });
            }
          } else {
            // For land, no room filter needed (fewer listings)
            combinations.push({ category, type });
          }
        }
      }

      console.log(`\nTotal search combinations: ${combinations.length}`);
      console.log(`This avoids hitting the 600 page limit!\n`);

      // Process combinations in parallel batches
      const batches = this.chunkArray(combinations, concurrency);

      for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
        const batch = batches[batchIdx];
        console.log(`\nBatch ${batchIdx + 1}/${batches.length} (${batch.length} searches)...`);

        const results = await Promise.allSettled(
          batch.map(async ({ category, type, roomFilter }) => {
            try {
              const label = roomFilter
                ? `${category}/${type}/${roomFilter.label}`
                : `${category}/${type}`;
              console.log(`[${label}] Starting...`);

              const listings = await this.scrapeCategory(category, type, Infinity, roomFilter);
              console.log(`[${label}] ✅ ${listings.length} listings`);
              return listings;
            } catch (error: any) {
              const label = roomFilter
                ? `${category}/${type}/${roomFilter.label}`
                : `${category}/${type}`;
              console.error(`[${label}] ❌ ${error.message}`);
              return [];
            }
          })
        );

        // Collect results
        for (const result of results) {
          if (result.status === 'fulfilled') {
            allListings.push(...result.value);
          }
        }

        // Small delay between batches
        if (batchIdx < batches.length - 1) {
          await this.delay(1000);
        }
      }

      // Remove duplicates by ID (in case of overlap)
      const uniqueListings = Array.from(
        new Map(allListings.map(item => [item.id, item])).values()
      );

      console.log(`\n✅ Total unique listings: ${uniqueListings.length} (filtered from ${allListings.length})`);
      return uniqueListings;
    } finally {
      // Cleanup CycleTLS instance
      await closeCycleTLS();
    }
  }

  /**
   * Fetch raw HTML for a URL using curl-impersonate (real Chrome TLS fingerprint)
   */
  async fetchPage(url: string): Promise<string> {
    return fetchWithCurlImpersonate(url, {
      browser: 'chrome',
      userAgent: getRandomUserAgent()
    });
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
   * Scrape a specific category/type combination with optional room filter
   */
  private async scrapeCategory(
    category: string,
    type: string,
    maxPages: number = Infinity,
    roomFilter?: any
  ): Promise<RealityListing[]> {
    const allListings: RealityListing[] = [];
    let page = 1;

    while (page <= maxPages) {
      try {
        // Build URL with room filter if provided
        let url: string;
        if (page === 1) {
          url = roomFilter
            ? `${this.baseUrl}/${category}/${type}?rooms=${roomFilter.rooms}`
            : `${this.baseUrl}/${category}/${type}`;
        } else {
          url = roomFilter
            ? `${this.baseUrl}/${category}/${type}?rooms=${roomFilter.rooms}&page=${page}`
            : `${this.baseUrl}/${category}/${type}?page=${page}`;
        }

        console.log(`  Fetching page ${page}: ${url}`);

        // Fetch HTML using curl-impersonate (real Chrome TLS fingerprint)
        const html = await fetchWithCurlImpersonate(url, {
          browser: 'chrome',
          userAgent: getRandomUserAgent()
        });

        // Parse HTML with Cheerio
        const $ = cheerio.load(html);

        // Extract listings from page
        const listings = this.extractListingsFromHTML($ as any, category, type);

        if (listings.length === 0) {
          console.log(`  No more listings found on page ${page}`);
          break;
        }

        allListings.push(...listings);
        console.log(`  Page ${page}: ${listings.length} listings`);

        // Check if there's a next page
        const hasNextPage = $('a.next').length > 0 || $('link[rel="next"]').length > 0;
        if (!hasNextPage) {
          console.log(`  No next page link found, stopping`);
          break;
        }

        page++;

        // Minimal delay between pages (speed optimized)
        await this.delay(500 + Math.random() * 500); // 0.5-1 second
      } catch (error: any) {
        console.error(`  Error on page ${page}:`, error.message);
        break;
      }
    }

    return allListings;
  }

  /**
   * Extract listings from HTML using Cheerio
   */
  private extractListingsFromHTML(
    $: cheerio.CheerioAPI,
    category: string,
    type: string
  ): RealityListing[] {
    const listings: RealityListing[] = [];

    // Reality.sk uses .offer class for listings
    const listingElements = $('.offer');

    if (listingElements.length === 0) {
      console.warn('  No listing elements found with .offer selector');
      return listings;
    }

    console.log(`  Found ${listingElements.length} listings using selector: .offer`);

    // Extract data from each listing
    listingElements.each((index: number, element: any) => {
      try {
        const $el = $(element);

        // Extract ID from data attribute
        const id = $el.attr('data-offer-id') || `reality-${Date.now()}-${index}`;

        // Extract title and URL (title is in h2.offer-title > a or just h2.offer-title)
        const titleEl = $el.find('.offer-title');
        const title = titleEl.text().trim();
        const linkEl = $el.find('.offer-title').parent('a').length > 0
          ? $el.find('.offer-title').parent('a')
          : $el.find('a[href*="/byty/"], a[href*="/domy/"], a[href*="/pozemky/"]').first();
        const url = linkEl.attr('href');

        if (!title || !url) {
          return; // Skip if no title/url
        }

        // Make URL absolute if needed
        const fullUrl = url.startsWith('http') ? url : `${this.baseUrl}${url}`;

        // Extract price from .offer-price
        const priceEl = $el.find('.offer-price');
        const priceText = priceEl.contents().first().text().trim();
        const price = this.parsePrice(priceText);

        // Extract location from .offer-location
        const locationEl = $el.find('.offer-location');
        const location = locationEl.text().trim().replace(/^Reality\s+/i, '');

        // Extract image (check data-lazy-src first, then src)
        const imgEl = $el.find('.offer-img img').first();
        const imageUrl = imgEl.attr('data-lazy-src') || imgEl.attr('src') || undefined;

        // Extract description from .offer-desc
        const descEl = $el.find('.offer-desc');
        const description = descEl.text().trim() || undefined;

        // Extract parameters from .offer-params
        const paramsText = $el.find('.offer-params').text();

        // Extract area (sqm) - format: "56 m²"
        const sqmMatch = paramsText.match(/(\d+)\s*m[²2]/i);
        const sqm = sqmMatch ? parseInt(sqmMatch[1]) : undefined;

        // Extract rooms - format: "3 izbový byt" or just "3-izbový"
        const roomsMatch = paramsText.match(/(\d)\s*[-\s]?izbov[ýy]/i);
        const rooms = roomsMatch ? parseInt(roomsMatch[1]) : undefined;

        listings.push({
          id,
          title,
          price,
          currency: '€',
          location,
          propertyType: category,
          transactionType: type,
          url: fullUrl,
          imageUrl,
          rooms,
          sqm,
          description
        });
      } catch (error: any) {
        console.error(`  Error extracting listing ${index}:`, error.message);
      }
    });

    return listings;
  }

  /**
   * Parse price from string like "145,000 €" or "150 000 €"
   */
  private parsePrice(priceText: string): number {
    if (!priceText) return 0;

    // Slovak format uses spaces as thousands separator and comma as decimal
    // But for whole numbers, comma is used as thousands separator: "145,000 €"
    // Remove currency symbols and trim
    const cleaned = priceText
      .replace(/€/g, '')
      .trim();

    // Check if it's a decimal number (has comma followed by 1-2 digits at the end)
    const decimalMatch = cleaned.match(/^[\d\s,]+,(\d{1,2})$/);

    if (decimalMatch) {
      // It's a decimal: "1,50" or "1 234,56"
      const normalized = cleaned
        .replace(/\s/g, '')  // Remove spaces
        .replace(',', '.');   // Convert comma to decimal point
      const price = parseFloat(normalized);
      return isNaN(price) ? 0 : price;
    } else {
      // It's a whole number: "145,000" or "145 000"
      const normalized = cleaned
        .replace(/[\s,]/g, '');  // Remove all spaces and commas
      const price = parseFloat(normalized);
      return isNaN(price) ? 0 : price;
    }
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Detail page data extracted from reality.sk listing detail HTML
 */
export interface RealityDetailData {
  floor?: number;
  totalFloors?: number;
  ownership?: string;
  condition?: string;
  heating?: string;
  energyRating?: string;
  constructionType?: string;
  furnished?: string;
  bathrooms?: number;
  yearBuilt?: number;
  hasElevator?: boolean;
  hasBalcony?: boolean;
  hasBasement?: boolean;
  hasParking?: boolean;
  hasGarage?: boolean;
  hasLoggia?: boolean;
  hasTerrace?: boolean;
  hasGarden?: boolean;
  description?: string;
  images?: string[];
  // Extended fields
  sqm_plot?: number;
  sqm_built?: number;
  bedrooms_count?: number;
  terrain?: string;
  building_permit?: string;
  outdoor_parking_spaces?: number;
  orientation?: string;
  heat_source?: string;
  agent_name?: string;
  agency_profile_url?: string;
  agency_address?: string;
  phone_partial?: string;
  updated_date?: string;
  published_date?: string;
  utility_electricity?: string;
  utility_water?: string;
  utility_gas?: string;
  utility_sewage?: string;
  // New fields from deep audit
  year_approved?: number;
  renovation_year?: number;
  balcony_count?: number;
  balcony_area?: number;
  terrace_area?: number;
  loggia_area?: number;
  cellar_count?: number;
  plot_width?: number;
  plot_length?: number;
  land_zone?: string;
  road_access?: string;
  floor_position?: string;
  room_count?: number;
  property_subtype?: string;
  lat?: number;
  lon?: number;
}

/**
 * Fetch and parse a reality.sk detail page to extract structured property data.
 * Uses CycleTLS (same as list pages) and Cheerio for HTML parsing.
 */
export async function fetchListingDetail(url: string): Promise<RealityDetailData | null> {
  try {
    const html = await fetchWithCurlImpersonate(url, {
      browser: 'chrome',
      userAgent: getRandomUserAgent()
    });

    const $ = cheerio.load(html);
    const data: RealityDetailData = {};

    // Extract label-value pairs from the "Charakteristika" section
    // The detail page uses pairs of divs: label div followed by value div, separated by hr elements
    // We look for known labels and grab the next sibling value
    const charMap: Record<string, string> = {};

    // Strategy: find all text nodes that look like known labels
    // The structure is flat divs with labels like "Podlažie:", "Stav nehnuteľnosti:" etc.
    $('div').each((_: number, el: any) => {
      const text = $(el).text().trim();
      // Match label patterns ending with ":"
      if (text.endsWith(':') && text.length < 50) {
        const label = text.replace(/:$/, '').trim().toLowerCase();
        // The value is in the next sibling div
        const valueEl = $(el).next('div');
        if (valueEl.length > 0) {
          const value = valueEl.text().trim();
          if (value && value.length < 200) {
            charMap[label] = value;
          }
        }
      }
    });

    // Also try table-based layout (some detail pages use tables)
    $('table tr, table tbody tr').each((_: number, el: any) => {
      const cells = $(el).find('td, th');
      if (cells.length >= 2) {
        const label = $(cells[0]).text().trim().replace(/:$/, '').toLowerCase();
        const value = $(cells[1]).text().trim();
        if (label && value && label.length < 50 && value.length < 200) {
          charMap[label] = value;
        }
      }
    });

    // Helper to find a value by trying multiple label variants
    const getChar = (keys: string[]): string | undefined => {
      for (const k of keys) {
        if (charMap[k] !== undefined) return charMap[k];
      }
      return undefined;
    };

    const parseNum = (s: string | undefined): number | undefined => {
      if (!s) return undefined;
      const m = s.replace(/\s/g, '').match(/(\d+(?:[.,]\d+)?)/);
      return m ? parseFloat(m[1].replace(',', '.')) : undefined;
    };

    // Floor
    const floorRaw = getChar(['podlažie', 'podlazie', 'poschodie', 'floor']);
    if (floorRaw) {
      const fl = floorRaw.toLowerCase();
      if (fl.includes('prízemie') || fl.includes('prizemie')) {
        data.floor = 0;
      } else {
        data.floor = parseNum(floorRaw);
      }
    }

    // Total floors
    const totalFloorsRaw = getChar(['počet nadzemných podlaží', 'pocet nadzemnych podlazi', 'počet podlaží', 'pocet podlazi', 'počet poschodí']);
    data.totalFloors = parseNum(totalFloorsRaw);

    // Condition
    const conditionRaw = getChar(['stav nehnuteľnosti', 'stav nehnutelnosti', 'stav']);
    if (conditionRaw) data.condition = conditionRaw;

    // Construction type
    const constructionRaw = getChar(['typ konštrukcie', 'typ konstrukcie', 'materiál', 'material', 'stavba']);
    if (constructionRaw) data.constructionType = constructionRaw;

    // Year built
    const yearRaw = getChar(['rok výstavby', 'rok vystavby', 'rok kolaudácie', 'rok kolaudacie']);
    data.yearBuilt = parseNum(yearRaw);

    // Heating
    const heatingRaw = getChar(['vykurovanie', 'kúrenie', 'kurenie', 'typ vykurovania']);
    if (heatingRaw) data.heating = heatingRaw;

    // Energy rating
    const energyRaw = getChar(['energetický certifikát budovy', 'energeticky certifikat budovy', 'energetická trieda', 'energeticka trieda']);
    if (energyRaw && energyRaw.toLowerCase() !== 'nie je') {
      // Extract letter grade if present
      const gradeMatch = energyRaw.match(/([A-Ga-g])\b/);
      if (gradeMatch) data.energyRating = gradeMatch[1].toUpperCase();
    }

    // Furnished
    const furnishedRaw = getChar(['zariadenie', 'vybavenie', 'zariadený', 'zariadeny']);
    if (furnishedRaw) data.furnished = furnishedRaw;

    // Ownership
    const ownershipRaw = getChar(['vlastníctvo', 'vlastnictvo', 'druh vlastníctva']);
    if (ownershipRaw) data.ownership = ownershipRaw;

    // Bathrooms
    const bathroomsRaw = getChar(['kúpeľňa', 'kupelna', 'počet kúpeľní', 'pocet kupelni']);
    data.bathrooms = parseNum(bathroomsRaw);

    // Full description from detail page
    const descEl = $('div').filter((_: number, el: any) => {
      const text = $(el).text().trim();
      return text.length > 200 && !text.includes('<!DOCTYPE');
    }).first();
    // Look for the main description block (typically the longest text block in the info section)
    // The description is inside a div that follows the "Info" heading
    const infoSection = $('div:contains("Info")').parent().find('div').filter((_: number, el: any) => {
      return $(el).text().trim().length > 100;
    });
    if (infoSection.length > 0) {
      const descText = infoSection.first().text().trim();
      if (descText.length > 50) {
        data.description = descText;
      }
    }

    // Images, amenityFeature, agent, and portal_id from JSON-LD schemas
    $('script[type="application/ld+json"]').each((_: number, el: any) => {
      try {
        const json = JSON.parse($(el).html() || '');

        // Product schema: images, agent name
        if (json['@type'] === 'Product') {
          if (Array.isArray(json.image)) {
            data.images = json.image.map((url: string) => url.replace(/&amp;/g, '&'));
          }
          const sellerName = json?.offers?.seller?.name;
          if (sellerName) data.agent_name = String(sellerName);
        }

        // Residence/house schemas: GPS coordinates from geo property
        const geoTypes = ['SingleFamilyResidence', 'Residence', 'House', 'Accommodation', 'Place'];
        if (geoTypes.includes(json['@type']) && json.geo) {
          const lat = parseFloat(json.geo.latitude);
          const lon = parseFloat(json.geo.longitude);
          if (!isNaN(lat) && !isNaN(lon)) {
            data.lat = data.lat ?? lat;
            data.lon = data.lon ?? lon;
          }
        }

        // Accommodation/house schema: amenityFeature array
        const accommodationTypes = ['Accommodation', 'SingleFamilyResidence', 'Residence', 'House'];
        if (accommodationTypes.includes(json['@type']) && Array.isArray(json.amenityFeature)) {
          const parseAmenityNum = (val: any): number | undefined => {
            if (val === undefined || val === null) return undefined;
            const s = String(val).replace(/\s/g, '').replace(',', '.');
            const m = s.match(/(\d+(?:\.\d+)?)/);
            return m ? parseFloat(m[1]) : undefined;
          };

          for (const feature of json.amenityFeature) {
            const name: string = (feature.name || '').trim();
            const value: any = feature.value;
            const valueStr: string = value !== undefined && value !== null ? String(value).trim() : '';

            switch (name) {
              case 'Vlastníctvo':
                data.ownership = valueStr || data.ownership;
                break;
              case 'Zariadenie':
              case 'Vybavenie objektu':
                data.furnished = valueStr || data.furnished;
                break;
              case 'Plocha pozemku':
                data.sqm_plot = parseAmenityNum(value) ?? data.sqm_plot;
                break;
              case 'Zastavaná plocha':
                data.sqm_built = parseAmenityNum(value) ?? data.sqm_built;
                break;
              case 'Počet spální':
                data.bedrooms_count = parseAmenityNum(value) ?? data.bedrooms_count;
                break;
              case 'Terén pozemku':
                data.terrain = valueStr || data.terrain;
                break;
              case 'Pripravenosť k výstavbe':
                data.building_permit = valueStr || data.building_permit;
                break;
              case 'Elektrina':
                data.utility_electricity = valueStr || data.utility_electricity;
                break;
              case 'Voda':
                data.utility_water = valueStr || data.utility_water;
                break;
              case 'Plyn':
                data.utility_gas = valueStr || data.utility_gas;
                break;
              case 'Odpadové vody':
                data.utility_sewage = valueStr || data.utility_sewage;
                break;
              case 'Počet vonkajších parkovacích miest':
                data.outdoor_parking_spaces = parseAmenityNum(value) ?? data.outdoor_parking_spaces;
                break;
              case 'Orientácia':
                data.orientation = valueStr || data.orientation;
                break;
              case 'Zdroj tepla':
                data.heat_source = valueStr || data.heat_source;
                break;
              case 'Rok kolaudácie':
                data.year_approved = parseAmenityNum(value) ?? data.year_approved;
                break;
              case 'Rok poslednej rekonštrukcie':
                data.renovation_year = parseAmenityNum(value) ?? data.renovation_year;
                break;
              case 'Počet balkónov':
                data.balcony_count = parseAmenityNum(value) ?? data.balcony_count;
                break;
              case 'Plocha balkónu v m2':
                data.balcony_area = parseAmenityNum(value) ?? data.balcony_area;
                break;
              case 'Plocha terasy v m2':
                data.terrace_area = parseAmenityNum(value) ?? data.terrace_area;
                break;
              case 'Plocha lodžie':
                data.loggia_area = parseAmenityNum(value) ?? data.loggia_area;
                break;
              case 'Počet pivníc':
                data.cellar_count = parseAmenityNum(value) ?? data.cellar_count;
                break;
              case 'Šírka pozemku':
                data.plot_width = parseAmenityNum(value) ?? data.plot_width;
                break;
              case 'Dĺžka pozemku':
                data.plot_length = parseAmenityNum(value) ?? data.plot_length;
                break;
              case 'Územie':
                data.land_zone = valueStr || data.land_zone;
                break;
              case 'Prístupová komunikácia':
                data.road_access = valueStr || data.road_access;
                break;
              case 'Umiestnenie':
                data.floor_position = valueStr || data.floor_position;
                break;
              case 'Počet izieb / miestností':
                data.room_count = parseAmenityNum(value) ?? data.room_count;
                break;
              case 'Počet kúpeľní':
                data.bathrooms = parseAmenityNum(value) ?? data.bathrooms;
                break;
              case 'Druh domu':
                data.property_subtype = data.property_subtype || valueStr;
                break;
            }
          }
        }

        // Extract property_subtype from "Základné informácie" section: 'Druh' label
        if (json['@type'] === 'Accommodation' || json['@type'] === 'Product') {
          // property_subtype sourced from HTML below
        }
      } catch { /* ignore */ }
    });

    // Extract agency profile URL from link to /realitna-kancelaria/
    const agencyLink = $('a[href*="/realitna-kancelaria/"]').first();
    if (agencyLink.length > 0) {
      const href = agencyLink.attr('href');
      if (href) {
        data.agency_profile_url = href.startsWith('http') ? href : `https://www.reality.sk${href}`;
      }
    }

    // Extract agency address from contact/seller section
    const agencyAddressEl = $('a[href*="/realitna-kancelaria/"]').closest('.contact-box, .seller-info, .agent-card, div').find('.address, .agency-address');
    if (agencyAddressEl.length > 0) {
      const addr = agencyAddressEl.first().text().trim();
      if (addr) data.agency_address = addr;
    }
    // Fallback: look for address text near the agency link
    if (!data.agency_address && agencyLink.length > 0) {
      const parentBlock = agencyLink.closest('div');
      if (parentBlock.length > 0) {
        // Look for address-like text in sibling elements
        parentBlock.find('span, div, p').each((_: number, el: any) => {
          const text = $(el).text().trim();
          // Match Slovak address patterns (street + city or postal code)
          if (!data.agency_address && text.length > 5 && text.length < 150 && /\d{3}\s?\d{2}/.test(text)) {
            data.agency_address = text;
          }
        });
      }
    }

    // Extract partial phone number from tel: links
    $('a[href^="tel:"]').each((_: number, el: any) => {
      if (!data.phone_partial) {
        const tel = $(el).attr('href')?.replace('tel:', '').trim();
        if (tel) data.phone_partial = tel;
      }
    });
    // Fallback: look for phone text with +421 prefix
    if (!data.phone_partial) {
      $('*').contents().filter(function(this: any) {
        return this.type === 'text';
      }).each((_: number, node: any) => {
        if (!data.phone_partial) {
          const text = (node.data || '').trim();
          const phoneMatch = text.match(/(\+421[\s\d]{3,})/);
          if (phoneMatch) data.phone_partial = phoneMatch[1].trim();
        }
      });
    }

    // Extract property_subtype from "Základné informácie" HTML section (Druh label)
    $('*').filter((_: number, el: any) => {
      const text = $(el).children().length === 0 ? $(el).text().trim() : '';
      return text === 'Druh';
    }).each((_: number, el: any) => {
      const valueEl = $(el).next();
      if (valueEl.length > 0) {
        const val = valueEl.text().trim();
        if (val && val.length < 100) {
          data.property_subtype = data.property_subtype || val;
        }
      }
    });

    // Extract published/updated dates from HTML text
    // Formats: "Aktualizovaný: 15. 01. 2026" and "1. publikácia: 10. 12. 2025"
    const datePattern = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/;
    $('*').contents().filter(function(this: any) {
      return this.type === 'text';
    }).each((_: number, node: any) => {
      const text = (node.data || '').trim();
      const updatedMatch = text.match(/[Aa]ktualizovan[yý][:\s]+(.+)/);
      if (updatedMatch) {
        const dm = updatedMatch[1].match(datePattern);
        if (dm) {
          data.updated_date = `${dm[3]}-${dm[2].padStart(2, '0')}-${dm[1].padStart(2, '0')}`;
        }
      }
      const publishedMatch = text.match(/1\.\s*publik[aá]cia[:\s]+(.+)/i);
      if (publishedMatch) {
        const dm = publishedMatch[1].match(datePattern);
        if (dm) {
          data.published_date = `${dm[3]}-${dm[2].padStart(2, '0')}-${dm[1].padStart(2, '0')}`;
        }
      }
    });

    // Amenities from description text
    const allText = [data.description, data.condition, data.furnished].filter(Boolean).join(' ').toLowerCase();
    if (allText.includes('výťah') || allText.includes('vytah')) data.hasElevator = true;
    if (allText.includes('balkón') || allText.includes('balkon')) data.hasBalcony = true;
    if (allText.includes('pivnic') || allText.includes('suterén')) data.hasBasement = true;
    if (allText.includes('parking') || allText.includes('parkovanie') || allText.includes('parkovac')) data.hasParking = true;
    if (allText.includes('garáž') || allText.includes('garaz')) data.hasGarage = true;
    if (allText.includes('loggia') || allText.includes('lódži')) data.hasLoggia = true;
    if (allText.includes('terasa') || allText.includes('terasou')) data.hasTerrace = true;
    if (allText.includes('záhrad') || allText.includes('zahrad')) data.hasGarden = true;

    return data;
  } catch (error: any) {
    console.warn(`  Detail fetch failed for ${url}: ${error.message}`);
    return null;
  }
}

/**
 * Enrich a RealityListing with data from its detail page.
 * Detail data takes priority over list page data (more accurate/complete).
 */
export function enrichListingFromDetail(listing: RealityListing, detail: RealityDetailData): RealityListing {
  return {
    ...listing,
    // Structural fields from detail (override list page text extraction)
    floor: detail.floor ?? listing.floor,
    totalFloors: detail.totalFloors ?? listing.totalFloors,
    condition: detail.condition ?? listing.condition,
    heating: detail.heating ?? listing.heating,
    energyRating: detail.energyRating ?? listing.energyRating,
    constructionType: detail.constructionType ?? listing.constructionType,
    furnished: detail.furnished ?? listing.furnished,
    ownership: detail.ownership ?? listing.ownership,
    yearBuilt: detail.yearBuilt ?? listing.yearBuilt,
    bathrooms: detail.bathrooms ?? listing.bathrooms,
    // Boolean amenities (true from detail overrides)
    hasElevator: detail.hasElevator || listing.hasElevator,
    hasBalcony: detail.hasBalcony || listing.hasBalcony,
    hasBasement: detail.hasBasement || listing.hasBasement,
    hasParking: detail.hasParking || listing.hasParking,
    hasGarage: detail.hasGarage || listing.hasGarage,
    hasLoggia: detail.hasLoggia || listing.hasLoggia,
    hasTerrace: detail.hasTerrace || listing.hasTerrace,
    hasGarden: detail.hasGarden || listing.hasGarden,
    // Full description from detail (typically longer/more complete)
    description: detail.description || listing.description,
    // Full image set from detail
    images: detail.images && detail.images.length > 0 ? detail.images : listing.images,
    // Extended detail fields
    sqm_plot: detail.sqm_plot ?? listing.sqm_plot,
    sqm_built: detail.sqm_built ?? listing.sqm_built,
    bedrooms_count: detail.bedrooms_count ?? listing.bedrooms_count,
    terrain: detail.terrain ?? listing.terrain,
    building_permit: detail.building_permit ?? listing.building_permit,
    outdoor_parking_spaces: detail.outdoor_parking_spaces ?? listing.outdoor_parking_spaces,
    orientation: detail.orientation ?? listing.orientation,
    heat_source: detail.heat_source ?? listing.heat_source,
    agent_name: detail.agent_name ?? listing.agent_name,
    agency_profile_url: detail.agency_profile_url ?? listing.agency_profile_url,
    agency_address: detail.agency_address ?? listing.agency_address,
    phone_partial: detail.phone_partial ?? listing.phone_partial,
    updated_date: detail.updated_date ?? listing.updated_date,
    published_date: detail.published_date ?? listing.published_date,
    utility_electricity: detail.utility_electricity ?? listing.utility_electricity,
    utility_water: detail.utility_water ?? listing.utility_water,
    utility_gas: detail.utility_gas ?? listing.utility_gas,
    utility_sewage: detail.utility_sewage ?? listing.utility_sewage,
    // New fields from deep audit
    year_approved: detail.year_approved ?? listing.year_approved,
    renovation_year: detail.renovation_year ?? listing.renovation_year,
    balcony_count: detail.balcony_count ?? listing.balcony_count,
    balcony_area: detail.balcony_area ?? listing.balcony_area,
    terrace_area: detail.terrace_area ?? listing.terrace_area,
    loggia_area: detail.loggia_area ?? listing.loggia_area,
    cellar_count: detail.cellar_count ?? listing.cellar_count,
    plot_width: detail.plot_width ?? listing.plot_width,
    plot_length: detail.plot_length ?? listing.plot_length,
    land_zone: detail.land_zone ?? listing.land_zone,
    road_access: detail.road_access ?? listing.road_access,
    floor_position: detail.floor_position ?? listing.floor_position,
    room_count: detail.room_count ?? listing.room_count,
    property_subtype: detail.property_subtype ?? listing.property_subtype,
    lat: detail.lat ?? listing.lat,
    lon: detail.lon ?? listing.lon,
  };
}

/**
 * Simple semaphore for limiting concurrent async tasks.
 */
function createSemaphore(max: number) {
  let active = 0;
  const queue: Array<() => void> = [];
  return {
    async acquire() {
      if (active < max) { active++; return; }
      await new Promise<void>(resolve => queue.push(resolve));
      active++;
    },
    release() {
      active--;
      if (queue.length > 0) queue.shift()!();
    }
  };
}

/**
 * Two-phase scrape: scan ALL pages with per-page checksum comparison,
 * buffer only new/changed listings, then return them for ingestion.
 */
export async function scrapeAllTwoPhase(
  checksumClient: any,
  scrapeRunId?: string,
  onBatch?: (listings: RealityListing[]) => Promise<void>
): Promise<{
  listings: RealityListing[];
  allSeenChecksums: any[];
  stats: {
    total: number;
    new: number;
    changed: number;
    unchanged: number;
    pagesScanned: number;
  };
}> {
  const { batchCreateRealityChecksums } = await import('../utils/checksumExtractor');

  console.log('\nStarting Reality.sk two-phase scrape...');

  const scraper = new ListingsScraper();

  const bufferedListings: RealityListing[] = [];
  const allSeenChecksums: any[] = [];
  let totalSeen = 0;
  let totalNew = 0;
  let totalChanged = 0;
  let totalUnchanged = 0;
  let pagesScanned = 0;

  const baseUrl = 'https://www.reality.sk';
  const categories = ['byty', 'domy', 'pozemky', 'priestory'];
  const types = ['predaj', 'prenajom'];
  const roomFilters = [
    { label: '1-room', rooms: '1' },
    { label: '2-room', rooms: '2' },
    { label: '3-room', rooms: '3' },
    { label: '4-room', rooms: '4' },
    { label: '5-room', rooms: '5' },
    { label: '6+-room', rooms: '6' }
  ];

  // Build combinations (same as scrapeAll)
  const combinations: Array<{ category: string; type: string; roomFilter?: { label: string; rooms: string } }> = [];
  for (const category of categories) {
    for (const type of types) {
      if (category === 'byty' || category === 'domy') {
        for (const roomFilter of roomFilters) {
          combinations.push({ category, type, roomFilter });
        }
      } else {
        combinations.push({ category, type });
      }
    }
  }

  console.log(`Total search combinations: ${combinations.length}`);

  const CATEGORY_CONCURRENCY = parseInt(process.env.CATEGORY_CONCURRENCY || '1');
  const semaphore = createSemaphore(CATEGORY_CONCURRENCY);

  console.log(`Running up to ${CATEGORY_CONCURRENCY} categories concurrently`);

  const comboPromises = combinations.map(async ({ category, type, roomFilter }) => {
    // Stagger combo starts to avoid simultaneous page-1 requests
    const staggerDelay = Math.floor(Math.random() * 2000);
    await new Promise(resolve => setTimeout(resolve, staggerDelay));
    await semaphore.acquire();
    try {
      const label = roomFilter
        ? `${category}/${type}/${roomFilter.label}`
        : `${category}/${type}`;

      console.log(`\n[${label}] Starting two-phase scan...`);

      let page = 1;
      const comboBuffered: RealityListing[] = [];
      // Track IDs seen in this combo to detect when reality.sk cycles back to
      // already-seen listings (it never removes the "next" link when exhausted).
      const seenIds = new Set<string>();

      while (true) {
        // Build URL (same logic as scrapeCategory)
        let url: string;
        if (page === 1) {
          url = roomFilter
            ? `${baseUrl}/${category}/${type}?rooms=${roomFilter.rooms}`
            : `${baseUrl}/${category}/${type}`;
        } else {
          url = roomFilter
            ? `${baseUrl}/${category}/${type}?rooms=${roomFilter.rooms}&page=${page}`
            : `${baseUrl}/${category}/${type}?page=${page}`;
        }

        console.log(`  [${label}] Fetching page ${page}: ${url}`);

        let html: string;
        try {
          html = await (scraper as any).fetchPage(url);
        } catch (err: any) {
          console.error(`  [${label}] Fetch error on page ${page}:`, err.message);
          break;
        }

        // Accumulate pagesScanned (safe: JS single-threaded, atomic increment)
        pagesScanned++;

        const cheerio = await import('cheerio');
        const $ = cheerio.load(html);
        const pageListings = (scraper as any).extractListingsFromHTML($, category, type) as RealityListing[];

        if (pageListings.length === 0) {
          const title = $('title').text();
          const htmlLength = $.html().length;
          if (/Attention|moment|Access denied|Cloudflare|Robot/i.test(title) || htmlLength < 1000) {
            console.warn(`  [${label}] Bot-detection page on page ${page} (title: "${title}", html length: ${htmlLength}), stopping`);
          } else {
            console.log(`  [${label}] No listings on page ${page}, stopping`);
          }
          break;
        }

        // Filter to only listings not yet seen in this combo run.
        // reality.sk never removes the "next" link when results are exhausted —
        // it cycles back to already-seen listings, so this is our stop signal.
        const newPageListings = pageListings.filter(l => !seenIds.has(l.id));
        if (newPageListings.length === 0) {
          console.log(`  [${label}] All listings on page ${page} already seen, stopping`);
          break;
        }
        newPageListings.forEach(l => seenIds.add(l.id));

        totalSeen += newPageListings.length;

        // Checksum comparison for this page
        const pageChecksums = batchCreateRealityChecksums(newPageListings);

        // Accumulate all seen checksums (JS push is safe in single-threaded async context)
        allSeenChecksums.push(...pageChecksums);

        let comparison: { new: number; changed: number; unchanged: number; results: Array<{ portalId: string; status: string }> };
        try {
          comparison = await checksumClient.compareChecksums(pageChecksums, scrapeRunId);
        } catch (err: any) {
          console.error(`  [${label}] Checksum compare failed on page ${page}:`, err.message);
          // Treat as all-new on failure (safe fallback)
          comparison = {
            new: newPageListings.length,
            changed: 0,
            unchanged: 0,
            results: newPageListings.map(l => ({ portalId: l.id, status: 'new' }))
          };
        }

        totalNew += comparison.new;
        totalChanged += comparison.changed;
        totalUnchanged += comparison.unchanged;

        console.log(`  [${label}] Page ${page}: new=${comparison.new}, changed=${comparison.changed}, unchanged=${comparison.unchanged}`);

        // Buffer/ingest only new/changed listings per page
        if (comparison.new > 0 || comparison.changed > 0) {
          const changedIds = new Set(
            comparison.results
              .filter((r: any) => r.status !== 'unchanged')
              .map((r: any) => r.portalId)
          );
          const pageChanged = newPageListings.filter(l => changedIds.has(l.id));
          if (pageChanged.length > 0) {
            if (onBatch) {
              await onBatch(pageChanged);
            } else {
              comboBuffered.push(...pageChanged);
            }
          }
        }

        // Check for next page
        const hasNextPage = ($('a.next') as any).length > 0 || ($('link[rel="next"]') as any).length > 0;
        if (!hasNextPage) {
          console.log(`  [${label}] No next page, stopping`);
          break;
        }

        page++;
        // Respectful delay to avoid WAF rate-limiting (2-4 seconds per page)
        await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 2000));
      }

      if (!onBatch && comboBuffered.length > 0) {
        bufferedListings.push(...comboBuffered);
      }

      // Inter-combo cooldown: give the WAF rate limit time to reset (10-20s)
      const comboCooldown = 10000 + Math.random() * 10000;
      console.log(`  [${label}] Combo done. Cooldown ${Math.round(comboCooldown / 1000)}s before next...`);
      await new Promise(resolve => setTimeout(resolve, comboCooldown));
    } finally {
      semaphore.release();
    }
  });

  try {
    await Promise.all(comboPromises);
  } finally {
    const { closeCycleTLS } = await import('../utils/cycleTLS');
    await closeCycleTLS();
  }

  // Deduplicate buffered listings by ID
  const uniqueListings = Array.from(
    new Map(bufferedListings.map(l => [l.id, l])).values()
  );

  console.log(`\nTwo-phase scan complete:`);
  console.log(`  Total seen: ${totalSeen}`);
  console.log(`  New: ${totalNew}`);
  console.log(`  Changed: ${totalChanged}`);
  console.log(`  Unchanged: ${totalUnchanged}`);
  console.log(`  Pages scanned: ${pagesScanned}`);
  console.log(`  Buffered for ingestion: ${uniqueListings.length}`);

  return {
    listings: uniqueListings,
    allSeenChecksums,
    stats: {
      total: totalSeen,
      new: totalNew,
      changed: totalChanged,
      unchanged: totalUnchanged,
      pagesScanned
    }
  };
}

/**
 * Scrape with checksum-based change detection
 * Returns only new or changed listings based on ChecksumClient comparison
 */
export async function scrapeWithChecksums(
  ingestApiUrl: string,
  ingestApiKey: string,
  scrapeRunId?: string
): Promise<{
  listings: RealityListing[];
  stats: {
    total: number;
    new: number;
    changed: number;
    unchanged: number;
    savingsPercent: number;
  };
}> {
  const { ChecksumClient } = await import('@landomo/core');
  const { batchCreateRealityChecksums } = await import('../utils/checksumExtractor');

  console.log('\n🔍 Starting checksum-based scrape...');

  const scraper = new ListingsScraper();

  // Scrape all listings
  const allListings = await scraper.scrapeAll();
  console.log(`\n📊 Scraped ${allListings.length} total listings`);

  // Create checksums
  const checksums = batchCreateRealityChecksums(allListings);
  console.log(`\n🔐 Created ${checksums.length} checksums`);

  // Compare with database in batches to avoid payload size issues
  const checksumClient = new ChecksumClient(ingestApiUrl, ingestApiKey);
  const CHECKSUM_BATCH_SIZE = 1000; // Batch size for checksum comparison
  let totalNew = 0;
  let totalChanged = 0;
  let totalUnchanged = 0;
  const allResults: any[] = [];

  console.log(`\n🔄 Comparing checksums in batches of ${CHECKSUM_BATCH_SIZE}...`);
  for (let i = 0; i < checksums.length; i += CHECKSUM_BATCH_SIZE) {
    const batch = checksums.slice(i, i + CHECKSUM_BATCH_SIZE);
    const batchNum = Math.floor(i / CHECKSUM_BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(checksums.length / CHECKSUM_BATCH_SIZE);

    console.log(`  Batch ${batchNum}/${totalBatches}: Comparing ${batch.length} checksums...`);

    try {
      const comparison = await checksumClient.compareChecksums(batch, scrapeRunId);
      totalNew += comparison.new;
      totalChanged += comparison.changed;
      totalUnchanged += comparison.unchanged;
      allResults.push(...comparison.results);

      console.log(`    ✓ New: ${comparison.new}, Changed: ${comparison.changed}, Unchanged: ${comparison.unchanged}`);
    } catch (error: any) {
      console.error(`    ✗ Batch ${batchNum} failed:`, error.message);
      // Continue with next batch even if one fails
    }

    // Small delay between batches
    if (i + CHECKSUM_BATCH_SIZE < checksums.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  console.log(`\n✅ Checksum comparison complete:`);
  console.log(`  - New: ${totalNew}`);
  console.log(`  - Changed: ${totalChanged}`);
  console.log(`  - Unchanged: ${totalUnchanged}`);

  // Filter to only new/changed listings
  const changedPortalIds = new Set(
    allResults
      .filter(r => r.status === 'new' || r.status === 'changed')
      .map(r => r.portalId)
  );

  const filteredListings = allListings.filter(listing => changedPortalIds.has(listing.id));

  console.log(`\n💾 Filtered to ${filteredListings.length} listings needing ingestion`);

  // Update checksums in batches
  console.log('\n🔄 Updating checksums...');
  const updatedChecksums = batchCreateRealityChecksums(filteredListings);

  for (let i = 0; i < updatedChecksums.length; i += CHECKSUM_BATCH_SIZE) {
    const batch = updatedChecksums.slice(i, i + CHECKSUM_BATCH_SIZE);
    const batchNum = Math.floor(i / CHECKSUM_BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(updatedChecksums.length / CHECKSUM_BATCH_SIZE);

    console.log(`  Batch ${batchNum}/${totalBatches}: Updating ${batch.length} checksums...`);

    try {
      await checksumClient.updateChecksums(batch, scrapeRunId);
      console.log(`    ✓ Updated ${batch.length} checksums`);
    } catch (error: any) {
      console.error(`    ✗ Batch ${batchNum} failed:`, error.message);
      // Continue with next batch even if one fails
    }

    // Small delay between batches
    if (i + CHECKSUM_BATCH_SIZE < updatedChecksums.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  console.log(`✅ Updated ${updatedChecksums.length} checksums in database`);

  const savingsPercent = allListings.length > 0
    ? Math.round((totalUnchanged / allListings.length) * 100)
    : 0;

  console.log(`\n📊 Checksum Results:`);
  console.log(`  Total: ${allListings.length}`);
  console.log(`  New: ${totalNew}`);
  console.log(`  Changed: ${totalChanged}`);
  console.log(`  Unchanged: ${totalUnchanged} (skipped)`);
  console.log(`  Savings: ${savingsPercent}%`);

  return {
    listings: filteredListings,
    stats: {
      total: allListings.length,
      new: totalNew,
      changed: totalChanged,
      unchanged: totalUnchanged,
      savingsPercent
    }
  };
}
