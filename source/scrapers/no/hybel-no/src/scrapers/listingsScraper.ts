import axios, { AxiosInstance } from 'axios';
import * as cheerio from 'cheerio';
import pLimit from 'p-limit';
import { createLogger } from '@landomo/core';
import { HybelListingSummary, HybelListingDetail } from '../types/hybelTypes';
import { getDefaultHeaders } from '../utils/userAgents';
import {
  parsePrice,
  parseFloor,
  parseNorwegianDate,
} from '../utils/categoryDetector';

const BASE_URL = 'https://www.hybel.no';
// Scrape all of Norway (not just Oslo) for full national coverage
const SEARCH_BASE = `${BASE_URL}/bolig-til-leie/Norge/`;
const LISTINGS_PER_PAGE = 12;
const REQUEST_DELAY_MS = parseInt(process.env.REQUEST_DELAY_MS || '500', 10);
const DETAIL_CONCURRENCY = parseInt(process.env.DETAIL_CONCURRENCY || '5', 10);

const log = createLogger({ service: 'hybel-scraper', portal: 'hybel-no', country: 'norway' });

function createHttpClient(): AxiosInstance {
  return axios.create({
    timeout: 30000,
    headers: getDefaultHeaders(),
    decompress: true,
  });
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch one listing page and return summary items found on it.
 */
async function fetchListingPage(
  client: AxiosInstance,
  page: number
): Promise<{ summaries: HybelListingSummary[]; totalPages: number; totalListings: number }> {
  const url = `${SEARCH_BASE}?page=${page}`;

  const response = await client.get(url, { headers: getDefaultHeaders() });
  const $ = cheerio.load(response.data as string);

  // Parse total count and pages
  let totalListings = 0;
  let totalPages = 1;

  // Find the listing count from the page text
  const countMatch = (response.data as string).match(/<strong>(\d+)<\/strong>\s*treff/);
  if (countMatch) {
    totalListings = parseInt(countMatch[1], 10);
    totalPages = Math.ceil(totalListings / LISTINGS_PER_PAGE);
  }

  // Parse pages from pagination
  const pageText = $('.pagination-hybel').text();
  const pageMatch = pageText.match(/av\s+(\d+)/);
  if (pageMatch) {
    totalPages = parseInt(pageMatch[1], 10);
  }

  const summaries: HybelListingSummary[] = [];

  $('a.card.card-listing').each((_, el) => {
    const $card = $(el);
    const href = $card.attr('href') || '';
    const id = $card.attr('id') || '';

    if (!id || !href) return;

    const title = $card.find('.card-title').text().replace(/\s+/g, ' ').trim();
    const address = $card.find('p').first().text().trim();
    const priceRaw = $card.find('.listing-price').text().trim();
    const imageUrl = $card.find('img.card-img-top').attr('src') || null;
    const altText = $card.find('img.card-img-top').attr('alt') || '';
    const isPremium = $card.find('.badge-premium').length > 0;

    summaries.push({
      id,
      url: `${BASE_URL}${href}`,
      title,
      address,
      priceRaw,
      imageUrl,
      housingTypeRaw: altText, // alt text on the image is the housing type
      isPremium,
    });
  });

  return { summaries, totalPages, totalListings };
}

/**
 * Fetch all listing summaries across all pages.
 */
export async function fetchAllListingSummaries(): Promise<{
  summaries: HybelListingSummary[];
  totalListings: number;
}> {
  const client = createHttpClient();

  log.info({ url: SEARCH_BASE }, 'Fetching first page to determine total count');
  const firstPage = await fetchListingPage(client, 1);
  log.info(
    { totalListings: firstPage.totalListings, totalPages: firstPage.totalPages },
    'Determined pagination'
  );

  const allSummaries = [...firstPage.summaries];

  for (let page = 2; page <= firstPage.totalPages; page++) {
    await delay(REQUEST_DELAY_MS);
    try {
      const result = await fetchListingPage(client, page);
      allSummaries.push(...result.summaries);
      if (page % 10 === 0) {
        log.info({ page, totalPages: firstPage.totalPages, collected: allSummaries.length }, 'Pagination progress');
      }
    } catch (err: any) {
      log.warn({ page, err: err.message }, 'Failed to fetch listing page, skipping');
    }
  }

  log.info({ total: allSummaries.length }, 'Finished fetching all listing summaries');
  return { summaries: allSummaries, totalListings: firstPage.totalListings };
}

/**
 * Parse amenities from the detail page amenities list.
 */
function parseAmenities($: cheerio.CheerioAPI): Record<string, boolean> {
  const amenityText = $('ul.amenities').text().toLowerCase();

  return {
    hasBroadband: amenityText.includes('bredbånd'),
    hasWashingMachine: amenityText.includes('vaskemaskin'),
    hasDishwasher: amenityText.includes('oppvask'),
    hasParking: amenityText.includes('parkering') || amenityText.includes('garasje'),
    hasFurnished: amenityText.includes('møblert'),
    hasElevator: amenityText.includes('heis'),
    hasBalcony: amenityText.includes('balkong'),
    hasTerrace: amenityText.includes('terrasse'),
    hasFireplace: amenityText.includes('peis') || amenityText.includes('ildsted'),
    hasGarden: amenityText.includes('hage'),
    hasGarage: amenityText.includes('garasje'),
    hasBasement: amenityText.includes('kjeller'),
    hasBathroom: true, // All rentals have bathrooms
    hasWhiteGoods: amenityText.includes('hvitevarer'),
  };
}

/**
 * Parse the detail key-value pairs from the overview section.
 */
function parseDetailFields($: cheerio.CheerioAPI): Record<string, string> {
  const fields: Record<string, string> = {};

  $('.overview ul li').each((_, el) => {
    const $li = $(el);
    const key = $li.find('strong').text().trim();
    // Get text excluding the strong element
    const $liClone = $li.clone();
    $liClone.find('strong').remove();
    const value = $liClone.text().replace(/\s+/g, ' ').trim();
    if (key) fields[key] = value;
  });

  return fields;
}

/**
 * Fetch and parse a single listing detail page.
 */
export async function fetchListingDetail(
  client: AxiosInstance,
  summary: HybelListingSummary
): Promise<HybelListingDetail | null> {
  try {
    const response = await client.get(summary.url, { headers: getDefaultHeaders() });
    const $ = cheerio.load(response.data as string);

    const fields = parseDetailFields($);
    const amenities = parseAmenities($);

    // Parse sqm from the Areal field or from the title
    let sqm: number | null = null;
    const arealField = fields['Areal'] || '';
    const sqmMatch = arealField.match(/(\d+)/);
    if (sqmMatch) sqm = parseInt(sqmMatch[1], 10);

    // Parse rooms
    let rooms: number | null = null;
    const roomField = fields['Antall rom'] || '';
    const roomMatch = roomField.match(/(\d+)/);
    if (roomMatch) rooms = parseInt(roomMatch[1], 10);

    // Parse bedrooms
    let bedrooms: number | null = null;
    const bedroomField = fields['Antall soverom'] || '';
    const bedroomMatch = bedroomField.match(/(\d+)/);
    if (bedroomMatch) bedrooms = parseInt(bedroomMatch[1], 10);

    // Parse floor
    const floor = parseFloor(fields['Etasje'] || '');

    // Parse monthly rent
    const monthlyRent = parsePrice(fields['Månedsleie'] || '');

    // Parse deposit
    const deposit = parsePrice(fields['Depositum'] || '');

    // Parse utilities included
    const utilitiesIncluded = (fields['Inkludert'] || '')
      .split(/,|\n/)
      .map(s => s.trim())
      .filter(Boolean);

    // Parse available from date
    const availableFromRaw = fields['Ledig fra'] || '';
    const availableFrom = availableFromRaw ? parseNorwegianDate(availableFromRaw) : null;

    // Parse lease type
    const leaseType = fields['Leieperiode'] || null;

    // Parse boligtype
    const boligtype = fields['Boligtype'] || null;

    // Parse address and postal code
    const addressText = $('.map-address span').last().text().trim();
    let postalCode: string | null = null;
    let city = '';
    const addressMatch = addressText.match(/^(.+),\s*(\d{4})\s+(.+)$/);
    if (addressMatch) {
      postalCode = addressMatch[2];
      city = addressMatch[3];
    } else {
      // Try simpler: "Markveien 4B, Oslo"
      const simpleMatch = summary.address.match(/,\s*(.+)$/);
      city = simpleMatch ? simpleMatch[1].trim() : '';
    }

    // Parse lat/lng from Google Maps embed src
    let lat: number | null = null;
    let lng: number | null = null;
    const mapSrc = $('iframe[title="Kartposisjon"]').attr('src') || '';
    const coordMatch = mapSrc.match(/q=([0-9.-]+)%2C([0-9.-]+)/);
    if (coordMatch) {
      lat = parseFloat(coordMatch[1]);
      lng = parseFloat(coordMatch[2]);
    }

    // Parse images from gallery
    const images: string[] = [];
    $('img').each((_, el) => {
      const src = $(el).attr('src') || '';
      if (src.includes('hybel-production') || src.includes('s3.amazonaws.com')) {
        // Prefer original over thumbnail by removing size suffix
        const original = src.replace(/\.\d+x\d+_q\d+[^.]*\./, '.');
        if (!images.includes(original)) images.push(original);
      }
    });

    // Parse description
    const description = $('h2:contains("Utfyllende informasjon")').next('p, div').text().trim()
      || $('#description').text().trim()
      || $('[class*="description"]').first().text().trim() || null;

    // Parse title from detail page h1 or first heading
    const detailTitle = $('h1').first().text().trim()
      || $('h2').first().text().trim()
      || summary.title;

    // Parse published date from meta or page content
    const publishedMeta = $('meta[itemprop="datePublished"]').attr('content') || null;

    // Housing type from card alt text or boligtype field
    const housingTypeRaw = boligtype || summary.housingTypeRaw;

    return {
      id: summary.id,
      url: summary.url,
      housingTypeRaw,
      boligtype,
      sqm,
      rooms,
      bedrooms,
      address: addressText || summary.address,
      postalCode,
      city,
      lat,
      lng,
      monthlyRent,
      deposit,
      utilitiesIncluded,
      leaseType,
      availableFrom,
      floor,
      ...amenities,
      title: detailTitle,
      description: description || null,
      images,
      isPremium: summary.isPremium,
      publishedDate: publishedMeta,
    } as HybelListingDetail;

  } catch (err: any) {
    log.warn({ id: summary.id, url: summary.url, err: err.message }, 'Failed to fetch listing detail');
    return null;
  }
}

/**
 * Fetch detail pages for a batch of summaries with controlled concurrency.
 */
export async function fetchListingDetails(
  summaries: HybelListingSummary[]
): Promise<HybelListingDetail[]> {
  const client = createHttpClient();
  const limit = pLimit(DETAIL_CONCURRENCY);
  const details: HybelListingDetail[] = [];
  let completed = 0;

  const tasks = summaries.map(summary =>
    limit(async () => {
      await delay(REQUEST_DELAY_MS + Math.random() * 200);
      const detail = await fetchListingDetail(client, summary);
      completed++;
      if (completed % 50 === 0) {
        log.info({ completed, total: summaries.length }, 'Detail fetch progress');
      }
      return detail;
    })
  );

  const results = await Promise.all(tasks);
  for (const r of results) {
    if (r !== null) details.push(r);
  }

  log.info({ fetched: details.length, skipped: summaries.length - details.length }, 'Detail fetching complete');
  return details;
}
