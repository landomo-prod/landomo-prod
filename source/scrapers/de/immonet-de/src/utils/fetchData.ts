import axios, { AxiosError } from 'axios';
import * as https from 'https';
import { getImmonetHeaders } from './userAgents';

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
 * Fetch data with retry logic, exponential backoff, and rotating fingerprints
 */
export const fetchDataWithRetry = async (
  url: string,
  headers?: Record<string, string>,
  params?: Record<string, any>,
  retries: number = 3
): Promise<any> => {
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      // Rotate headers on each attempt
      const rotatedHeaders = headers ? { ...getImmonetHeaders(), ...headers } : getImmonetHeaders();

      // Add random delay before request (human-like behavior)
      if (attempt > 0) {
        await randomDelay(500, 2000);
      }

      const response = await axios.get(url, {
        headers: rotatedHeaders,
        params,
        timeout: 30000, // 30 second timeout
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
 * Rate limiting with human-like delays between pages
 */
export async function rateLimitedPagination(
  pageNumber: number,
  pagesInterval: number = 5
): Promise<void> {
  // Base delay between requests
  const pageDelay = getRandomDelay(500, 2500);
  console.log(`   ⏳ Waiting ${(pageDelay / 1000).toFixed(2)}s before next page...`);
  await new Promise(resolve => setTimeout(resolve, pageDelay));

  // Occasional longer pause (simulate human behavior - checking listings, reading details)
  if (pageNumber > 0 && pageNumber % pagesInterval === 0) {
    const longPause = getRandomDelay(3000, 6000);
    console.log(`   ☕ Taking a break (${(longPause / 1000).toFixed(1)}s) after ${pageNumber} pages...`);
    await new Promise(resolve => setTimeout(resolve, longPause));
  }
}
