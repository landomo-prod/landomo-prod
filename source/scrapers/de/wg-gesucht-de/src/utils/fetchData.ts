import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import * as https from 'https';

/**
 * WG-Gesucht API requires authentication
 * Access tokens are stored in memory and refreshed when expired
 */
interface AuthTokens {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
}

let authTokens: AuthTokens = {};

/**
 * Delay helper for rate limiting
 * WG-Gesucht requires 5-8 second delays to avoid reCAPTCHA
 */
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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
  const delayMs = getRandomDelay(min, max);
  return new Promise(resolve => setTimeout(resolve, delayMs));
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
 * Authenticate with WG-Gesucht API
 *
 * @param username - Email or username
 * @param password - Password
 * @returns Access and refresh tokens
 */
export async function authenticate(username: string, password: string): Promise<void> {
  const url = 'https://www.wg-gesucht.de/api/oauth/token';

  try {
    const response = await axios.post(url, {
      grant_type: 'password',
      username,
      password,
      client_id: 'wg-gesucht-web' // May need to be updated
    });

    authTokens = {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresAt: Date.now() + (response.data.expires_in * 1000)
    };

    console.log('✅ Successfully authenticated with WG-Gesucht API');
  } catch (error: any) {
    console.error('❌ Authentication failed:', error.message);
    throw new Error('Failed to authenticate with WG-Gesucht API');
  }
}

/**
 * Refresh access token using refresh token
 */
async function refreshAccessToken(): Promise<void> {
  if (!authTokens.refreshToken) {
    throw new Error('No refresh token available. Please authenticate first.');
  }

  const url = 'https://www.wg-gesucht.de/api/oauth/token';

  try {
    const response = await axios.post(url, {
      grant_type: 'refresh_token',
      refresh_token: authTokens.refreshToken,
      client_id: 'wg-gesucht-web'
    });

    authTokens = {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresAt: Date.now() + (response.data.expires_in * 1000)
    };

    console.log('✅ Access token refreshed');
  } catch (error: any) {
    console.error('❌ Token refresh failed:', error.message);
    throw new Error('Failed to refresh access token');
  }
}

/**
 * Check if access token is expired or about to expire
 */
function isTokenExpired(): boolean {
  if (!authTokens.expiresAt) return true;
  // Refresh 5 minutes before expiry
  return Date.now() >= (authTokens.expiresAt - 300000);
}

/**
 * Get current access token, refreshing if necessary
 */
async function getAccessToken(): Promise<string> {
  if (isTokenExpired()) {
    await refreshAccessToken();
  }

  if (!authTokens.accessToken) {
    throw new Error('No access token available. Please authenticate first.');
  }

  return authTokens.accessToken;
}

/**
 * Fetch data from WG-Gesucht API with retry logic and exponential backoff
 *
 * Important: Uses 5-8 second delays between requests to avoid reCAPTCHA
 */
export const fetchDataWithRetry = async (
  url: string,
  headers: Record<string, string>,
  retries: number = 3,
  useAuth: boolean = true
): Promise<any> => {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      // Add authentication if required
      const requestHeaders = { ...headers };
      if (useAuth) {
        const token = await getAccessToken();
        requestHeaders['Authorization'] = `Bearer ${token}`;
      }

      // Add random delay before request (human-like behavior)
      if (attempt > 0) {
        await randomDelay(500, 2000);
      }

      const response = await axios.get(url, {
        headers: requestHeaders,
        timeout: 30000, // 30 second timeout
        validateStatus: (status) => status < 500,
        httpsAgent: createRandomizedHttpsAgent() // Rotate TLS fingerprint
      });

      if (response.status === 200) {
        // Add delay after successful request to avoid rate limiting
        // WG-Gesucht recommends 5-8 seconds
        const delayMs = 5000 + Math.random() * 3000; // 5-8 seconds
        await delay(delayMs);
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

      // Handle 401 - try to refresh token
      if (axiosError.response?.status === 401 && useAuth) {
        console.log('🔄 Access token expired, refreshing...');
        await refreshAccessToken();
        continue; // Retry with new token
      }

      // Don't retry on 4xx errors (except 401 and 429)
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
      const baseDelay = 2000 * Math.pow(2, attempt);
      const jitter = Math.random() * 1000;
      const delayMs = Math.min(baseDelay + jitter, 15000);
      console.log(`🔄 Retrying request (${attempt + 1}/${retries}) in ${(delayMs / 1000).toFixed(2)}s: ${url}`);
      await delay(delayMs);
    }
  }
};

/**
 * Fetch offers from WG-Gesucht API
 *
 * @param cityId - City ID (e.g., 8 for Berlin)
 * @param categories - Category types (e.g., ['0'] for WG-Zimmer)
 * @param options - Additional search parameters
 */
export const fetchOffers = async (
  cityId: number,
  categories: string[],
  options: {
    maxRent?: number;
    minSize?: number;
    page?: number;
  } = {}
): Promise<any> => {
  const params = new URLSearchParams({
    city_id: cityId.toString(),
    categories: categories.join(','),
    ...(options.maxRent && { rent_max: options.maxRent.toString() }),
    ...(options.minSize && { size_min: options.minSize.toString() }),
    ...(options.page && { page: options.page.toString() })
  });

  const url = `https://www.wg-gesucht.de/api/asset/offers/?${params.toString()}`;

  // Import getWGGesuchtHeaders dynamically to avoid circular dependency
  const { getWGGesuchtHeaders } = await import('./userAgents');
  const headers = getWGGesuchtHeaders();

  return fetchDataWithRetry(url, headers, 3, true);
};

/**
 * Fetch offer detail from WG-Gesucht API
 *
 * @param offerId - Offer ID
 */
export const fetchOfferDetail = async (offerId: string | number): Promise<any> => {
  const url = `https://www.wg-gesucht.de/api/asset/offers/${offerId}`;

  // Import getWGGesuchtHeaders dynamically to avoid circular dependency
  const { getWGGesuchtHeaders } = await import('./userAgents');
  const headers = getWGGesuchtHeaders();

  return fetchDataWithRetry(url, headers, 3, true);
};

/**
 * Fetch paginated data from WG-Gesucht API
 * Processes each page through the provided callback
 *
 * @param cityId - City ID
 * @param categories - Category types
 * @param processPage - Callback to process each page
 */
export const fetchPaginatedData = async (
  cityId: number,
  categories: string[],
  processPage: (offers: any[], pageNumber: number) => Promise<void>
): Promise<number> => {
  let page = 1;
  let totalProcessed = 0;
  const maxPages = 100; // Reasonable limit

  while (page <= maxPages) {
    try {
      const data = await fetchOffers(cityId, categories, { page });

      const offers = data?.data?.offers || [];
      if (offers.length === 0) {
        break; // No more results
      }

      await processPage(offers, page);
      totalProcessed += offers.length;

      // Check if there are more pages
      const pagination = data?.data?.pagination;
      if (!pagination || page >= pagination.total) {
        break;
      }

      console.log(`📄 Processed page ${page}, ${offers.length} offers`);

      // Rate limiting with human-like random delays between pages
      const pageDelay = getRandomDelay(500, 2500);
      console.log(`   ⏳ Waiting ${(pageDelay / 1000).toFixed(2)}s before next page...`);
      await delay(pageDelay);

      page++;

      // Occasional longer pause (simulate human behavior - checking listings, reading details)
      if (page > 0 && page % 5 === 0) {
        const longPause = getRandomDelay(3000, 6000);
        console.log(`   ☕ Taking a break (${(longPause / 1000).toFixed(1)}s) after ${page} pages...`);
        await delay(longPause);
      }
    } catch (error: any) {
      console.error(`❌ Error fetching page ${page}:`, error.message);
      break; // Stop processing on error
    }
  }

  return totalProcessed;
};

/**
 * Set authentication tokens manually (for testing or external auth)
 */
export function setAuthTokens(tokens: AuthTokens): void {
  authTokens = tokens;
}

/**
 * Clear authentication tokens
 */
export function clearAuthTokens(): void {
  authTokens = {};
}
