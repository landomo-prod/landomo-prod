/**
 * Bazos Detail Page Scraper
 *
 * Fetches individual property detail pages via the Bazos detail API
 * to extract descriptions, images, geo coordinates, and more.
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * Rich detail data returned from the Bazos detail API
 */
export interface BazosDetailData {
  description: string;
  images: string[];
  latitude?: string;
  longitude?: string;
  zip_code?: string;
  category_id?: string;
  category_title?: string;
  price?: number;
  type?: string; // "sell" or "rent"
}

/**
 * Fetch detail data from Bazos detail API (much richer than HTML scraping)
 */
async function fetchDetailApi(adId: string, retries = 3): Promise<BazosDetailData | null> {
  const url = `https://www.bazos.cz/api/v1/ad-detail-2.php?ad_id=${adId}`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': getRandomUserAgent(),
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate, br',
        },
        timeout: 10000,
      });

      const data = response.data;
      if (!data || data.status === 'deleted') return null;

      return {
        description: data.description || '',
        images: Array.isArray(data.images) ? data.images : [],
        latitude: data.latitude || undefined,
        longitude: data.longitude || undefined,
        zip_code: data.zip_code || undefined,
        category_id: data.category?.id?.toString(),
        category_title: data.category?.title,
        price: data.price ? parseInt(data.price, 10) : undefined,
        type: data.type || undefined,
      };
    } catch (error: any) {
      if (attempt === retries) {
        console.error(`[DetailScraper] API fetch failed for ad ${adId} after ${retries} attempts:`, error.message);
        return null;
      }
      await delay(1000 * attempt);
    }
  }
  return null;
}

/**
 * Fetch detail data for multiple listings via the API with rate limiting
 *
 * @param adIds - Array of ad IDs
 * @param delayMs - Delay between requests
 * @returns Map of adId -> BazosDetailData
 */
export async function fetchDetailDataBatch(
  adIds: string[],
  delayMs: number = 300
): Promise<Map<string, BazosDetailData>> {
  const results = new Map<string, BazosDetailData>();

  console.log(`[DetailScraper] Fetching ${adIds.length} detail pages via API...`);

  for (let i = 0; i < adIds.length; i++) {
    const adId = adIds[i];

    try {
      const detail = await fetchDetailApi(adId);
      if (detail) {
        results.set(adId, detail);
      }

      if ((i + 1) % 50 === 0) {
        console.log(`[DetailScraper] API Progress: ${i + 1}/${adIds.length} (${results.size} successful)`);
      }

      if (i < adIds.length - 1) {
        await delay(delayMs);
      }
    } catch (error: any) {
      console.error(`[DetailScraper] Failed for ad ${adId}:`, error.message);
    }
  }

  console.log(`[DetailScraper] API Completed: ${results.size}/${adIds.length} detail pages fetched`);
  return results;
}

/**
 * User agents for rotation
 */
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
];

/**
 * Get random user agent
 */
function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/**
 * Add delay between requests
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch detail page HTML
 */
async function fetchDetailPage(url: string, retries = 3): Promise<string> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': getRandomUserAgent(),
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'cs,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
        timeout: 10000,
      });

      return response.data;
    } catch (error: any) {
      console.error(`[DetailScraper] Attempt ${attempt}/${retries} failed for ${url}:`, error.message);

      if (attempt === retries) {
        throw new Error(`Failed to fetch detail page after ${retries} attempts: ${error.message}`);
      }

      // Wait before retry (exponential backoff)
      await delay(1000 * attempt);
    }
  }

  throw new Error('Unexpected error in fetchDetailPage');
}

/**
 * Extract description from Bazos detail page HTML
 */
function extractDescription(html: string, debugUrl?: string): string {
  const $ = cheerio.load(html);

  // Bazos stores description in a div with class "popisdetail"
  // Try multiple selectors to handle different page layouts
  let description = '';

  // Primary selector: div.popisdetail (main description)
  const opisDetailDiv = $('.popisdetail').first();

  // DEBUG: Log what we found
  if (debugUrl?.includes('213128704')) {
    console.log('[DEBUG] Testing selectors for', debugUrl);
    console.log('[DEBUG] .popisdetail found:', opisDetailDiv.length);
    console.log('[DEBUG] .popis found:', $('.popis').length);
    console.log('[DEBUG] HTML length:', html.length);
    console.log('[DEBUG] Sample HTML:', html.substring(0, 500));
  }

  if (opisDetailDiv.length > 0) {
    description = opisDetailDiv.text().trim();

    // DEBUG
    if (debugUrl?.includes('213128704')) {
      console.log('[DEBUG] Description length:', description.length);
      console.log('[DEBUG] Description preview:', description.substring(0, 200));
    }
  }

  // Fallback: div.popis (older layout or secondary description)
  if (!description) {
    const opisDiv = $('.popis').first();
    if (opisDiv.length > 0) {
      description = opisDiv.text().trim();
    }
  }

  // Clean up the description
  if (description) {
    // Remove excessive whitespace
    description = description.replace(/\s+/g, ' ').trim();

    // Remove common junk patterns
    description = description.replace(/Kontakt:.*$/i, '').trim();
    description = description.replace(/Tel\.:.*$/i, '').trim();
  }

  return description;
}

/**
 * Scrape detail page and return description
 *
 * @param url - Bazos detail page URL
 * @returns Property description text
 */
export async function scrapeDetailPage(url: string): Promise<string> {
  try {
    const html = await fetchDetailPage(url);
    const description = extractDescription(html, url);

    if (!description) {
      console.warn(`[DetailScraper] No description found for ${url}`);
      return '';
    }

    return description;
  } catch (error: any) {
    console.error(`[DetailScraper] Error scraping ${url}:`, error.message);
    return ''; // Return empty string on error, don't block the scrape
  }
}

/**
 * Scrape multiple detail pages with rate limiting
 *
 * @param urls - Array of Bazos detail page URLs
 * @param delayMs - Delay between requests in milliseconds (default: 500ms)
 * @returns Map of URL -> description
 */
export async function scrapeDetailPages(
  urls: string[],
  delayMs: number = 500
): Promise<Map<string, string>> {
  const results = new Map<string, string>();

  console.log(`[DetailScraper] Scraping ${urls.length} detail pages...`);

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];

    try {
      const description = await scrapeDetailPage(url);
      results.set(url, description);

      if ((i + 1) % 10 === 0) {
        console.log(`[DetailScraper] Progress: ${i + 1}/${urls.length} pages scraped`);
      }

      // Rate limiting: wait between requests
      if (i < urls.length - 1) {
        await delay(delayMs);
      }
    } catch (error: any) {
      console.error(`[DetailScraper] Failed to scrape ${url}:`, error.message);
      results.set(url, ''); // Store empty string for failed scrapes
    }
  }

  console.log(`[DetailScraper] Completed: ${results.size}/${urls.length} pages scraped`);

  return results;
}
