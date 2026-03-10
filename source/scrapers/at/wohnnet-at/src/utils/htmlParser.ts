import * as cheerio from 'cheerio';
import { WohnnetListing, WohnnetJsonLd, WohnnetDetailResponse, WohnnetPaginationMeta } from '../types/wohnnetTypes';

/**
 * Extract JSON-LD structured data from HTML
 */
export function extractJsonLd(html: string): WohnnetJsonLd | null {
  const $ = cheerio.load(html);
  const jsonLdScripts = $('script[type="application/ld+json"]');

  for (let i = 0; i < jsonLdScripts.length; i++) {
    try {
      const scriptContent = $(jsonLdScripts[i]).html();
      if (!scriptContent) continue;

      const jsonLd = JSON.parse(scriptContent);

      // Look for RealEstateListinggetRandomUserAgent or Product schema
      if (jsonLd['@type'] === 'RealEstateListing' ||
          jsonLd['@type'] === 'Product' ||
          jsonLd['@type'] === 'Apartment' ||
          jsonLd['@type'] === 'House' ||
          jsonLd['@type'] === 'Residence') {
        return jsonLd;
      }

      // Handle arrays of JSON-LD objects
      if (Array.isArray(jsonLd)) {
        const listing = jsonLd.find(item =>
          item['@type'] === 'RealEstateListing' ||
          item['@type'] === 'Product' ||
          item['@type'] === 'Apartment' ||
          item['@type'] === 'House'
        );
        if (listing) return listing;
      }
    } catch (error) {
      console.warn('Failed to parse JSON-LD:', (error as Error).message);
    }
  }

  return null;
}

/**
 * Parse listings from search results page
 */
export function parseListingsPage(html: string, pageNumber: number): WohnnetListing[] {
  const $ = cheerio.load(html);
  const listings: WohnnetListing[] = [];

  // Common selectors for real estate listing cards
  const listingSelectors = [
    '.property-item',
    '.listing-item',
    '.immobilie-item',
    '.real-estate-item',
    'article.listing',
    '.property-card',
    '[data-property-id]',
    '[data-listing-id]'
  ];

  let listingElements = $();

  // Try each selector until we find listings
  for (const selector of listingSelectors) {
    listingElements = $(selector);
    if (listingElements.length > 0) {
      console.log(`Found ${listingElements.length} listings using selector: ${selector}`);
      break;
    }
  }

  // If no specific listing cards found, try to find links to detail pages
  if (listingElements.length === 0) {
    console.log('No listing cards found, attempting to extract from links...');
    const links = $('a[href*="/immobilien/"]').filter((_, el) => {
      const href = $(el).attr('href') || '';
      return href.includes('/immobilien/') && !href.endsWith('/immobilien/');
    });

    links.each((_, element) => {
      const $el = $(element);
      const url = $el.attr('href') || '';
      const fullUrl = url.startsWith('http') ? url : `https://www.wohnnet.at${url}`;

      // Extract ID from URL
      const idMatch = url.match(/\/immobilien\/([^\/]+)/);
      const id = idMatch ? idMatch[1] : `page-${pageNumber}-${listings.length}`;

      // Try to extract basic info from link context
      const title = $el.text().trim() || $el.attr('title') || 'Unknown';

      listings.push({
        id,
        title,
        url: fullUrl,
        details: {}
      });
    });
  } else {
    // Parse each listing card
    listingElements.each((index, element) => {
      try {
        const $listing = $(element);

        // Extract URL
        const urlElement = $listing.find('a[href*="/immobilien/"]').first();
        const relativeUrl = urlElement.attr('href') || '';
        const url = relativeUrl.startsWith('http')
          ? relativeUrl
          : `https://www.wohnnet.at${relativeUrl}`;

        // Extract ID from URL or data attribute
        const dataId = $listing.attr('data-property-id') ||
                       $listing.attr('data-listing-id') ||
                       $listing.attr('data-id');
        const urlIdMatch = relativeUrl.match(/\/immobilien\/([^\/]+)/);
        const id = dataId || (urlIdMatch ? urlIdMatch[1] : `page-${pageNumber}-${index}`);

        // Extract title
        const title = $listing.find('h2, h3, h4, .title, .property-title, .listing-title').first().text().trim() ||
                     urlElement.attr('title') ||
                     urlElement.text().trim() ||
                     'Unknown';

        // Extract price
        const priceText = $listing.find('.price, .property-price, [class*="price"]').first().text().trim();
        const priceMatch = priceText.match(/[\d.,]+/);
        const price = priceMatch ? parseFloat(priceMatch[0].replace(/\./g, '').replace(',', '.')) : undefined;

        // Extract location
        const locationText = $listing.find('.location, .address, .city, [class*="location"]').first().text().trim();

        // Extract details
        const detailsText = $listing.text();
        const roomsMatch = detailsText.match(/(\d+)\s*Zimmer/i);
        const sqmMatch = detailsText.match(/(\d+)\s*m²/i);

        // Extract images
        const images: string[] = [];
        $listing.find('img').each((_, img) => {
          const src = $(img).attr('src') || $(img).attr('data-src') || '';
          if (src && !src.includes('placeholder')) {
            const fullSrc = src.startsWith('http') ? src : `https://www.wohnnet.at${src}`;
            images.push(fullSrc);
          }
        });

        const listing: WohnnetListing = {
          id,
          title,
          url,
          price,
          currency: 'EUR',
          location: {
            address: locationText || undefined,
            country: 'Austria'
          },
          details: {
            rooms: roomsMatch ? parseInt(roomsMatch[1]) : undefined,
            sqm: sqmMatch ? parseFloat(sqmMatch[1]) : undefined
          },
          images: images.length > 0 ? images : undefined
        };

        listings.push(listing);
      } catch (error) {
        console.warn(`Failed to parse listing ${index}:`, (error as Error).message);
      }
    });
  }

  return listings;
}

/**
 * Extract pagination metadata
 */
export function extractPaginationMeta(html: string, currentPage: number): WohnnetPaginationMeta {
  const $ = cheerio.load(html);

  let totalPages = currentPage;
  let hasNextPage = false;

  // Strategy 1: Check for <link rel="next"> tag (most reliable)
  const linkNext = $('link[rel="next"]');
  if (linkNext.length > 0) {
    hasNextPage = true;
    const nextHref = linkNext.attr('href') || '';
    const nextPageMatch = nextHref.match(/seite=(\d+)/);
    if (nextPageMatch) {
      const nextPageNum = parseInt(nextPageMatch[1]);
      // If next page exists, total pages is at least next page number
      if (nextPageNum > totalPages) {
        totalPages = nextPageNum;
      }
    }
  }

  // Strategy 2: Find all direct pagination links (not in a container)
  const pageLinks = $('a[href*="seite="]');
  if (pageLinks.length > 0) {
    pageLinks.each((_, link) => {
      const href = $(link).attr('href') || '';
      const pageMatch = href.match(/seite=(\d+)/);
      if (pageMatch) {
        const pageNum = parseInt(pageMatch[1]);
        if (pageNum > totalPages) {
          totalPages = pageNum;
        }
        // If we find a link to a page higher than current, we have next page
        if (pageNum > currentPage) {
          hasNextPage = true;
        }
      }
    });
  }

  // Strategy 3: Try to find pagination container elements (fallback)
  const paginationSelectors = [
    '.pagination',
    '.pager',
    '[class*="pagination"]',
    '[class*="pager"]'
  ];

  for (const selector of paginationSelectors) {
    const $pagination = $(selector);
    if ($pagination.length > 0) {
      // Find all page links within container
      const containerPageLinks = $pagination.find('a[href*="seite="]');
      containerPageLinks.each((_, link) => {
        const href = $(link).attr('href') || '';
        const pageMatch = href.match(/seite=(\d+)/);
        if (pageMatch) {
          const pageNum = parseInt(pageMatch[1]);
          if (pageNum > totalPages) {
            totalPages = pageNum;
          }
          if (pageNum > currentPage) {
            hasNextPage = true;
          }
        }
      });

      // Check for next page link
      const nextLink = $pagination.find('a.next, a[rel="next"], a:contains("Weiter"), a:contains("›")');
      if (nextLink.length > 0) {
        hasNextPage = true;
      }
      break;
    }
  }

  // Also check for total results text
  const resultsText = $('body').text();
  const totalMatch = resultsText.match(/(\d+)\s*Ergebnisse/i) ||
                     resultsText.match(/(\d+)\s*Immobilien/i);
  const totalItems = totalMatch ? parseInt(totalMatch[1]) : undefined;

  return {
    currentPage,
    totalPages,
    itemsPerPage: 20, // Typical for Wohnnet
    totalItems,
    hasNextPage: hasNextPage || currentPage < totalPages
  };
}

/**
 * Parse detail page
 */
export function parseDetailPage(html: string, listingUrl: string): Partial<WohnnetDetailResponse> {
  const $ = cheerio.load(html);

  // Extract JSON-LD first
  const jsonLd = extractJsonLd(html);

  // Extract description
  const description = $('.description, .property-description, [class*="description"]').first().text().trim() ||
                     $('meta[name="description"]').attr('content') ||
                     '';

  // Extract all detail fields
  const details: any = {};

  // Look for detail tables or lists
  $('.details, .property-details, [class*="details"]').find('tr, li, .detail-item').each((_, el) => {
    const $el = $(el);
    const label = $el.find('th, .label, dt, strong').first().text().trim().toLowerCase();
    const value = $el.find('td, .value, dd').first().text().trim();

    if (label.includes('zimmer') || label.includes('rooms')) {
      const match = value.match(/(\d+)/);
      if (match) details.rooms = parseInt(match[1]);
    }
    if (label.includes('wohnfläche') || label.includes('m²')) {
      const match = value.match(/(\d+)/);
      if (match) details.sqm = parseFloat(match[1]);
    }
    if (label.includes('schlafzimmer') || label.includes('bedrooms')) {
      const match = value.match(/(\d+)/);
      if (match) details.bedrooms = parseInt(match[1]);
    }
    if (label.includes('badezimmer') || label.includes('bathrooms')) {
      const match = value.match(/(\d+)/);
      if (match) details.bathrooms = parseInt(match[1]);
    }
    if (label.includes('stockwerk') || label.includes('etage')) {
      const match = value.match(/(\d+)/);
      if (match) details.floor = parseInt(match[1]);
    }
    if (label.includes('baujahr')) {
      const match = value.match(/(\d{4})/);
      if (match) details.yearBuilt = parseInt(match[1]);
    }
    if (label.includes('zustand') || label.includes('condition')) {
      details.condition = value;
    }
    if (label.includes('heizung') || label.includes('heating')) {
      details.heatingType = value;
    }
    if (label.includes('energie')) {
      details.energyRating = value;
    }
  });

  // Extract amenities
  const amenities: any = {};
  const amenityText = $('body').text().toLowerCase();

  amenities.parking = amenityText.includes('parkplatz') || amenityText.includes('parking');
  amenities.garage = amenityText.includes('garage');
  amenities.balcony = amenityText.includes('balkon') || amenityText.includes('balcony');
  amenities.terrace = amenityText.includes('terrasse') || amenityText.includes('terrace');
  amenities.garden = amenityText.includes('garten') || amenityText.includes('garden');
  amenities.elevator = amenityText.includes('aufzug') || amenityText.includes('lift');
  amenities.basement = amenityText.includes('keller') || amenityText.includes('basement');

  // Extract images
  const images: string[] = [];
  $('img[src*="api.wohnnet"], img[src*="/images/"], .gallery img, .property-images img').each((_, img) => {
    const src = $(img).attr('src') || $(img).attr('data-src') || '';
    if (src && !src.includes('placeholder') && !src.includes('logo')) {
      const fullSrc = src.startsWith('http') ? src : `https://www.wohnnet.at${src}`;
      if (!images.includes(fullSrc)) {
        images.push(fullSrc);
      }
    }
  });

  return {
    description,
    details,
    amenities,
    images: images.length > 0 ? images.map(url => ({ url })) : undefined,
    jsonLd: jsonLd || undefined
  };
}

/**
 * Extract listing ID from URL
 */
export function extractIdFromUrl(url: string): string {
  const match = url.match(/\/immobilien\/([^\/\?]+)/);
  return match ? match[1] : url;
}
