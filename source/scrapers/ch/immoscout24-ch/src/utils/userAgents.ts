/**
 * User agent pool for ImmoScout24.ch scraper
 */

const browserUserAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
];

/**
 * Swiss locale Accept-Language variations (DE/FR/IT regions)
 */
const acceptLanguages = [
  'de-CH,de;q=0.9,en;q=0.8',
  'de-CH,de-DE;q=0.9,de;q=0.8,en;q=0.7',
  'fr-CH,fr;q=0.9,de-CH;q=0.8,en;q=0.7',
  'it-CH,it;q=0.9,de-CH;q=0.8,en;q=0.7',
  'de-CH,fr-CH;q=0.9,en;q=0.8',
  'de,en;q=0.9',
];

export function getRandomUserAgent(): string {
  return browserUserAgents[Math.floor(Math.random() * browserUserAgents.length)];
}

function getRandomAcceptLanguage(): string {
  return acceptLanguages[Math.floor(Math.random() * acceptLanguages.length)];
}

export function getImmoScout24ChHeaders(): Record<string, string> {
  return {
    'Accept': 'application/json',
    'User-Agent': getRandomUserAgent(),
    'Accept-Encoding': 'gzip, deflate, br',
    'Accept-Language': getRandomAcceptLanguage(),
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'DNT': '1',
    'Origin': 'https://www.immoscout24.ch',
    'Referer': 'https://www.immoscout24.ch/',
  };
}
