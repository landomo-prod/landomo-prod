import axios from 'axios';
import { NyboligCase, NyboligSearchResponse, NyboligSearchRequest } from '../types/nyboligTypes';
import { transformListing, TransformedProperty } from '../transformers';
import { sendBatch } from '../adapters/ingestAdapter';
import { getRandomUserAgent } from '../utils/userAgents';

const NYBOLIG_API_URL = 'https://www.nybolig.dk/api/search/cases/find';
const PAGE_SIZE = 100;    // max listings per API request
const BATCH_SIZE = 500;   // max listings per ingest batch
const REQUEST_DELAY_MS = parseInt(process.env.REQUEST_DELAY_MS || '300', 10);
const SITE_NAME = 'nybolig';

export interface ScrapeStats {
  total: number;
  fetched: number;
  transformed: number;
  ingested: number;
  failed: number;
  skipped: number;
}

interface ScrapeMode {
  isRental: boolean;
  label: string;
}

const SCRAPE_MODES: ScrapeMode[] = [
  { isRental: false, label: 'for-sale' },
  { isRental: true, label: 'for-rent' },
];

/**
 * Fetch one page from the nybolig search API using scroll-token pagination.
 * The API uses cursor-based pagination via scrollToken rather than page numbers.
 */
async function fetchPage(
  scrollToken: string,
  isRental: boolean
): Promise<NyboligSearchResponse> {
  const requestBody: NyboligSearchRequest = {
    siteName: SITE_NAME,
    top: PAGE_SIZE,
    scrollToken,
    isRental,
  };

  const response = await axios.post<NyboligSearchResponse>(
    NYBOLIG_API_URL,
    requestBody,
    {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': getRandomUserAgent(),
        Referer: 'https://www.nybolig.dk/soegeresultat-boliger',
        Origin: 'https://www.nybolig.dk',
      },
      timeout: 30_000,
    }
  );

  return response.data;
}

/**
 * Sleep for `ms` milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Transform and batch-ingest a set of raw cases.
 * Returns counts of transformed, ingested, failed.
 */
async function processBatch(
  cases: NyboligCase[],
  log: (msg: string) => void
): Promise<{ transformed: number; ingested: number; failed: number; skipped: number }> {
  const batch: Array<{ portalId: string; property: TransformedProperty; rawData: object }> = [];
  let skipped = 0;

  for (const c of cases) {
    const result = transformListing(c);
    if (!result) {
      skipped++;
      continue;
    }
    batch.push({
      portalId: c.caseNumber || c.id,
      property: result.property,
      rawData: c as unknown as object,
    });
  }

  if (batch.length === 0) {
    return { transformed: 0, ingested: 0, failed: 0, skipped };
  }

  try {
    await sendBatch(batch);
    return { transformed: batch.length, ingested: batch.length, failed: 0, skipped };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    log(`Ingest batch failed: ${errMsg}`);
    return { transformed: batch.length, ingested: 0, failed: batch.length, skipped };
  }
}

/**
 * Run the full scrape for one mode (for-sale or for-rent).
 * Uses scrollToken cursor-based pagination until all listings are fetched.
 */
async function scrapeMode(
  mode: ScrapeMode,
  stats: ScrapeStats,
  log: (msg: string) => void
): Promise<void> {
  log(`Starting ${mode.label} scrape`);

  let scrollToken = '';
  let pageNum = 0;
  let totalReported = 0;
  let buffer: NyboligCase[] = [];

  while (true) {
    pageNum++;

    let response: NyboligSearchResponse;
    try {
      response = await fetchPage(scrollToken, mode.isRental);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      log(`Page ${pageNum} fetch error: ${errMsg}`);
      stats.failed += buffer.length;
      break;
    }

    if (pageNum === 1) {
      totalReported = response.total;
      stats.total += totalReported;
      log(`${mode.label}: ${totalReported} total listings`);
    }

    const { cases, scrollToken: nextToken } = response;

    if (cases.length === 0) {
      log(`${mode.label}: no more results after page ${pageNum - 1}`);
      break;
    }

    stats.fetched += cases.length;
    buffer.push(...cases);

    log(
      `${mode.label} page ${pageNum}: fetched ${cases.length} (${stats.fetched}/${totalReported})`
    );

    // Flush buffer when it reaches BATCH_SIZE
    while (buffer.length >= BATCH_SIZE) {
      const chunk = buffer.splice(0, BATCH_SIZE);
      const result = await processBatch(chunk, log);
      stats.transformed += result.transformed;
      stats.ingested += result.ingested;
      stats.failed += result.failed;
      stats.skipped += result.skipped;
      log(`Ingested batch: ${result.ingested} properties (${result.skipped} skipped, ${result.failed} failed)`);
    }

    // Stop if no more scroll token or we've seen all
    if (!nextToken || cases.length < PAGE_SIZE) {
      break;
    }

    scrollToken = nextToken;
    await sleep(REQUEST_DELAY_MS);
  }

  // Flush remaining buffer
  if (buffer.length > 0) {
    const result = await processBatch(buffer, log);
    stats.transformed += result.transformed;
    stats.ingested += result.ingested;
    stats.failed += result.failed;
    stats.skipped += result.skipped;
    log(`Final batch: ${result.ingested} properties (${result.skipped} skipped, ${result.failed} failed)`);
    buffer = [];
  }
}

/**
 * Main scrape entry point.
 * Scrapes all for-sale listings and all for-rent listings from nybolig.dk.
 */
export async function runScrape(log: (msg: string) => void): Promise<ScrapeStats> {
  const stats: ScrapeStats = {
    total: 0,
    fetched: 0,
    transformed: 0,
    ingested: 0,
    failed: 0,
    skipped: 0,
  };

  for (const mode of SCRAPE_MODES) {
    await scrapeMode(mode, stats, log);
  }

  return stats;
}
