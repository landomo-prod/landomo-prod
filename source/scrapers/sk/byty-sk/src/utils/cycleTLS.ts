import initCycleTLS from 'cycletls';

/**
 * CycleTLS wrapper for browser TLS fingerprinting
 * Replaces curl-impersonate with Node.js-native solution
 */

let cycleTLSInstance: any = null;

/**
 * Initialize CycleTLS instance (reusable)
 */
async function getCycleTLS() {
  if (!cycleTLSInstance) {
    cycleTLSInstance = await initCycleTLS();
  }
  return cycleTLSInstance;
}

/**
 * Fetch URL with Chrome TLS fingerprint
 */
export async function fetchWithBrowserTLS(
  url: string,
  options: {
    browser?: 'chrome' | 'firefox';
    headers?: Record<string, string>;
    userAgent?: string;
    method?: 'GET' | 'POST';
    body?: string;
    maxRetries?: number;
  } = {}
): Promise<string> {
  const {
    browser = 'chrome',
    headers = {},
    userAgent,
    method = 'GET',
    body = '',
    maxRetries = 3
  } = options;

  const cycleTLS = await getCycleTLS();

  // Chrome 120 JA3 fingerprint
  const chromeJA3 = '771,4865-4866-4867-49195-49199-49196-49200-52393-52392-49171-49172-156-157-47-53,0-23-65281-10-11-35-16-5-13-18-51-45-43-27-17513,29-23-24,0';

  // Firefox 120 JA3 fingerprint
  const firefoxJA3 = '771,4865-4867-4866-49195-49199-52393-52392-49196-49200-49162-49161-49171-49172-156-157-47-53,0-23-65281-10-11-35-16-5-51-43-13-45-28-21,29-23-24-25-256-257,0';

  const defaultUserAgent = browser === 'chrome'
    ? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0';

  // Build headers
  const requestHeaders: Record<string, string> = {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'sk-SK,sk;q=0.9,en;q=0.8,cs;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'DNT': '1',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    ...headers
  };

  // Add Chrome-specific headers
  if (browser === 'chrome') {
    requestHeaders['sec-ch-ua'] = '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"';
    requestHeaders['sec-ch-ua-mobile'] = '?0';
    requestHeaders['sec-ch-ua-platform'] = '"Windows"';
    requestHeaders['Sec-Fetch-Dest'] = 'document';
    requestHeaders['Sec-Fetch-Mode'] = 'navigate';
    requestHeaders['Sec-Fetch-Site'] = 'none';
    requestHeaders['Sec-Fetch-User'] = '?1';
  }

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await cycleTLS(url, {
        body,
        ja3: browser === 'chrome' ? chromeJA3 : firefoxJA3,
        userAgent: userAgent || defaultUserAgent,
        headers: requestHeaders,
        timeout: 30000
      }, method.toLowerCase());

      if (response.status >= 200 && response.status < 300) {
        // CycleTLS v2+ returns data property or text method
        let bodyContent: string;

        if (typeof response.data === 'string') {
          bodyContent = response.data;
        } else if (typeof response.text === 'function') {
          bodyContent = await response.text();
        } else if (response.data && typeof response.data === 'object') {
          // data might be a Buffer
          bodyContent = response.data.toString('utf-8');
        } else {
          throw new Error('Unable to extract body content from response');
        }

        // Verify we got HTML content
        if (!bodyContent || (!bodyContent.includes('<html') && !bodyContent.includes('<!DOCTYPE'))) {
          throw new Error('Response does not appear to be valid HTML');
        }

        return bodyContent;
      }

      throw new Error(`HTTP ${response.status}: ${response.statusText || 'Request failed'}`);
    } catch (error: any) {
      lastError = error;
      console.error(`Attempt ${attempt}/${maxRetries} failed:`, error.message);

      if (attempt < maxRetries) {
        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('Failed to fetch URL after retries');
}

/**
 * Cleanup CycleTLS instance
 */
export async function closeCycleTLS() {
  if (cycleTLSInstance) {
    await cycleTLSInstance.exit();
    cycleTLSInstance = null;
  }
}
