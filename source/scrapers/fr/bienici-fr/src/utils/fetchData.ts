import axios from 'axios';
import { getRealisticHeaders, getRandomDelay } from './headers';
import { bieniciRateLimiter } from './rateLimiter';
import { BieniciApiResponse, BieniciListingRaw, PriceBandConfig } from '../types/bieniciTypes';

const BASE_URL = 'https://www.bienici.com/realEstateAds.json';
const PAGE_SIZE = 200;
const MAX_OFFSET = 2468; // bienici caps results at ~2,468 items per query

/**
 * Fetch a single page of search results from bienici API
 */
async function fetchSearchPage(config: PriceBandConfig, offset: number): Promise<BieniciApiResponse> {
  await bieniciRateLimiter.throttle();
  await new Promise(resolve => setTimeout(resolve, getRandomDelay(300, 800)));

  const filters: Record<string, any> = {
    size: PAGE_SIZE,
    from: offset,
    filterType: config.filterType,
  };

  if (config.minPrice !== undefined) {
    filters.minPrice = config.minPrice;
  }
  if (config.maxPrice !== undefined) {
    filters.maxPrice = config.maxPrice;
  }

  const response = await axios.get(BASE_URL, {
    params: {
      filters: JSON.stringify(filters),
    },
    headers: getRealisticHeaders(),
    timeout: 30000,
  });

  return response.data as BieniciApiResponse;
}

/**
 * Fetch all pages for a given price band configuration
 */
export async function fetchAllSearchPages(config: PriceBandConfig): Promise<BieniciListingRaw[]> {
  const allListings: BieniciListingRaw[] = [];
  let offset = 0;

  const firstPage = await fetchSearchPage(config, 0);
  const total = Math.min(firstPage.total, MAX_OFFSET + PAGE_SIZE);

  for (const ad of firstPage.realEstateAds) {
    ad.portalId = `bienici-${ad.id}`;
    allListings.push(ad);
  }

  offset += PAGE_SIZE;

  while (offset <= MAX_OFFSET && offset < total) {
    try {
      const page = await fetchSearchPage(config, offset);

      if (!page.realEstateAds || page.realEstateAds.length === 0) break;

      for (const ad of page.realEstateAds) {
        ad.portalId = `bienici-${ad.id}`;
        allListings.push(ad);
      }

      offset += PAGE_SIZE;
    } catch (error: any) {
      console.error(JSON.stringify({
        level: 'error',
        service: 'bienici-scraper',
        msg: 'Page fetch failed',
        offset,
        config: config.label,
        err: error.message,
      }));
      break;
    }
  }

  return allListings;
}
