import axios from 'axios';
import { MblSaleListing, MblRentalListing } from '../types/mblTypes';

const GRAPHQL_URL = 'https://g.mbl.is/v1/graphql';
const PAGE_SIZE = 100;
const DELAY_MS = 300;

const SALE_FIELDS = `
  eign_id
  heimilisfang
  gata
  postfang
  hverfi
  verd
  fermetrar
  fjoldi_herb
  fjoldi_svefnhb
  fjoldi_badherb
  teg_eign
  bygg_ar
  lyfta
  bilskur
  gardur
  svalir
  parking
  latitude
  longitude
  lysing
  created
  syna
  images { big small regular regular_h }
  postal_code { city }
`;

const RENTAL_FIELDS = `
  id
  address
  zipcode
  price
  size
  rooms
  description
  lift
  pet_allowed
  available_from
  type_id
  created
  images { big small regular }
  postal_code { city }
`;

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function graphqlRequest<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const response = await axios.post<{ data: T; errors?: { message: string }[] }>(
    GRAPHQL_URL,
    { query, variables },
    {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      timeout: 30000,
    }
  );

  if (response.data.errors && response.data.errors.length > 0) {
    throw new Error(`GraphQL error: ${response.data.errors[0].message}`);
  }

  return response.data.data;
}

/** Fetch total count of visible sale listings */
async function fetchSaleCount(): Promise<number> {
  const query = `
    query {
      fs_fasteign_aggregate(where: { syna: { _eq: true } }) {
        aggregate { count }
      }
    }
  `;

  const data = await graphqlRequest<{
    fs_fasteign_aggregate: { aggregate: { count: number } };
  }>(query);

  return data.fs_fasteign_aggregate.aggregate.count;
}

/** Fetch total count of rental listings */
async function fetchRentalCount(): Promise<number> {
  const query = `
    query {
      rentals_property_aggregate {
        aggregate { count }
      }
    }
  `;

  const data = await graphqlRequest<{
    rentals_property_aggregate: { aggregate: { count: number } };
  }>(query);

  return data.rentals_property_aggregate.aggregate.count;
}

/** Fetch a page of sale listings */
async function fetchSalePage(offset: number): Promise<MblSaleListing[]> {
  const query = `
    query GetSaleListings($limit: Int!, $offset: Int!) {
      fs_fasteign(
        where: { syna: { _eq: true } }
        order_by: { created: desc }
        limit: $limit
        offset: $offset
      ) {
        ${SALE_FIELDS}
      }
    }
  `;

  const data = await graphqlRequest<{ fs_fasteign: MblSaleListing[] }>(query, {
    limit: PAGE_SIZE,
    offset,
  });

  return data.fs_fasteign;
}

/** Fetch a page of rental listings */
async function fetchRentalPage(offset: number): Promise<MblRentalListing[]> {
  const query = `
    query GetRentalListings($limit: Int!, $offset: Int!) {
      rentals_property(
        order_by: { created: desc }
        limit: $limit
        offset: $offset
      ) {
        ${RENTAL_FIELDS}
      }
    }
  `;

  const data = await graphqlRequest<{ rentals_property: MblRentalListing[] }>(query, {
    limit: PAGE_SIZE,
    offset,
  });

  return data.rentals_property;
}

export interface ScrapeResult {
  sales: MblSaleListing[];
  rentals: MblRentalListing[];
}

export type SalesBatchCallback = (batch: MblSaleListing[]) => Promise<void>;
export type RentalsBatchCallback = (batch: MblRentalListing[]) => Promise<void>;

/**
 * Scrape all sale listings from mbl.is, streaming in pages.
 */
export async function scrapeSales(onBatch?: SalesBatchCallback): Promise<MblSaleListing[]> {
  const totalCount = await fetchSaleCount();

  console.log(JSON.stringify({
    level: 'info',
    service: 'mbl-scraper',
    msg: 'Starting sale listings scrape',
    totalCount,
    pages: Math.ceil(totalCount / PAGE_SIZE),
  }));

  const allListings: MblSaleListing[] = [];
  let offset = 0;

  while (offset < totalCount) {
    let page: MblSaleListing[];

    try {
      page = await fetchSalePage(offset);
    } catch (err: any) {
      console.error(JSON.stringify({
        level: 'error',
        service: 'mbl-scraper',
        msg: 'Failed to fetch sale page',
        offset,
        err: err.message,
      }));
      break;
    }

    if (page.length === 0) break;

    allListings.push(...page);

    console.log(JSON.stringify({
      level: 'info',
      service: 'mbl-scraper',
      msg: 'Sale page fetched',
      offset,
      pageSize: page.length,
      totalFetched: allListings.length,
      totalCount,
    }));

    if (onBatch) {
      try {
        await onBatch(page);
      } catch (err: any) {
        console.error(JSON.stringify({
          level: 'error',
          service: 'mbl-scraper',
          msg: 'Batch callback failed',
          offset,
          err: err.message,
        }));
      }
    }

    offset += page.length;

    if (page.length === PAGE_SIZE && offset < totalCount) {
      await sleep(DELAY_MS);
    }
  }

  console.log(JSON.stringify({
    level: 'info',
    service: 'mbl-scraper',
    msg: 'Sale listings scrape complete',
    total: allListings.length,
    expected: totalCount,
  }));

  return allListings;
}

/**
 * Scrape all rental listings from mbl.is, streaming in pages.
 */
export async function scrapeRentals(onBatch?: RentalsBatchCallback): Promise<MblRentalListing[]> {
  const totalCount = await fetchRentalCount();

  console.log(JSON.stringify({
    level: 'info',
    service: 'mbl-scraper',
    msg: 'Starting rental listings scrape',
    totalCount,
    pages: Math.ceil(totalCount / PAGE_SIZE),
  }));

  const allListings: MblRentalListing[] = [];
  let offset = 0;

  while (offset < totalCount) {
    let page: MblRentalListing[];

    try {
      page = await fetchRentalPage(offset);
    } catch (err: any) {
      console.error(JSON.stringify({
        level: 'error',
        service: 'mbl-scraper',
        msg: 'Failed to fetch rental page',
        offset,
        err: err.message,
      }));
      break;
    }

    if (page.length === 0) break;

    allListings.push(...page);

    console.log(JSON.stringify({
      level: 'info',
      service: 'mbl-scraper',
      msg: 'Rental page fetched',
      offset,
      pageSize: page.length,
      totalFetched: allListings.length,
      totalCount,
    }));

    if (onBatch) {
      try {
        await onBatch(page);
      } catch (err: any) {
        console.error(JSON.stringify({
          level: 'error',
          service: 'mbl-scraper',
          msg: 'Rental batch callback failed',
          offset,
          err: err.message,
        }));
      }
    }

    offset += page.length;

    if (page.length === PAGE_SIZE && offset < totalCount) {
      await sleep(DELAY_MS);
    }
  }

  console.log(JSON.stringify({
    level: 'info',
    service: 'mbl-scraper',
    msg: 'Rental listings scrape complete',
    total: allListings.length,
    expected: totalCount,
  }));

  return allListings;
}
