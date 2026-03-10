/**
 * Fotocasa listings scraper
 * Phase 1: Fetch all listings from search API
 */

import { FotocasaListing, FOTOCASA_PROPERTY_TYPES, FOTOCASA_TRANSACTION_TYPES } from '../types/fotocasaTypes';
import { fetchAllListings } from '../utils/fetchData';

export interface ScrapeConfig {
  propertyTypes: number[];
  transactionTypes: number[];
  maxPagesPerType: number;
}

const DEFAULT_CONFIG: ScrapeConfig = {
  propertyTypes: [
    FOTOCASA_PROPERTY_TYPES.VIVIENDA,   // Apartments + Houses
    FOTOCASA_PROPERTY_TYPES.TERRENO,    // Land
    FOTOCASA_PROPERTY_TYPES.OFICINA,    // Offices
    FOTOCASA_PROPERTY_TYPES.LOCAL,      // Retail
    FOTOCASA_PROPERTY_TYPES.NAVE,       // Warehouses
  ],
  transactionTypes: [
    FOTOCASA_TRANSACTION_TYPES.SALE,
    FOTOCASA_TRANSACTION_TYPES.RENT,
  ],
  maxPagesPerType: 500,
};

/**
 * Fetch all listings across all configured property types and transaction types
 */
export async function fetchAllListingPages(config?: Partial<ScrapeConfig>): Promise<FotocasaListing[]> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const allListings: FotocasaListing[] = [];
  const seenIds = new Set<number>();

  for (const propertyTypeId of cfg.propertyTypes) {
    for (const transactionTypeId of cfg.transactionTypes) {
      const typeLabel = transactionTypeId === FOTOCASA_TRANSACTION_TYPES.SALE ? 'sale' : 'rent';

      console.log(JSON.stringify({
        level: 'info',
        service: 'fotocasa-scraper',
        msg: 'Fetching category',
        propertyTypeId,
        transactionType: typeLabel,
      }));

      try {
        const listings = await fetchAllListings(propertyTypeId, transactionTypeId, cfg.maxPagesPerType);

        // Deduplicate
        let newCount = 0;
        for (const listing of listings) {
          if (!seenIds.has(listing.id)) {
            seenIds.add(listing.id);
            allListings.push(listing);
            newCount++;
          }
        }

        console.log(JSON.stringify({
          level: 'info',
          service: 'fotocasa-scraper',
          msg: 'Category fetched',
          propertyTypeId,
          transactionType: typeLabel,
          total: listings.length,
          new: newCount,
          duplicates: listings.length - newCount,
        }));
      } catch (error: any) {
        console.error(JSON.stringify({
          level: 'error',
          service: 'fotocasa-scraper',
          msg: 'Failed to fetch category',
          propertyTypeId,
          transactionType: typeLabel,
          err: error.message,
        }));
      }
    }
  }

  console.log(JSON.stringify({
    level: 'info',
    service: 'fotocasa-scraper',
    msg: 'All categories fetched',
    totalListings: allListings.length,
  }));

  return allListings;
}
