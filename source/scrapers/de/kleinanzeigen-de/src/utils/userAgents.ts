/**
 * Pool of user agents for rotation
 * Helps avoid rate limiting and bot detection
 *
 * For Kleinanzeigen API, we primarily use mobile app user agents
 * since the API is designed for the mobile app
 */

/**
 * Mobile app user agents (recommended for Kleinanzeigen API)
 */
export const mobileUserAgents = [
  'okhttp/4.10.0',
  'okhttp/4.11.0',
  'okhttp/4.12.0',
  'Kleinanzeigen/1.0 (Android)',
  'Kleinanzeigen/2.0 (Android 13)',
  'Kleinanzeigen/2.1 (Android 14)',
];

/**
 * Browser user agents - realistic desktop browsers
 */
export const browserUserAgents = [
  // Chrome on Windows - various versions
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36',

  // Chrome on macOS
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',

  // Firefox on Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:119.0) Gecko/20100101 Firefox/119.0',

  // Firefox on macOS
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:120.0) Gecko/20100101 Firefox/120.0',

  // Safari on macOS
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',

  // Edge on Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0',

  // Chrome on Linux
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',

  // Firefox on Linux
  'Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0'
];

/**
 * All user agents combined
 */
export const userAgents = [...mobileUserAgents, ...browserUserAgents];

/**
 * Accept-Language variations for Germany
 */
const acceptLanguages = [
  'de-DE,de;q=0.9,en;q=0.8',
  'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
  'de;q=0.9,en-US;q=0.8,en;q=0.7',
  'de-DE,en-US;q=0.9,en;q=0.8',
  'de,en;q=0.9',
  'de-DE,en;q=0.9'
];

/**
 * Get a random user agent
 */
export function getRandomUserAgent(): string {
  return userAgents[Math.floor(Math.random() * userAgents.length)];
}

/**
 * Get mobile app user agent (preferred for API calls)
 */
export function getMobileUserAgent(): string {
  return mobileUserAgents[Math.floor(Math.random() * mobileUserAgents.length)];
}

/**
 * Get a random browser user agent (fallback)
 */
export function getRandomBrowserUserAgent(): string {
  return browserUserAgents[Math.floor(Math.random() * browserUserAgents.length)];
}

/**
 * Get random Accept-Language header
 */
export function getRandomAcceptLanguage(): string {
  return acceptLanguages[Math.floor(Math.random() * acceptLanguages.length)];
}

/**
 * Get Kleinanzeigen-specific headers with rotation
 * Based on reverse engineering the Android app
 */
export function getKleinanzeigenHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Authorization': 'Basic YW5kcm9pZDpUYVI2MHBFdHRZ',
    'User-Agent': getMobileUserAgent(),
    'Accept': 'application/json',
    'Accept-Encoding': 'gzip, deflate, br',
    'Accept-Language': getRandomAcceptLanguage(),
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'DNT': '1'
  };

  // Randomly add referer (simulate navigation from website)
  if (Math.random() > 0.5) {
    headers['Referer'] = 'https://www.kleinanzeigen.de/';
  }

  return headers;
}

/**
 * Get browser-like headers with full rotation
 */
export function getRotatingBrowserHeaders(): Record<string, string> {
  const userAgent = getRandomBrowserUserAgent();
  const isChrome = userAgent.includes('Chrome') && !userAgent.includes('Edg');
  const isEdge = userAgent.includes('Edg');

  const headers: Record<string, string> = {
    'User-Agent': userAgent,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': getRandomAcceptLanguage(),
    'Accept-Encoding': 'gzip, deflate, br',
    'DNT': '1',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Cache-Control': 'max-age=0'
  };

  // Add Chrome-specific headers
  if (isChrome) {
    headers['sec-ch-ua'] = '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"';
    headers['sec-ch-ua-mobile'] = '?0';
    headers['sec-ch-ua-platform'] = userAgent.includes('Windows') ? '"Windows"' :
                                    userAgent.includes('Mac') ? '"macOS"' : '"Linux"';
  } else if (isEdge) {
    headers['sec-ch-ua'] = '"Not_A Brand";v="8", "Chromium";v="120", "Microsoft Edge";v="120"';
    headers['sec-ch-ua-mobile'] = '?0';
    headers['sec-ch-ua-platform'] = '"Windows"';
  }

  return headers;
}
