/**
 * User agent pool for ImmoScout24 Austria scraper
 * Expanded with realistic browser fingerprints to avoid detection
 */

/**
 * Official ImmoScout24 Android app user agents
 * Based on reverse engineering - these are the actual UA strings used by the app
 */
export const immoscout24UserAgents = [
  // Primary - Official ImmoScout24 Android app
  'ImmoScout24/5.0 (Linux; Android 12; SDK built for x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
  'ImmoScout24/5.1 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Mobile Safari/537.36',
  'ImmoScout24/5.0 (Linux; Android 12; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Mobile Safari/537.36',
  'ImmoScout24/5.2 (Linux; Android 13; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Mobile Safari/537.36',
  'ImmoScout24/5.1 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
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
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
];

/**
 * Accept-Language variations for Austria/Germany
 */
const acceptLanguages = [
  'de-AT,de;q=0.9,en;q=0.8',
  'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
  'de-AT,de-DE;q=0.9,de;q=0.8,en;q=0.7',
  'de;q=0.9,en-US;q=0.8,en;q=0.7',
  'de-DE,en-US;q=0.9,en;q=0.8',
  'de-AT,en;q=0.9'
];

/**
 * Get a random ImmoScout24 app user agent (preferred)
 */
export function getRandomUserAgent(): string {
  return immoscout24UserAgents[Math.floor(Math.random() * immoscout24UserAgents.length)];
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
function getRandomAcceptLanguage(): string {
  return acceptLanguages[Math.floor(Math.random() * acceptLanguages.length)];
}

/**
 * Get the official ImmoScout24 app headers with rotation
 * Based on reverse engineering the Android app
 */
export function getImmoScout24Headers(): Record<string, string> {
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'User-Agent': getRandomUserAgent(),
    'Accept-Encoding': 'gzip, deflate, br',
    'Accept-Language': getRandomAcceptLanguage(),
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'DNT': '1'
  };

  // Randomly add referer (simulate navigation from website)
  if (Math.random() > 0.5) {
    headers['Referer'] = 'https://www.immobilienscout24.at/';
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
