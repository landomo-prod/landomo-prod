import * as cheerio from 'cheerio';
import { getRealisticHeaders, getRandomDelay } from './headers';

/**
 * Fetch all listing pages for a category with optional per-page streaming callback
 * Only extracts basic info needed for checksums, no detail fetching
 *
 * @param categoryUrl - Base URL for the category
 * @param transactionType - 'sale' or 'rent'
 * @param propertyType - Property type
 * @param onPageFetched - Optional callback fired immediately after each page is fetched (for streaming)
 */
// Shared adaptive delay state across all concurrent category fetchers
let _adaptiveDelayMs = 0;
const _backoffMultiplier = 1.5;
const _backoffMax = 30000;

function _increaseDelay() {
  _adaptiveDelayMs = Math.min(
    _adaptiveDelayMs === 0 ? 2000 : Math.round(_adaptiveDelayMs * _backoffMultiplier),
    _backoffMax
  );
}

function _decreaseDelay() {
  if (_adaptiveDelayMs > 0) {
    _adaptiveDelayMs = Math.max(0, Math.round(_adaptiveDelayMs / _backoffMultiplier));
  }
}

export function resetAdaptiveDelay() {
  _adaptiveDelayMs = 0;
}

async function fetchPage(
  pageUrl: string,
  pageNum: number,
  propertyType: string,
  transactionType: string,
): Promise<{ listings: any[]; hasNext: boolean } | null> {
  let retries = 5;

  while (retries > 0) {
    try {
      if (_adaptiveDelayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, _adaptiveDelayMs));
      }

      const headers = getRealisticHeaders();
      const response = await fetch(pageUrl, { headers });

      if (response.status === 429 || response.status === 503 || response.status >= 500) {
        _increaseDelay();
        console.log(`  Page ${pageNum}: HTTP ${response.status}, backing off ${_adaptiveDelayMs}ms (${retries - 1} left)...`);
        await new Promise(resolve => setTimeout(resolve, _adaptiveDelayMs));
        retries--;
        continue;
      }

      _decreaseDelay();

      if (!response.ok) {
        console.log(`  Page ${pageNum}: HTTP ${response.status}`);
        return null;
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      const selectors = ['.c-products__item', '.estate-item', '[data-dot="hp_product"]', '.property-item'];
      let items: cheerio.Cheerio<any> | null = null;
      for (const selector of selectors) {
        const found = $(selector);
        if (found.length > 0) { items = found; break; }
      }

      if (!items || items.length === 0) return null;

      const listings: any[] = [];
      items.each((_, item) => {
        try {
          const $item = $(item);
          const titleEl = $item.find('.c-products__title, h2, .title').first();
          const linkEl = $item.find('a.c-products__link, a[href*="/detail/"]').first();
          const priceEl = $item.find('.c-products__price, .price').first();
          const locationEl = $item.find('.c-products__info, .location').first();

          const title = titleEl.text().trim();
          const url = linkEl.attr('href') || '';
          const priceText = priceEl.text().trim();
          const location = locationEl.text().trim();
          const areaMatch = title.match(/(\d+)\s*m²/);
          const area = areaMatch ? parseInt(areaMatch[1]) : undefined;
          const idMatch = url.match(/\/([a-f0-9]{24})\/?$/);
          const id = idMatch?.[1] || $item.attr('data-id') || $item.attr('id') || url.match(/\/(\d+)/)?.[1] || '';

          if (title && url && id) {
            listings.push({
              id,
              title,
              url: url.startsWith('http') ? url : `https://reality.idnes.cz${url}`,
              priceText,
              location,
              area,
              propertyType,
              transactionType,
            });
          }
        } catch { /* skip */ }
      });

      // iDNES uses ajax-link-fake spans for pagination — DOM-based selectors don't work.
      // Instead extract total count from page and compute whether there are more pages.
      let totalCount = 0;
      const countMatch = html.match(/(\d[\d\s]*)\s*(?:nabídek|nemovitostí|inzerátů|výsledků)/);
      if (countMatch) {
        totalCount = parseInt(countMatch[1].replace(/\s/g, ''));
      }
      // Fallback: look for count in meta/data attributes
      if (!totalCount) {
        const metaMatch = html.match(/data-count="(\d+)"|"totalCount"\s*:\s*(\d+)|"count"\s*:\s*(\d+)/);
        if (metaMatch) totalCount = parseInt(metaMatch[1] || metaMatch[2] || metaMatch[3]);
      }
      const itemsPerPage = listings.length || 20;
      const hasNext = totalCount > 0 ? pageNum * itemsPerPage < totalCount : listings.length === itemsPerPage;
      return { listings, hasNext };

    } catch (err: any) {
      retries--;
      _increaseDelay();
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, _adaptiveDelayMs));
      } else {
        console.error(`  Page ${pageNum}: failed after retries`);
        return null;
      }
    }
  }
  return null;
}

export async function fetchAllPages(
  categoryUrl: string,
  transactionType: string,
  propertyType: string,
  _concurrency: number = 1, // Sequential only — concurrent page fetching causes pagination drift
  onPageFetched?: (listings: any[]) => Promise<void>,
  maxPages?: number,
): Promise<any[]> {
  const allListings: any[] = [];
  const PAGE_LIMIT = maxPages || 2000;
  const MAX_CONSECUTIVE_EMPTY = 3; // Tolerate up to 3 consecutive empty/error pages before stopping

  // Discover total pages first by fetching page 1
  const firstResult = await fetchPage(categoryUrl, 1, propertyType, transactionType);
  if (!firstResult || firstResult.listings.length === 0) return allListings;
  allListings.push(...firstResult.listings);
  if (onPageFetched) await onPageFetched(firstResult.listings);
  if (!firstResult.hasNext) return allListings;

  // Sequential pagination — no concurrent workers, no pagination drift
  let consecutiveEmpty = 0;

  for (let pageNum = 2; pageNum <= PAGE_LIMIT; pageNum++) {
    const pageUrl = `${categoryUrl}?page=${pageNum}`;
    const result = await fetchPage(pageUrl, pageNum, propertyType, transactionType);

    if (!result || result.listings.length === 0) {
      consecutiveEmpty++;
      if (consecutiveEmpty >= MAX_CONSECUTIVE_EMPTY) {
        break; // Truly at the end
      }
      continue; // Skip this page, try next
    }

    consecutiveEmpty = 0; // Reset on success
    allListings.push(...result.listings);
    if (onPageFetched) await onPageFetched(result.listings);

    if (!result.hasNext) {
      break;
    }
  }

  return allListings;
}

/**
 * Fetch detail page for a single listing (Phase 3 - used by workers)
 *
 * iDNES Reality HTML structure (confirmed Feb 2026):
 * - Title: h1.b-detail__title > span
 * - Price: p.b-detail__price > strong  (also in dataLayer as listing_price)
 * - Images: .b-gallery a[data-fancybox="images"] href (full-res)
 * - Description: .b-desc p
 * - Parameters: .b-definition-columns dl > dt/dd pairs
 * - Coordinates: dataLayer listing_lat/listing_lon, or data-maptiler-json GeoJSON
 * - Location: dataLayer listing_localityCity, listing_localityRegion, etc.
 */
export async function fetchListingDetail(url: string): Promise<any> {
  const headers = getRealisticHeaders();
  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // Detect inactive/sold listings
  const introSold = $('.b-intro--sold').length > 0;
  if (introSold) {
    return { _inactive: true };
  }

  // Extract title
  const title = $('h1.b-detail__title span').first().text().trim()
    || $('h1').first().text().trim();

  // Extract price text from the detail price element
  const priceText = $('p.b-detail__price strong').first().text().trim()
    || $('p.b-detail__price').first().text().trim();

  // Extract description
  const description = $('.b-desc p').first().text().trim()
    || $('.b-desc').first().text().trim();

  // Extract features from description header (h2 in b-desc)
  const features: string[] = [];

  // Extract full-resolution images from gallery fancybox links
  const images: string[] = [];
  $('a[data-fancybox="images"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href && !href.includes('placeholder') && !href.includes('no-image')) {
      images.push(href);
    }
  });

  // Extract property parameters from definition list
  const attributes: Record<string, string> = {};
  $('.b-definition-columns dl dt').each((_, dtEl) => {
    const dtText = $(dtEl).text().trim();
    const ddEl = $(dtEl).next('dd');
    if (!ddEl.length) return;

    // Check if dd contains a check icon (boolean true)
    const hasCheck = ddEl.find('.icon--check').length > 0;
    if (hasCheck) {
      attributes[dtText.toLowerCase()] = 'ano';
      return;
    }

    // Skip advertisement dd elements
    if (ddEl.hasClass('advertisement')) return;

    const ddText = ddEl.text().trim();
    if (dtText && ddText && dtText !== ddText) {
      attributes[dtText.toLowerCase()] = ddText;
    }
  });

  // Extract coordinates and structured data from dataLayer script
  let latitude: number | undefined;
  let longitude: number | undefined;
  let price: number | undefined;
  let area: number | undefined;
  let locationCity: string | undefined;
  let locationDistrict: string | undefined;
  let locationRegion: string | undefined;
  let locationCityArea: string | undefined;

  $('script:not([src])').each((_, el) => {
    const content = $(el).html() || '';

    // Extract from dataLayer push (most reliable source)
    const listingLatMatch = content.match(/"listing_lat"\s*:\s*([+-]?\d+\.?\d*)/);
    const listingLonMatch = content.match(/"listing_lon"\s*:\s*([+-]?\d+\.?\d*)/);
    if (listingLatMatch && listingLonMatch && !latitude) {
      latitude = parseFloat(listingLatMatch[1]);
      longitude = parseFloat(listingLonMatch[1]);
    }

    const priceMatch = content.match(/"listing_price"\s*:\s*(\d+(?:\.\d+)?)/);
    if (priceMatch && !price) {
      price = Math.round(parseFloat(priceMatch[1]));
    }

    const areaMatch = content.match(/"listing_area"\s*:\s*(\d+)/);
    if (areaMatch && !area) {
      area = parseInt(areaMatch[1]);
    }

    const cityMatch = content.match(/"listing_localityCity"\s*:\s*"([^"]+)"/);
    if (cityMatch && !locationCity) locationCity = cityMatch[1];

    const districtMatch = content.match(/"listing_localityDistrict"\s*:\s*"([^"]+)"/);
    if (districtMatch && !locationDistrict) locationDistrict = districtMatch[1];

    const regionMatch = content.match(/"listing_localityRegion"\s*:\s*"([^"]+)"/);
    if (regionMatch && !locationRegion) locationRegion = regionMatch[1];

    const cityAreaMatch = content.match(/"listing_localityCityArea"\s*:\s*"([^"]+)"/);
    if (cityAreaMatch && !locationCityArea) locationCityArea = cityAreaMatch[1];
  });

  // Fallback: coordinates from maptiler GeoJSON
  if (!latitude || !longitude) {
    const maptilerJson = $('script[data-maptiler-json]').html();
    if (maptilerJson) {
      try {
        const maptilerData = JSON.parse(maptilerJson);
        const mainFeature = maptilerData?.geojson?.features?.find(
          (f: any) => f.properties?.isSimilar === false
        );
        if (mainFeature?.geometry?.coordinates) {
          const [lon, lat] = mainFeature.geometry.coordinates;
          longitude = lon;
          latitude = lat;
        }
      } catch { /* ignore parse errors */ }
    }
  }

  // Fallback: parse price from priceText if dataLayer didn't have it
  if (!price && priceText) {
    const cleaned = priceText.replace(/[^0-9]/g, '');
    if (cleaned) price = parseInt(cleaned);
  }

  const coordinates = (latitude && longitude && !isNaN(latitude) && !isNaN(longitude))
    ? { lat: latitude, lng: longitude }
    : undefined;

  // Extract realtor/agent info from contact section
  let realtorName: string | undefined;
  let realtorPhone: string | undefined;
  let realtorEmail: string | undefined;

  // iDNES agent info is in .b-author section
  // Name is in h2.b-author__title, phone in a[href^="tel:"], email in a[href^="mailto:"]
  // Email href is HTML-entity encoded and includes ?subject=... query params
  const authorSection = $('.b-author, .b-contact, .b-broker');
  if (authorSection.length > 0) {
    realtorName = authorSection.find('.b-author__title, .b-author__name, .name, h3').first().text().trim() || undefined;
    const phoneEl = authorSection.find('a[href^="tel:"]').first();
    if (phoneEl.length > 0) {
      realtorPhone = phoneEl.attr('href')?.replace('tel:', '').trim() || phoneEl.text().trim() || undefined;
    }
    const emailEl = authorSection.find('a[href^="mailto:"]').first();
    if (emailEl.length > 0) {
      const rawEmail = emailEl.attr('href')?.replace('mailto:', '').split('?')[0].trim();
      realtorEmail = rawEmail || undefined;
    }
  }

  // Extract canonical URL — this is the source of truth for transaction type
  const canonicalUrl = $('link[rel="canonical"]').attr('href') || response.url || undefined;

  return {
    title,
    price,
    priceText,
    description,
    features,
    images,
    coordinates,
    attributes,
    area,
    canonicalUrl,
    location: {
      city: locationCity,
      district: locationDistrict,
      region: locationRegion,
      cityArea: locationCityArea,
    },
    realtor: (realtorName || realtorPhone || realtorEmail) ? {
      name: realtorName,
      phone: realtorPhone,
      email: realtorEmail,
    } : undefined,
  };
}
