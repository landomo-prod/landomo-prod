import axios, { AxiosInstance } from 'axios';
import pLimit from 'p-limit';
import {
  SubitoItem,
  SubitoHadesResponse,
  SubitoMinimalListing,
  SubitoSearchConfig,
  SubitoCategory,
  SubitoContract,
  SUBITO_REGIONS,
  SUBITO_CATEGORY_IDS,
  SUBITO_CONTRACT_KEYS,
} from '../types/subitoTypes';
import { getRandomUserAgent } from '../utils/userAgents';
import { extractIdFromUrn, getFeatureValueByUri, parseNumeric, buildSourceUrl } from '../utils/subitoHelpers';

/**
 * Subito.it Hades REST API base URL.
 * Returns clean JSON - no HTML parsing required.
 * Working params: q=appartamento&c={category_id}&r={region_id}&t={s|k}&lim={n}&start={n}
 */
const HADES_BASE_URL = 'https://hades.subito.it/v1/search/items';

const PAGE_SIZE = 35;   // Hades API default page size
const MAX_PAGES = 100;  // Safety cap per region+category (35*100=3500 listings max)

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Build Hades API query params.
 * Uses q= text + c= category + r= region + t= type (s=sale, k=rent)
 */
function buildHadesParams(
  config: SubitoSearchConfig,
  start: number
): Record<string, string | number> {
  const q = config.category === 'appartamenti' ? 'appartamento' : 'casa villa';
  return {
    q,
    c: SUBITO_CATEGORY_IDS[config.category],
    r: config.regionId,
    t: SUBITO_CONTRACT_KEYS[config.contract],
    lim: PAGE_SIZE,
    start,
  };
}

function itemToMinimal(item: SubitoItem, config: SubitoSearchConfig): SubitoMinimalListing {
  const id = extractIdFromUrn(item.urn);

  // Price is in features with uri="/price", value like "28000 €"
  const priceStr = getFeatureValueByUri(item.features, '/price');
  const price = parseNumeric(priceStr);

  // Surface area is in features with uri="/size", value like "74 mq"
  const sqmStr = getFeatureValueByUri(item.features, '/size');
  const sqm = parseNumeric(sqmStr);

  const city = item.geo?.city?.short_name || item.geo?.city?.value;
  const date = item.dates?.display_iso8601 || item.dates?.display;

  return {
    portalId: id,
    urn: item.urn,
    subject: item.subject,
    price,
    sqm,
    city,
    date,
    sourceUrl: buildSourceUrl(item),
    config,
    item,
  };
}

export class ListingsScraper {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: HADES_BASE_URL,
      timeout: 30000,
      headers: {
        Accept: 'application/json, text/plain, */*',
        'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        Referer: 'https://www.subito.it/',
        Origin: 'https://www.subito.it',
        Connection: 'keep-alive',
      },
    });
  }

  private async fetchPage(
    config: SubitoSearchConfig,
    start: number,
    retries = 3
  ): Promise<{ items: SubitoItem[]; totalCount: number }> {
    const params = buildHadesParams(config, start);

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await this.client.get<SubitoHadesResponse>('', {
          params,
          headers: { 'User-Agent': getRandomUserAgent() },
        });

        const data = response.data;
        if (!data || !Array.isArray(data.ads)) {
          console.warn(JSON.stringify({
            level: 'warn', service: 'subito-scraper',
            msg: 'Unexpected Hades API response shape', start, params,
          }));
          return { items: [], totalCount: 0 };
        }

        // Filter by contract type (sale vs rent) since the API may mix types
        // The t= param already filters by contract type server-side
        const filtered = data.ads;

        return { items: filtered, totalCount: data.count_all };
      } catch (error: any) {
        const status = error.response?.status;

        if (status === 403 || status === 400) {
          console.warn(JSON.stringify({
            level: 'warn', service: 'subito-scraper',
            msg: `Hades API ${status} - skipping`, start,
            category: config.category, region: config.regionSlug,
            err: error.response?.data?.errors?.[0]?.info || error.message,
          }));
          return { items: [], totalCount: 0 };
        }

        if (status === 429 || status === 503) {
          const backoff = Math.pow(2, attempt) * 1000 + Math.random() * 500;
          console.warn(JSON.stringify({
            level: 'warn', service: 'subito-scraper',
            msg: `HTTP ${status} - backing off`, start, backoff, attempt,
          }));
          await delay(backoff);
          continue;
        }

        if (attempt === retries) {
          console.error(JSON.stringify({
            level: 'error', service: 'subito-scraper',
            msg: 'Hades API request failed after retries',
            start, params, err: error.message,
          }));
          return { items: [], totalCount: 0 };
        }

        await delay(500 * (attempt + 1));
      }
    }

    return { items: [], totalCount: 0 };
  }

  async scrapeSearch(
    config: SubitoSearchConfig,
    onBatch?: (batch: SubitoMinimalListing[], config: SubitoSearchConfig) => Promise<void>
  ): Promise<SubitoMinimalListing[]> {
    const allListings: SubitoMinimalListing[] = [];

    // Fetch first page to get total count
    const firstPage = await this.fetchPage(config, 0);
    const firstListings = firstPage.items.map(item => itemToMinimal(item, config));
    allListings.push(...firstListings);

    console.log(JSON.stringify({
      level: 'info', service: 'subito-scraper',
      msg: 'First page fetched via Hades API',
      category: config.category, contract: config.contract,
      region: config.regionSlug, totalCount: firstPage.totalCount,
      count: firstListings.length,
    }));

    if (onBatch && firstListings.length > 0) {
      await onBatch(firstListings, config);
    }

    const maxOffset = Math.min(firstPage.totalCount, MAX_PAGES * PAGE_SIZE);

    for (let start = PAGE_SIZE; start < maxOffset; start += PAGE_SIZE) {
      await delay(300);

      try {
        const { items } = await this.fetchPage(config, start);
        if (items.length === 0) break;

        const listings = items.map(item => itemToMinimal(item, config));
        allListings.push(...listings);

        if (onBatch && listings.length > 0) {
          await onBatch(listings, config);
        }
      } catch (err: any) {
        console.error(JSON.stringify({
          level: 'error', service: 'subito-scraper',
          msg: 'Page fetch error', start, region: config.regionSlug,
          category: config.category, err: err.message,
        }));
        break;
      }
    }

    return allListings;
  }

  async scrapeAll(
    onBatch?: (batch: SubitoMinimalListing[], config: SubitoSearchConfig) => Promise<void>
  ): Promise<SubitoMinimalListing[]> {
    const limit = pLimit(3);
    const allListings: SubitoMinimalListing[] = [];

    const categories: SubitoCategory[] = ['appartamenti', 'case-ville'];
    const contracts: SubitoContract[] = ['vendita', 'affitto'];

    const tasks: Array<() => Promise<void>> = [];

    for (const category of categories) {
      for (const contract of contracts) {
        for (const region of SUBITO_REGIONS) {
          const config: SubitoSearchConfig = {
            category,
            contract,
            regionSlug: region.regionSlug,
            regionId: region.regionId,
          };
          tasks.push(async () => {
            const listings = await this.scrapeSearch(config, onBatch);
            allListings.push(...listings);
          });
        }
      }
    }

    await Promise.all(tasks.map(task => limit(task)));

    console.log(JSON.stringify({
      level: 'info', service: 'subito-scraper',
      msg: 'All searches complete', totalListings: allListings.length,
    }));

    return allListings;
  }
}
