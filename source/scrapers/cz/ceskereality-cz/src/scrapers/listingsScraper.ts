import * as cheerio from 'cheerio';

export interface ScrapedListing {
  url: string;
  jsonLd: any;
  htmlData?: {
    images?: string[];
    propertyDetails?: Record<string, string>;
    energyRating?: string;
    coordinates?: { lat: number; lon: number };
  };
}

// Lightweight card data extracted from listing pages (for checksum purposes)
export interface ListingCard {
  url: string;
  portalId: string;   // numeric ID from URL, e.g. "ceskereality-3550005"
  title: string | null;
  price: number | null;
}


import { getRandomUserAgent } from '../utils/userAgents';

const FETCH_HEADERS = () => ({
  'User-Agent': getRandomUserAgent(),
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'cs-CZ,cs;q=0.9,en;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Cache-Control': 'no-cache',
});

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function scrapeListingCards(url: string, retries = 3): Promise<ListingCard[]> {
  try {
    const response = await fetch(url, { headers: FETCH_HEADERS() });
    if (response.status === 429 && retries > 0) {
      console.log(`   ⏳ Rate limited on listing page, retrying in 5s...`);
      await delay(5000);
      return scrapeListingCards(url, retries - 1);
    }
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const cards = new Map<string, ListingCard>(); // keyed by portalId to deduplicate

    $('article.i-estate').each((_, article) => {
      const el = $(article);

      // URL from the title link (most reliable)
      const href = el.find('a.i-estate__title-link').attr('href')
        ?? el.find('a[href$=".html"]').first().attr('href');
      if (!href) return;

      const absoluteUrl = href.startsWith('http')
        ? href
        : `https://www.ceskereality.cz${href}`;

      const numMatch = absoluteUrl.match(/-(\d+)\.html$/);
      if (!numMatch) return;
      const portalId = `ceskereality-${numMatch[1]}`;

      const title = el.find('.i-estate__header-title a').text().trim() || null;

      // Price: "9 490 000 Kč" → 9490000
      const priceText = el.find('.i-estate__footer-price-value').text().replace(/\s/g, '').replace('Kč', '').trim();
      const price = priceText ? parseInt(priceText, 10) || null : null;

      cards.set(portalId, { url: absoluteUrl, portalId, title, price });
    });

    console.log(`   Found ${cards.size} listing cards`);
    return Array.from(cards.values());
  } catch (error) {
    console.error(`❌ Error scraping listing page ${url}:`, error);
    return [];
  }
}


export async function scrapeDetailPage(url: string, retries = 5): Promise<ScrapedListing | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    const response = await fetch(url, { headers: FETCH_HEADERS(), signal: controller.signal });
    clearTimeout(timeoutId);
    if (response.status === 429 && retries > 0) {
      const backoff = 5000 + Math.random() * 10000; // 5-15s — back off hard on rate limit
      console.warn(`  ⏳ 429 rate limited, backing off ${(backoff / 1000).toFixed(1)}s (${retries} retries left)`);
      await delay(backoff);
      return scrapeDetailPage(url, retries - 1);
    }
    if ((response.status === 503 || response.status === 504) && retries > 0) {
      await delay(3000 + Math.random() * 5000);
      return scrapeDetailPage(url, retries - 1);
    }
    if (response.status === 500 && retries > 0) {
      await delay(2000 + Math.random() * 3000);
      return scrapeDetailPage(url, retries - 1);
    }
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Extract JSON-LD structured data
    const jsonLdScript = $('script[type="application/ld+json"]').first();
    if (!jsonLdScript.length) {
      console.warn(`⚠️  No JSON-LD data found on ${url}`);
      return null;
    }

    const jsonLdText = jsonLdScript.html();
    if (!jsonLdText) {
      console.warn(`⚠️  Empty JSON-LD script on ${url}`);
      return null;
    }

    const jsonLd = JSON.parse(jsonLdText);

    // Extract additional HTML data
    const htmlData: any = {};

    // Get all images from gallery
    const images: string[] = [];
    $('img[src*="img.ceskereality.cz/foto"]').each((_, el) => {
      const src = $(el).attr('src');
      if (src && !src.includes('logo') && !src.includes('icon') && !src.includes('makleri')) {
        // Get full resolution image (remove size parameters)
        const fullSizeUrl = src.split('?')[0];
        if (!images.includes(fullSizeUrl)) {
          images.push(fullSizeUrl);
        }
      }
    });
    if (images.length > 0) {
      htmlData.images = images;
    }

    // Extract property details from info table
    const propertyDetails: Record<string, string> = {};
    $('.i-info').each((_, el) => {
      const label = $(el).find('.i-info__title').text().trim();
      const value = $(el).find('.i-info__value').text().trim();
      if (label && value) {
        propertyDetails[label] = value;
      }
    });
    if (Object.keys(propertyDetails).length > 0) {
      htmlData.propertyDetails = propertyDetails;
    }

    // Extract energy rating
    const energyRating = $('.s-estate-detail-intro__energy').text().trim();
    if (energyRating) {
      htmlData.energyRating = energyRating;
    }

    // Extract coordinates from map scripts, data attributes, or JSON-LD geo
    let lat: number | undefined;
    let lon: number | undefined;

    // Try JSON-LD geo field
    if (jsonLd.geo) {
      lat = parseFloat(jsonLd.geo.latitude);
      lon = parseFloat(jsonLd.geo.longitude);
    }

    // Try data attributes on map elements
    if (!lat || !lon) {
      const mapEl = $('[data-lat][data-lng], [data-latitude][data-longitude]').first();
      if (mapEl.length) {
        lat = parseFloat(mapEl.attr('data-lat') || mapEl.attr('data-latitude') || '');
        lon = parseFloat(mapEl.attr('data-lng') || mapEl.attr('data-longitude') || '');
      }
    }

    // Try Google Maps embed iframe or link (ceskereality pattern: ?q=LAT,LON)
    if (!lat || !lon) {
      const mapSrc = $('iframe[src*="google.com/maps"]').attr('src')
        || $('a[href*="google.com/maps"]').attr('href');
      if (mapSrc) {
        const qMatch = mapSrc.match(/[?&]q=([\d.]+),([\d.]+)/);
        if (qMatch) {
          const parsedLat = parseFloat(qMatch[1]);
          const parsedLon = parseFloat(qMatch[2]);
          if (parsedLat >= 48.5 && parsedLat <= 51.1 && parsedLon >= 12.0 && parsedLon <= 18.9) {
            lat = parsedLat;
            lon = parsedLon;
          }
        }
      }
    }

    // Try inline scripts containing coordinates (common pattern: initMap(lat, lng) or {lat: X, lng: Y})
    if (!lat || !lon) {
      $('script:not([src])').each((_, el) => {
        if (lat && lon) return;
        const scriptText = $(el).html() || '';
        // Pattern: lat/latitude/lng/longitude in JS object literals
        const latMatch = scriptText.match(/["']?(?:lat|latitude)["']?\s*[:=]\s*([\d.]+)/);
        const lonMatch = scriptText.match(/["']?(?:lng|lon|longitude)["']?\s*[:=]\s*([\d.]+)/);
        if (latMatch && lonMatch) {
          const parsedLat = parseFloat(latMatch[1]);
          const parsedLon = parseFloat(lonMatch[1]);
          // Validate Czech Republic coordinate range
          if (parsedLat >= 48.5 && parsedLat <= 51.1 && parsedLon >= 12.0 && parsedLon <= 18.9) {
            lat = parsedLat;
            lon = parsedLon;
          }
        }
      });
    }

    if (lat && lon && !isNaN(lat) && !isNaN(lon)) {
      htmlData.coordinates = { lat, lon };
    }

    return {
      url,
      jsonLd,
      htmlData
    };
  } catch (error) {
    console.error(`❌ Error scraping detail page ${url}:`, error);
    return null;
  }
}

