import axios from 'axios';
import * as cheerio from 'cheerio';
import { SubitoItem, SubitoNextData } from '../types/subitoTypes';
import { getRandomUserAgent } from '../utils/userAgents';

const BASE_URL = 'https://www.subito.it';

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function extractNextData(html: string): SubitoNextData | null {
  try {
    const $ = cheerio.load(html);
    const scriptContent = $('script#__NEXT_DATA__').html();
    if (!scriptContent) return null;
    return JSON.parse(scriptContent) as SubitoNextData;
  } catch {
    return null;
  }
}

/**
 * Fetch a single Subito.it listing detail page and extract the full SubitoItem.
 *
 * Subito detail pages expose full data in __NEXT_DATA__.props.pageProps.ad,
 * which contains complete feature arrays, all images, and geo data.
 */
export async function fetchDetailPage(
  sourceUrl: string,
  retries = 3
): Promise<SubitoItem | null> {
  const url = sourceUrl.startsWith('http') ? sourceUrl : `${BASE_URL}${sourceUrl}`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await axios.get<string>(url, {
        timeout: 30000,
        headers: {
          'User-Agent': getRandomUserAgent(),
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
          Referer: 'https://www.subito.it/',
        },
      });

      const nextData = extractNextData(response.data);
      if (!nextData?.props?.pageProps) {
        console.warn(JSON.stringify({
          level: 'warn', service: 'subito-scraper',
          msg: 'No __NEXT_DATA__ on detail page', url,
        }));
        return null;
      }

      const ad = nextData.props.pageProps.ad;
      if (!ad) {
        // Detail page may embed the listing in items[] as first element
        const items = nextData.props.pageProps.items;
        if (items && items.length > 0) return items[0];
        return null;
      }

      return ad;
    } catch (error: any) {
      const status = error.response?.status;

      if (status === 429 || status === 503) {
        const backoff = Math.pow(2, attempt) * 1500 + Math.random() * 500;
        console.warn(JSON.stringify({
          level: 'warn', service: 'subito-scraper',
          msg: `Detail page HTTP ${status} - backing off`, url, backoff, attempt,
        }));
        await delay(backoff);
        continue;
      }

      if (status === 404 || status === 410) {
        // Listing removed
        console.info(JSON.stringify({
          level: 'info', service: 'subito-scraper',
          msg: 'Listing no longer available', url, status,
        }));
        return null;
      }

      if (attempt === retries) {
        console.error(JSON.stringify({
          level: 'error', service: 'subito-scraper',
          msg: 'Detail page fetch failed', url, err: error.message,
        }));
        return null;
      }

      await delay(600 * (attempt + 1));
    }
  }

  return null;
}
