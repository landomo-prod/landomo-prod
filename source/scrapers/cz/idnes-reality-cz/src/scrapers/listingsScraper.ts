import * as cheerio from 'cheerio';
import { IdnesListing, ScraperConfig } from '../types/idnesTypes';
import { batchCreateIdnesChecksums } from '../utils/checksumExtractor';
import { ChecksumClient, ChecksumBatchResponse } from '@landomo/core';

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const CATEGORIES = [
  { name: 'Flats for Sale', url: 'https://reality.idnes.cz/s/prodej/byty/', type: 'sale', propertyType: 'apartment' },
  { name: 'Flats for Rent', url: 'https://reality.idnes.cz/s/pronajem/byty/', type: 'rent', propertyType: 'apartment' },
  { name: 'Houses for Sale', url: 'https://reality.idnes.cz/s/prodej/domy/', type: 'sale', propertyType: 'house' },
  { name: 'Houses for Rent', url: 'https://reality.idnes.cz/s/pronajem/domy/', type: 'rent', propertyType: 'house' },
  { name: 'Land for Sale', url: 'https://reality.idnes.cz/s/prodej/pozemky/', type: 'sale', propertyType: 'land' },
  { name: 'Land for Rent', url: 'https://reality.idnes.cz/s/pronajem/pozemky/', type: 'rent', propertyType: 'land' },
  { name: 'Commercial for Sale', url: 'https://reality.idnes.cz/s/prodej/komercni-nemovitosti/', type: 'sale', propertyType: 'commercial' },
  { name: 'Commercial for Rent', url: 'https://reality.idnes.cz/s/pronajem/komercni-nemovitosti/', type: 'rent', propertyType: 'commercial' },
  { name: 'Recreation for Sale', url: 'https://reality.idnes.cz/s/prodej/chaty-chalupy/', type: 'sale', propertyType: 'recreation' },
];

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'cs,en;q=0.5',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.text();
}

/**
 * Extract listing URLs from a category listing page
 */
async function scrapeListingPage(url: string): Promise<string[]> {
  try {
    const html = await fetchHtml(url);
    const $ = cheerio.load(html);
    const listingUrls = new Set<string>();

    // Find listing links - iDNES uses .c-products__link or links containing /detail/
    $('a.c-products__link, a[href*="/detail/"]').each((_, el) => {
      const href = $(el).attr('href');
      if (href) {
        const absoluteUrl = href.startsWith('http') ? href : `https://reality.idnes.cz${href}`;
        listingUrls.add(absoluteUrl);
      }
    });

    console.log(`   Found ${listingUrls.size} unique listing URLs`);
    return Array.from(listingUrls);
  } catch (error) {
    console.error(`Error scraping listing page ${url}:`, error);
    return [];
  }
}

/**
 * Extract detailed information from a single listing detail page
 */
async function scrapeListingDetails(url: string): Promise<Partial<IdnesListing> | null> {
  try {
    const html = await fetchHtml(url);
    const $ = cheerio.load(html);

    // Extract title
    const title = $('h1, .detail-title').first().text().trim();

    // Extract price
    const priceText = $('.price, .detail-price, .c-detail__price').first().text().trim();

    // Extract description
    const description = $('.description, .detail-description, .c-detail__description').first().text().trim();

    // Extract features
    const features: string[] = [];
    $('.features li, .detail-features li, [data-test="amenity"]').each((_, el) => {
      const text = $(el).text().trim();
      if (text) features.push(text);
    });

    // Extract images
    const images: string[] = [];
    $('.gallery img, .detail-gallery img, [data-test="image"], .c-gallery img').each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src');
      if (src && !src.includes('placeholder')) images.push(src);
    });

    // Extract property attributes/parameters
    const attributes: Record<string, string> = {};
    $('[data-test="parameter-row"], .parameter, .property-params tr, .c-detail__params tr').each((_, row) => {
      const nameEl = $(row).find('[data-test="parameter-name"], .param-name, td:first-child, th');
      const valueEl = $(row).find('[data-test="parameter-value"], .param-value, td:last-child');
      const name = nameEl.text().trim();
      const value = valueEl.text().trim();
      if (name && value && name !== value) {
        attributes[name.toLowerCase()] = value;
      }
    });

    // Extract coordinates from script tags
    let latitude: number | undefined;
    let longitude: number | undefined;

    $('script:not([src])').each((_, el) => {
      if (latitude && longitude) return;
      const content = $(el).html() || '';

      // Look for lat/lng patterns in scripts
      const latMatch = content.match(/["']?(?:latitude|lat)["']?\s*[:=]\s*([+-]?\d+\.?\d*)/i);
      const lngMatch = content.match(/["']?(?:longitude|lng)["']?\s*[:=]\s*([+-]?\d+\.?\d*)/i);
      if (latMatch && lngMatch) {
        latitude = parseFloat(latMatch[1]);
        longitude = parseFloat(lngMatch[1]);
        return;
      }

      // Object notation {lat: 50.x, lng: 14.x}
      const objMatch = content.match(/\{\s*["']?lat(?:itude)?["']?\s*[:=]\s*([+-]?\d+\.?\d*)\s*,\s*["']?(?:lng|lon(?:gitude)?)["']?\s*[:=]\s*([+-]?\d+\.?\d*)\s*\}/i);
      if (objMatch) {
        latitude = parseFloat(objMatch[1]);
        longitude = parseFloat(objMatch[2]);
      }
    });

    // Also check data attributes on map elements
    if (!latitude || !longitude) {
      const mapEl = $('[data-latitude], [data-lat]').first();
      if (mapEl.length) {
        const lat = mapEl.attr('data-latitude') || mapEl.attr('data-lat');
        const lng = mapEl.attr('data-longitude') || mapEl.attr('data-lng');
        if (lat && lng) {
          latitude = parseFloat(lat);
          longitude = parseFloat(lng);
        }
      }
    }

    // Check meta tags
    if (!latitude || !longitude) {
      const latMeta = $('meta[property="og:latitude"], meta[name="geo:latitude"]').first();
      const lngMeta = $('meta[property="og:longitude"], meta[name="geo:longitude"]').first();
      if (latMeta.length && lngMeta.length) {
        latitude = parseFloat(latMeta.attr('content') || '');
        longitude = parseFloat(lngMeta.attr('content') || '');
      }
    }

    const coordinates = (latitude && longitude && !isNaN(latitude) && !isNaN(longitude))
      ? { lat: latitude, lng: longitude }
      : undefined;

    return {
      id: url.match(/\/([a-f0-9]{24})\/?$/)?.[1] || url.match(/\/(\d+)/)?.[1] || '',
      url,
      title,
      priceText,
      description,
      features,
      images,
      coordinates,
      _attributes: Object.keys(attributes).length > 0 ? attributes : undefined,
    };
  } catch (error: any) {
    console.error(`Error scraping listing details from ${url}:`, error.message);
    return null;
  }
}

export class ListingsScraper {
  private config: ScraperConfig;

  constructor() {
    this.config = {
      headless: true,
      timeout: parseInt(process.env.TIMEOUT || '30000'),
      maxRetries: parseInt(process.env.MAX_RETRIES || '3'),
      rateLimit: parseInt(process.env.RATE_LIMIT_DELAY || '1000'),
    };
  }

  async close(): Promise<void> {
    // No-op: no browser to close with fetch-based approach
  }

  /**
   * Parse Czech property attributes from detail page into standard fields
   */
  private parseDetailAttributes(attributes: Record<string, string>): Partial<IdnesListing> {
    const result: Partial<IdnesListing> = {};
    const attrLower = Object.keys(attributes).reduce((acc, key) => {
      acc[key.toLowerCase().replace(/\s+/g, ' ')] = attributes[key];
      return acc;
    }, {} as Record<string, string>);

    if (attrLower['podlaží'] || attrLower['patro'] || attrLower['floor']) {
      const floorText = attrLower['podlaží'] || attrLower['patro'] || attrLower['floor'];
      result.floor = this.parseFloor(floorText);
    }

    if (attrLower['vlastnictví'] || attrLower['typ vlastnictví']) {
      result.ownership = attrLower['vlastnictví'] || attrLower['typ vlastnictví'];
    }

    if (attrLower['stav objektu'] || attrLower['stav']) {
      result.condition = attrLower['stav objektu'] || attrLower['stav'];
    }

    if (attrLower['vybavení'] || attrLower['vybaveno']) {
      result.furnished = attrLower['vybavení'] || attrLower['vybaveno'];
    }

    if (attrLower['penb'] || attrLower['třída penb'] || attrLower['energetická třída']) {
      result.energyRating = attrLower['penb'] || attrLower['třída penb'] || attrLower['energetická třída'];
    }

    if (attrLower['vytápění'] || attrLower['topení']) {
      result.heatingType = attrLower['vytápění'] || attrLower['topení'];
    }

    if (attrLower['typ stavby'] || attrLower['stavba']) {
      result.constructionType = attrLower['typ stavby'] || attrLower['stavba'];
    }

    return result;
  }

  private parseFloor(text?: string): number | undefined {
    if (!text) return undefined;
    const normalized = text.toLowerCase().trim();

    if (normalized.includes('přízemí')) return 0;

    const match = normalized.match(/(\d+)\.\s*(?:podlaží|patro|floor)/i);
    if (match) return parseInt(match[1]);

    const numberMatch = normalized.match(/^(\d+)/);
    if (numberMatch) return parseInt(numberMatch[1]);

    return undefined;
  }

  /**
   * Extract listings from a listing page using Cheerio
   */
  private extractListingsFromHtml(html: string): IdnesListing[] {
    const $ = cheerio.load(html);
    const listings: IdnesListing[] = [];

    // Try multiple selectors for listing items
    const selectors = ['.c-products__item', '.estate-item', '[data-dot="hp_product"]', '.property-item'];
    let items: cheerio.Cheerio<any> | null = null;

    for (const selector of selectors) {
      const found = $(selector);
      if (found.length > 0) {
        items = found;
        break;
      }
    }

    if (!items || items.length === 0) return listings;

    items.each((_, item) => {
      try {
        const $item = $(item);
        const titleEl = $item.find('.c-products__title, h2, .title').first();
        const linkEl = $item.find('a.c-products__link, a[href*="/detail/"]').first();
        const priceEl = $item.find('.c-products__price, .price').first();
        const locationEl = $item.find('.c-products__info, .location').first();
        const imageEl = $item.find('img').first();

        const title = titleEl.text().trim();
        const url = linkEl.attr('href') || '';
        const priceText = priceEl.text().trim();
        const location = locationEl.text().trim();
        const imageUrl = imageEl.attr('src') || imageEl.attr('data-src') || '';

        const areaMatch = title.match(/(\d+)\s*m²/);
        const area = areaMatch ? parseInt(areaMatch[1]) : undefined;

        const priceMatch = priceText.match(/[\d\s]+/);
        const price = priceMatch ? parseInt(priceMatch[0].replace(/\s/g, '')) : undefined;

        const idMatch = url.match(/\/([a-f0-9]{24})\/?$/);
        const id = idMatch?.[1] || $item.attr('data-id') || $item.attr('id') || '';

        if (title && url) {
          listings.push({
            id,
            title,
            url: url.startsWith('http') ? url : `https://reality.idnes.cz${url}`,
            price,
            priceText,
            location: { city: location },
            area,
            images: imageUrl ? [imageUrl] : [],
          });
        }
      } catch (err) {
        // Skip problematic items
      }
    });

    return listings;
  }

  /**
   * Scrape a specific category
   */
  private async scrapeCategory(
    url: string,
    category: string,
    maxPages: number = 10,
  ): Promise<IdnesListing[]> {
    const allListings: IdnesListing[] = [];
    const shouldFetchDetails = process.env.FETCH_DETAILS !== 'false';

    try {
      console.log(`\n📄 Scraping category: ${category}`);
      console.log(`   URL: ${url}`);
      console.log(`   Detail pages: ${shouldFetchDetails ? 'Enabled' : 'Disabled'}`);

      // Scrape first page
      const firstPageHtml = await fetchHtml(url);
      const firstPageListings = this.extractListingsFromHtml(firstPageHtml);
      console.log(`   Page 1: Found ${firstPageListings.length} listings`);
      allListings.push(...firstPageListings);

      // Paginate - check for next page link
      let currentPage = 1;
      let currentHtml = firstPageHtml;

      while (currentPage < maxPages) {
        await delay(this.config.rateLimit);

        const $ = cheerio.load(currentHtml);
        const nextLink = $('a.next, a[rel="next"], .pagination__next, [aria-label*="next"]').first();

        if (!nextLink.length) {
          console.log(`   No more pages found`);
          break;
        }

        let nextUrl = nextLink.attr('href');
        if (!nextUrl) break;

        if (!nextUrl.startsWith('http')) {
          nextUrl = `https://reality.idnes.cz${nextUrl}`;
        }

        try {
          currentHtml = await fetchHtml(nextUrl);
          currentPage++;

          const pageListings = this.extractListingsFromHtml(currentHtml);
          console.log(`   Page ${currentPage}: Found ${pageListings.length} listings`);

          if (pageListings.length === 0) {
            console.log(`   No listings on page ${currentPage}, stopping`);
            break;
          }

          allListings.push(...pageListings);
        } catch (error) {
          console.log(`   Failed to navigate to page ${currentPage + 1}`);
          break;
        }
      }

      // Fetch detail pages if enabled
      if (shouldFetchDetails && allListings.length > 0) {
        console.log(`\nFetching detail pages for ${allListings.length} listings...`);
        const enrichedListings: IdnesListing[] = [];

        for (let i = 0; i < allListings.length; i++) {
          const listing = allListings[i];
          try {
            const details = await scrapeListingDetails(listing.url);
            if (details) {
              enrichedListings.push({
                ...listing,
                ...details,
                ...(details._attributes && this.parseDetailAttributes(details._attributes)),
              });

              if ((i + 1) % 10 === 0) {
                console.log(`   Enriched ${i + 1}/${allListings.length} listings`);
              }
            } else {
              enrichedListings.push(listing);
            }
          } catch (error) {
            console.warn(`   Failed to fetch details for listing ${listing.id}`);
            enrichedListings.push(listing);
          }

          await delay(500 + Math.random() * 500);
        }

        console.log(`   Detail page enrichment complete`);
        return enrichedListings;
      }
    } catch (error: any) {
      console.error(`Error scraping category ${category}:`, error.message);
    }

    return allListings;
  }

  /**
   * Scrape all listings (sales and rentals)
   * @param onBatch - Optional streaming callback. Called after each category with that category's listings.
   */
  async scrapeAll(onBatch?: (batch: IdnesListing[]) => Promise<void>): Promise<IdnesListing[]> {
    const allListings: IdnesListing[] = [];
    if (onBatch) console.log('Streaming mode: enabled');

    try {
      const maxPages = parseInt(process.env.MAX_PAGES_PER_CATEGORY || '999999');

      console.log(`\nScraping Reality.idnes.cz`);
      console.log(`   Max pages per category: ${maxPages === 999999 ? 'unlimited' : maxPages}`);
      console.log(`   Categories: ${CATEGORIES.length}`);

      for (const category of CATEGORIES) {
        const categoryListings = await this.scrapeCategory(category.url, category.name, maxPages);

        categoryListings.forEach(listing => {
          listing.transactionType = category.type;
          listing.propertyType = category.propertyType;
        });

        allListings.push(...categoryListings);

        if (onBatch && categoryListings.length > 0) {
          try {
            await onBatch(categoryListings);
          } catch (err: any) {
            console.error(`Failed to stream batch for ${category.name}: ${err.message}`);
          }
        }

        console.log(`Category complete: ${category.name} - ${categoryListings.length} listings\n`);
      }

      console.log(`\nTotal listings scraped: ${allListings.length}`);
    } catch (error: any) {
      console.error('Error in scrapeAll:', error.message);
      throw error;
    }

    return allListings;
  }
}

/**
 * Scrape with checksum-based change detection
 */
export async function scrapeWithChecksums(
  ingestApiUrl: string,
  ingestApiKey: string,
  scrapeRunId?: string,
): Promise<{
  listings: IdnesListing[];
  stats: {
    total: number;
    new: number;
    changed: number;
    unchanged: number;
    savingsPercent: number;
  };
  comparison: ChecksumBatchResponse;
}> {
  console.log('Starting checksum-aware scraping...');

  const scraper = new ListingsScraper();
  const allListings = await scraper.scrapeAll();
  console.log(`Fetched ${allListings.length} listing pages`);

  console.log('Generating checksums...');
  const checksums = batchCreateIdnesChecksums(allListings);
  console.log(`Generated ${checksums.length} checksums`);

  console.log('Comparing checksums against database...');
  const checksumClient = new ChecksumClient(ingestApiUrl, ingestApiKey);
  const comparison = await checksumClient.compareChecksums(checksums, scrapeRunId);
  console.log(`Comparison complete: New=${comparison.new}, Changed=${comparison.changed}, Unchanged=${comparison.unchanged}`);

  const changedPortalIds = new Set(
    comparison.results
      .filter(r => r.status === 'new' || r.status === 'changed')
      .map(r => r.portalId),
  );

  const filteredListings = allListings.filter(listing => changedPortalIds.has(listing.id));
  console.log(`Filtered to ${filteredListings.length} listings needing ingestion`);

  console.log('Updating checksums...');
  await checksumClient.updateChecksums(checksums, scrapeRunId);
  console.log('Checksums updated');

  const savingsPercent = allListings.length > 0
    ? Math.round((comparison.unchanged / allListings.length) * 100)
    : 0;

  return {
    listings: filteredListings,
    stats: {
      total: allListings.length,
      new: comparison.new,
      changed: comparison.changed,
      unchanged: comparison.unchanged,
      savingsPercent,
    },
    comparison,
  };
}
