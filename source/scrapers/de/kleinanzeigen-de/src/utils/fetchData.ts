import axios, { AxiosError } from 'axios';
import * as https from 'https';
import { getKleinanzeigenHeaders } from './userAgents';
import { normalizeJaxbListing } from './normalizeJaxb';

/**
 * Kleinanzeigen API Configuration
 * Based on reverse engineering of the mobile app
 */
export const API_CONFIG = {
  BASE_URL: 'https://api.kleinanzeigen.de/api',
  // Basic authentication header (decoded: android:TaR60pEttY)
  AUTH_HEADER: 'Basic YW5kcm9pZDpUYVI2MHBFdHRZ',
  DEFAULT_SIZE: 41, // Max results per page
  DEFAULT_TIMEOUT: 30000
};

/**
 * Get random delay between requests (human-like behavior)
 */
function getRandomDelay(min: number = 300, max: number = 2000): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Sleep for random duration
 */
async function randomDelay(min: number = 300, max: number = 2000): Promise<void> {
  const delay = getRandomDelay(min, max);
  return new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Cipher suite rotation to avoid TLS fingerprinting
 */
function getRandomCipherSuite(): string {
  const cipherSuites = [
    // Modern cipher suites (prioritize)
    'TLS_AES_128_GCM_SHA256:TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384',
    'TLS_AES_256_GCM_SHA384:TLS_AES_128_GCM_SHA256:TLS_CHACHA20_POLY1305_SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-GCM-SHA256',
    'TLS_CHACHA20_POLY1305_SHA256:TLS_AES_128_GCM_SHA256:TLS_AES_256_GCM_SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305',
    // Chrome-like
    'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305',
    // Firefox-like
    'TLS_AES_128_GCM_SHA256:TLS_CHACHA20_POLY1305_SHA256:TLS_AES_256_GCM_SHA384:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256'
  ];

  return cipherSuites[Math.floor(Math.random() * cipherSuites.length)];
}

/**
 * Create HTTPS agent with randomized TLS settings
 */
function createRandomizedHttpsAgent(): https.Agent {
  return new https.Agent({
    minVersion: 'TLSv1.2',
    maxVersion: 'TLSv1.3',
    ciphers: getRandomCipherSuite(),
    honorCipherOrder: Math.random() > 0.5,
    rejectUnauthorized: process.env.NODE_ENV === 'production',
    keepAlive: true,
    keepAliveMsecs: 1000,
    maxSockets: 10
  });
}

/**
 * Fetch data from API with retry logic and exponential backoff
 */
export const fetchDataWithRetry = async (
  url: string,
  headers: Record<string, string>,
  retries: number = 3
): Promise<any> => {
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      // Rotate headers on each attempt
      const rotatedHeaders = { ...getKleinanzeigenHeaders(), ...headers };

      // Add random delay before request (human-like behavior)
      if (attempt > 0) {
        await randomDelay(500, 2000);
      }

      const response = await axios.get(url, {
        headers: rotatedHeaders,
        timeout: API_CONFIG.DEFAULT_TIMEOUT,
        validateStatus: (status) => status < 500,
        httpsAgent: createRandomizedHttpsAgent() // Rotate TLS fingerprint
      });

      if (response.status === 200) {
        // Add small random delay after successful request
        await randomDelay(300, 800);
        return response.data;
      }

      // Handle specific error codes
      if (response.status === 404) {
        throw new Error(`Resource not found: ${url}`);
      }

      if (response.status === 429) {
        console.warn(`⚠️  Rate limited, backing off with jitter...`);
        const baseBackoff = 5000 * Math.pow(2, attempt);
        const jitter = Math.random() * 0.3 * baseBackoff; // 30% jitter
        const backoffMs = Math.min(baseBackoff + jitter, 30000);
        console.log(`   ⏳ Waiting ${(backoffMs / 1000).toFixed(2)}s before retry...`);
        await delay(backoffMs);
        continue;
      }

      throw new Error(`HTTP ${response.status}: ${response.statusText}`);

    } catch (error) {
      const axiosError = error as AxiosError;

      // Don't retry on 4xx errors (except 429)
      if (
        axiosError.response?.status &&
        axiosError.response.status >= 400 &&
        axiosError.response.status < 500 &&
        axiosError.response.status !== 429
      ) {
        throw error;
      }

      // On last attempt, throw the error
      if (attempt === retries - 1) {
        throw error;
      }

      // Exponential backoff with random jitter
      const baseDelay = 1000 * Math.pow(2, attempt);
      const jitter = Math.random() * 1000;
      const delayMs = Math.min(baseDelay + jitter, 10000);
      console.log(`🔄 Retrying request (${attempt + 1}/${retries}) in ${(delayMs / 1000).toFixed(2)}s: ${url}`);
      await delay(delayMs);
    }
  }
};

/**
 * Fetch listings from Kleinanzeigen API with pagination
 * Processes each page through the provided callback
 */
export const fetchListings = async (
  categoryId: number,
  userAgent: string,
  locationId?: number,
  query?: string,
  processPage?: (listings: any[], pageNumber: number) => Promise<void>
): Promise<any[]> => {
  let page = 0;
  let allListings: any[] = [];
  const maxPages = 100; // Reasonable limit to prevent infinite loops

  while (page < maxPages) {
    try {
      const params: any = {
        size: API_CONFIG.DEFAULT_SIZE,
        page: page
      };

      // Add optional filters
      if (categoryId) {
        params.categoryId = categoryId;
      }
      if (locationId) {
        params.locationId = locationId;
        // Use large radius (500km) to cover the full state from the location point
        params.distance = 500;
      }
      if (query) {
        params.q = query;
      }

      // Build query string
      const queryString = Object.entries(params)
        .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
        .join('&');

      const url = `${API_CONFIG.BASE_URL}/ads.json?${queryString}`;

      const headers = {
        'Authorization': API_CONFIG.AUTH_HEADER,
        'User-Agent': userAgent,
        'Accept': 'application/json',
        'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8'
      };

      const data = await fetchDataWithRetry(url, headers, 3);

      // Handle different response structures
      let listings = [];
      if (data.ads) {
        listings = data.ads;
      } else if (data._embedded?.ads) {
        listings = data._embedded.ads;
      } else if (data['{http://www.ebayclassifiedsgroup.com/schema/ad/v1}ads']) {
        // JAXB structure from the API - MUST NORMALIZE
        const jaxbData = data['{http://www.ebayclassifiedsgroup.com/schema/ad/v1}ads'];
        const rawListings = jaxbData.value?.ad || [];
        listings = rawListings.map(normalizeJaxbListing);
      }

      if (listings.length === 0) {
        break; // No more results
      }

      // Process page if callback provided
      if (processPage) {
        await processPage(listings, page);
      }

      allListings.push(...listings);

      console.log(`📄 Page ${page + 1}: fetched ${listings.length} listings (${allListings.length} total)`);

      // If we got less than requested, we're at the end
      if (listings.length < API_CONFIG.DEFAULT_SIZE) {
        break;
      }

      // Rate limiting with human-like random delays between pages
      const pageDelay = getRandomDelay(500, 2500);
      console.log(`   ⏳ Waiting ${(pageDelay / 1000).toFixed(2)}s before next page...`);
      await new Promise(resolve => setTimeout(resolve, pageDelay));

      page++;

      // Occasional longer pause (simulate human behavior - checking listings, reading details)
      if (page > 0 && page % 5 === 0) {
        const longPause = getRandomDelay(3000, 6000);
        console.log(`   ☕ Taking a break (${(longPause / 1000).toFixed(1)}s) after ${page} pages...`);
        await new Promise(resolve => setTimeout(resolve, longPause));
      }
    } catch (error: any) {
      console.error(`Error fetching page ${page}:`, error.message);

      // If it's a rate limit error, wait longer before retrying
      if (error.response?.status === 429) {
        console.log('Rate limited, waiting 5 seconds...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        continue; // Retry this page
      }

      break; // Stop on other errors
    }
  }

  return allListings;
};

/**
 * Fetch detailed information for a specific listing
 */
export const fetchListingDetail = async (
  listingId: number,
  userAgent: string
): Promise<any> => {
  const url = `${API_CONFIG.BASE_URL}/ads/${listingId}.json`;

  // Use rotated headers with custom user agent
  const rotatedHeaders = getKleinanzeigenHeaders();
  const headers = {
    ...rotatedHeaders,
    'User-Agent': userAgent
  };

  return fetchDataWithRetry(url, headers, 3);
};

/**
 * Fetch location data (for location ID lookup)
 */
export const fetchLocations = async (
  searchQuery: string,
  userAgent: string
): Promise<any> => {
  const url = `${API_CONFIG.BASE_URL}/locations/top-locations.json?depth=0&q=${encodeURIComponent(searchQuery)}`;

  // Use rotated headers with custom user agent
  const rotatedHeaders = getKleinanzeigenHeaders();
  const headers = {
    ...rotatedHeaders,
    'User-Agent': userAgent
  };

  return fetchDataWithRetry(url, headers, 3);
};

/**
 * German federal state location IDs from the Kleinanzeigen API.
 * Derived from URL patterns like /s-immobilien/{state}/k0l{ID}r500
 * e.g. Nordrhein-Westfalen → k0l20789r500 → locationId=20789
 */
const GERMAN_STATE_LOCATION_IDS = [
  { name: 'Baden-Württemberg', locationId: 20750 },
  { name: 'Bayern', locationId: 12332 },
  { name: 'Berlin', locationId: 3331 },
  { name: 'Brandenburg', locationId: 20769 },
  { name: 'Bremen', locationId: 20770 },
  { name: 'Hamburg', locationId: 9 },
  { name: 'Hessen', locationId: 20786 },
  { name: 'Mecklenburg-Vorpommern', locationId: 20773 },
  { name: 'Niedersachsen', locationId: 20771 },
  { name: 'Nordrhein-Westfalen', locationId: 20789 },
  { name: 'Rheinland-Pfalz', locationId: 20767 },
  { name: 'Saarland', locationId: 20775 },
  { name: 'Sachsen', locationId: 20774 },
  { name: 'Sachsen-Anhalt', locationId: 20778 },
  { name: 'Schleswig-Holstein', locationId: 20779 },
  { name: 'Thüringen', locationId: 20780 },
];

/**
 * Fetch listings for a category across all German federal states.
 * First fetches nationwide (no locationId) to get the top-4,100, then fetches
 * per-state with distance=500km to capture listings beyond the nationwide cap.
 * Returns deduplicated listings by listing ID.
 */
export const fetchListingsByState = async (
  categoryId: number,
  userAgent: string,
  processPage?: (listings: any[], pageNumber: number) => Promise<void>
): Promise<any[]> => {
  const seenIds = new Set<number>();
  const allListings: any[] = [];

  // Step 1: Nationwide fetch (no locationId) — gets the most popular ~4,100 listings
  console.log(JSON.stringify({ level: 'info', service: 'kleinanzeigen-scraper', msg: 'Fetching nationwide (no location filter)', categoryId }));
  const nationwideListings = await fetchListings(categoryId, userAgent, undefined, undefined, processPage);
  for (const listing of nationwideListings) {
    const id = listing.id;
    if (id != null && !seenIds.has(id)) {
      seenIds.add(id);
      allListings.push(listing);
    }
  }
  console.log(JSON.stringify({ level: 'info', service: 'kleinanzeigen-scraper', msg: 'Nationwide complete', categoryId, fetched: nationwideListings.length, totalUnique: allListings.length }));

  // Step 2: Per-state fetches with large radius to capture listings beyond nationwide cap
  for (const state of GERMAN_STATE_LOCATION_IDS) {
    console.log(JSON.stringify({ level: 'info', service: 'kleinanzeigen-scraper', msg: 'Fetching state', state: state.name, categoryId }));

    const stateListings = await fetchListings(categoryId, userAgent, state.locationId, undefined, processPage);

    let added = 0;
    for (const listing of stateListings) {
      const id = listing.id;
      if (id != null && !seenIds.has(id)) {
        seenIds.add(id);
        allListings.push(listing);
        added++;
      }
    }

    console.log(JSON.stringify({ level: 'info', service: 'kleinanzeigen-scraper', msg: 'State complete', state: state.name, categoryId, fetched: stateListings.length, unique: added, totalUnique: allListings.length }));
  }

  return allListings;
};
