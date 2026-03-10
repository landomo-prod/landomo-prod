import axios from 'axios';
import { BoligsidenCase, BoligsidenSearchResponse, ALL_ADDRESS_TYPES } from '../types/boligsidenTypes';
import { getRandomUserAgent } from '../utils/userAgents';

const BOLIGSIDEN_API_BASE = 'https://api.boligsiden.dk';
const PAGE_SIZE = 100;
const DELAY_BETWEEN_PAGES_MS = 300;
const DELAY_BETWEEN_TYPES_MS = 500;

/**
 * Fetch a single page of listings for a given address type
 */
async function fetchPage(
  addressType: string,
  pageNumber: number,
): Promise<{ cases: BoligsidenCase[]; totalHits: number }> {
  const params = new URLSearchParams({
    pageSize: String(PAGE_SIZE),
    pageNumber: String(pageNumber),
    addressTypes: addressType,
  });

  const response = await axios.get<BoligsidenSearchResponse>(
    `${BOLIGSIDEN_API_BASE}/search/cases?${params.toString()}`,
    {
      headers: {
        'User-Agent': getRandomUserAgent(),
        Accept: 'application/json',
        'Accept-Language': 'da-DK,da;q=0.9,en;q=0.8',
      },
      timeout: 30000,
    }
  );

  if (!response.data || !Array.isArray(response.data.cases)) {
    throw new Error(`Invalid API response for addressType=${addressType} page=${pageNumber}`);
  }

  return {
    cases: response.data.cases,
    totalHits: response.data.totalHits || 0,
  };
}

/**
 * Scrape all listings for a specific address type
 */
async function scrapeAddressType(
  addressType: string,
  onBatch?: (batch: BoligsidenCase[]) => Promise<void>
): Promise<BoligsidenCase[]> {
  const allCases: BoligsidenCase[] = [];
  let pageNumber = 1;
  let totalHits = 0;

  console.log(JSON.stringify({
    level: 'info',
    service: 'boligsiden-scraper',
    msg: 'Scraping address type',
    addressType,
  }));

  do {
    let cases: BoligsidenCase[];

    try {
      const result = await fetchPage(addressType, pageNumber);
      cases = result.cases;
      totalHits = result.totalHits;
    } catch (err: any) {
      console.error(JSON.stringify({
        level: 'error',
        service: 'boligsiden-scraper',
        msg: 'Failed to fetch page',
        addressType,
        pageNumber,
        err: err.message,
      }));
      break;
    }

    if (cases.length === 0) {
      break;
    }

    allCases.push(...cases);

    if (onBatch && cases.length > 0) {
      try {
        await onBatch(cases);
      } catch (err: any) {
        console.error(JSON.stringify({
          level: 'error',
          service: 'boligsiden-scraper',
          msg: 'Failed to process batch',
          addressType,
          pageNumber,
          err: err.message,
        }));
      }
    }

    console.log(JSON.stringify({
      level: 'info',
      service: 'boligsiden-scraper',
      msg: 'Page scraped',
      addressType,
      pageNumber,
      casesOnPage: cases.length,
      totalSoFar: allCases.length,
      totalHits,
    }));

    pageNumber++;

    // Delay between pages to be respectful
    if (cases.length === PAGE_SIZE) {
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_PAGES_MS));
    }
  } while (allCases.length < totalHits && pageNumber <= Math.ceil(totalHits / PAGE_SIZE));

  console.log(JSON.stringify({
    level: 'info',
    service: 'boligsiden-scraper',
    msg: 'Address type complete',
    addressType,
    total: allCases.length,
    totalHits,
  }));

  return allCases;
}

/**
 * Scrape all listings from boligsiden.dk across all address types
 *
 * @param onBatch - Optional streaming callback, called after each page per address type
 * @returns All scraped listings
 */
export async function scrapeAll(
  onBatch?: (batch: BoligsidenCase[]) => Promise<void>
): Promise<BoligsidenCase[]> {
  const allCases: BoligsidenCase[] = [];

  console.log(JSON.stringify({
    level: 'info',
    service: 'boligsiden-scraper',
    msg: 'Starting Boligsiden scrape',
    addressTypes: ALL_ADDRESS_TYPES,
    streamingMode: !!onBatch,
  }));

  for (const addressType of ALL_ADDRESS_TYPES) {
    const cases = await scrapeAddressType(addressType, onBatch);
    allCases.push(...cases);

    // Delay between address types
    await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_TYPES_MS));
  }

  console.log(JSON.stringify({
    level: 'info',
    service: 'boligsiden-scraper',
    msg: 'Boligsiden scrape complete',
    totalListings: allCases.length,
  }));

  return allCases;
}
