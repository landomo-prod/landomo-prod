import axios from 'axios';
import { UlovDomovDetailData } from '../types/ulovdomovTypes';

const DETAIL_TIMEOUT = 15000;
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;
const DETAIL_FETCH_DELAY_MS = 200;

const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
];

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch a UlovDomov detail page and extract __NEXT_DATA__ from HTML.
 * URL pattern: https://www.ulovdomov.cz/inzerat/{seo}/{id}
 *
 * Retries up to 3 times with exponential backoff on transient errors.
 * Adds a small delay between fetches for rate limiting.
 * Returns the pageProps from __NEXT_DATA__, or null on failure.
 */
export async function fetchDetailPage(seo: string, id: number): Promise<UlovDomovDetailData | null> {
  const url = `https://www.ulovdomov.cz/inzerat/${seo}/${id}`;

  // Rate limiting delay between requests
  await sleep(DETAIL_FETCH_DELAY_MS);

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

      const response = await axios.get(url, {
        timeout: DETAIL_TIMEOUT,
        headers: {
          'User-Agent': userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'cs-CZ,cs;q=0.9,en;q=0.8',
          'Referer': 'https://www.ulovdomov.cz/',
        },
        responseType: 'text',
      });

      const html: string = response.data;

      // Extract __NEXT_DATA__ JSON blob
      const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
      if (!match || !match[1]) {
        return null;
      }

      const nextData = JSON.parse(match[1]);
      const pageProps = nextData?.props?.pageProps;

      if (!pageProps) {
        return null;
      }

      // Extract the fields we care about
      const detail: UlovDomovDetailData = {
        parameters: pageProps.parameters ?? pageProps.offer?.parameters ?? undefined,
        owner: pageProps.owner ?? pageProps.offer?.owner ?? undefined,
        district: pageProps.district ?? pageProps.offer?.district ?? undefined,
        region: pageProps.region ?? pageProps.offer?.region ?? undefined,
        publishedAt: pageProps.publishedAt ?? pageProps.offer?.publishedAt ?? undefined,
        matterportUrl: pageProps.matterportUrl ?? pageProps.offer?.matterportUrl ?? undefined,
      };

      return detail;
    } catch (error: any) {
      const status = error?.response?.status;
      const isRetryable = !status || status === 429 || status >= 500;

      if (isRetryable && attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        console.warn(`[ulovdomov] Detail fetch attempt ${attempt}/${MAX_RETRIES} failed for ${id} (status=${status || 'network'}), retrying in ${delay}ms`);
        await sleep(delay);
        continue;
      }

      console.error(`[ulovdomov] Detail fetch failed for ${id} after ${attempt} attempts: ${error.message}`);
      return null;
    }
  }

  return null;
}
