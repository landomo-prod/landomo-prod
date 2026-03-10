import axios from 'axios';
import pLimit from 'p-limit';
import { getRealisticHeaders, getRandomDelay } from './headers';
import { AtHomeListingRaw, AtHomeDetailRaw, AtHomeSearchResponse } from '../types/rawTypes';

const API_BASE = 'https://apigw.prd.athomegroup.lu/api-listings/listings';

// ATHome property type mapping - typeKey values from the API
// flat=apartment, house=house, land=land, office=commercial
export const PROPERTY_TYPES = [
  { type: 'apartment', params: { propertyType: 'flat' } },
  { type: 'house', params: { propertyType: 'house' } },
  { type: 'land', params: { propertyType: 'land' } },
  { type: 'commercial', params: { propertyType: 'office' } },
];

export const TRANSACTION_TYPES = ['for-sale', 'for-rent'];

export interface DiscoveredListing {
  id: number;
  category: string;
  transactionType: string;
  raw: AtHomeListingRaw;
}

/**
 * Fetch a single page of listings from ATHome API
 */
async function fetchPage(
  propertyType: string,
  transactionType: string,
  page: number,
  pageSize: number = 100
): Promise<AtHomeSearchResponse> {
  const headers = getRealisticHeaders();

  const response = await axios.get(API_BASE, {
    params: {
      transactionType,
      propertyType,
      page,
      pageSize,
    },
    headers,
    timeout: 30000,
  });

  return response.data;
}

/**
 * Fetch all pages for a given property type and transaction type
 */
export async function fetchAllListingPages(
  propertyType: string,
  transactionType: string
): Promise<DiscoveredListing[]> {
  const allListings: DiscoveredListing[] = [];
  const seenIds = new Set<number>();
  let page = 1;
  const pageSize = 100;

  while (true) {
    try {
      const response = await fetchPage(propertyType, transactionType, page, pageSize);
      const listings = response.data || [];

      if (listings.length === 0) break;

      let newCount = 0;
      for (const listing of listings) {
        if (listing.children && listing.children.length > 0) {
          // New build project: each child is a separate unit
          for (const child of listing.children) {
            if (seenIds.has(child.id)) continue;
            seenIds.add(child.id);
            newCount++;
            allListings.push({
              id: child.id,
              category: propertyType,
              transactionType,
              raw: {
                ...listing,
                id: child.id,
                prices: { min: child.price, max: child.price, currency: 'EUR' },
                bedrooms: child.bedrooms,
                surfaces: { min: child.surface, max: child.surface, unit: 'sqm' },
                floor: child.floor,
                bathrooms: child.bathrooms,
                children: undefined,
              },
            });
          }
        } else {
          if (seenIds.has(listing.id)) continue;
          seenIds.add(listing.id);
          newCount++;
          allListings.push({
            id: listing.id,
            category: propertyType,
            transactionType,
            raw: listing,
          });
        }
      }

      // If all listings on this page were already seen, stop
      if (newCount === 0) break;

      // If we got fewer than pageSize, we're on the last page
      if (listings.length < pageSize) break;

      page++;
      await new Promise(resolve => setTimeout(resolve, getRandomDelay(200, 500)));
    } catch (error: any) {
      console.error(JSON.stringify({
        level: 'error', service: 'athome-scraper',
        msg: 'Failed to fetch page', propertyType, transactionType, page,
        err: error.message,
      }));
      break;
    }
  }

  return allListings;
}

/**
 * Fetch detail for a single listing
 */
export async function fetchListingDetail(listingId: number): Promise<AtHomeDetailRaw | null> {
  try {
    const headers = getRealisticHeaders();
    const response = await axios.get(`${API_BASE}/${listingId}`, {
      headers,
      timeout: 15000,
    });
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 404 || error.response?.status === 410) {
      return null; // Listing removed
    }
    throw error;
  }
}
