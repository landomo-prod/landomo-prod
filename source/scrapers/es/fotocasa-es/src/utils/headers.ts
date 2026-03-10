/**
 * Realistic browser headers for Fotocasa API requests
 */

// Fixed UA that matches what our Playwright instance sends
export const PLAYWRIGHT_USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2.1 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
];

const ACCEPT_LANGUAGES = [
  'es-ES,es;q=0.9,en;q=0.8',
  'es-ES,es;q=0.9',
  'es,en;q=0.9,ca;q=0.8',
  'es-ES,es;q=0.9,en-US;q=0.8,en;q=0.7',
];

export function getRealisticHeaders(): Record<string, string> {
  const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  const lang = ACCEPT_LANGUAGES[Math.floor(Math.random() * ACCEPT_LANGUAGES.length)];

  return {
    'User-Agent': ua,
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': lang,
    'Accept-Encoding': 'gzip, deflate, br',
    'Origin': 'https://www.fotocasa.es',
    'Referer': 'https://www.fotocasa.es/',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  };
}

export function getRandomDelay(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
