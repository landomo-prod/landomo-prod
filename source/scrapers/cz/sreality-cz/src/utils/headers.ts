import { getRandomUserAgent } from './userAgents';

/**
 * Generate realistic browser headers for API requests
 * Rotates user agents and adds variation to look like real users
 */
export function getRealisticHeaders(): Record<string, string> {
  const userAgent = getRandomUserAgent();

  // Vary Accept-Language to look like different users
  const languages = [
    'cs-CZ,cs;q=0.9,en;q=0.8',
    'cs-CZ,cs;q=0.9',
    'cs,en-US;q=0.9,en;q=0.8',
    'cs-CZ,cs;q=0.9,en-US;q=0.8,en;q=0.7',
    'cs;q=0.9,en;q=0.8'
  ];

  const acceptLanguage = languages[Math.floor(Math.random() * languages.length)];

  // Realistic browser headers
  const headers: Record<string, string> = {
    'User-Agent': userAgent,
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': acceptLanguage,
    'Accept-Encoding': 'gzip, deflate, br',
    'Referer': 'https://www.sreality.cz/',
    'Origin': 'https://www.sreality.cz',
    'Connection': 'keep-alive',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin'
  };

  // Randomly add DNT header (some users have it, some don't)
  if (Math.random() > 0.5) {
    headers['DNT'] = '1';
  }

  // Chrome/Edge specific headers
  if (userAgent.includes('Chrome') && !userAgent.includes('Edge')) {
    headers['sec-ch-ua'] = '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"';
    headers['sec-ch-ua-mobile'] = '?0';
    headers['sec-ch-ua-platform'] = userAgent.includes('Windows') ? '"Windows"' :
                                     userAgent.includes('Mac') ? '"macOS"' : '"Linux"';
  }

  return headers;
}

/**
 * Generate random delay in milliseconds to make requests look more human
 * Returns a delay between min and max ms
 */
export function getRandomDelay(min: number = 50, max: number = 200): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
