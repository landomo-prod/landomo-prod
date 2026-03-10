import {
  fetchOffers,
  fetchOfferDetail,
  authenticate,
  fetchPaginatedData
} from '../utils/fetchData';
import {
  WGGesuchtOffer,
  WGGesuchtOfferDetail,
  CITY_IDS,
  CATEGORY_TYPES
} from '../types/wgGesuchtTypes';

export interface ScraperStats {
  totalProcessed: number;
  newOffers: number;
  cities: Record<string, number>;
}

export interface ScraperConfig {
  cities: number[]; // City IDs to scrape
  categories: string[]; // Category types to scrape
  maxRent?: number; // Maximum rent filter
  minSize?: number; // Minimum size filter
  fetchDetails?: boolean; // Whether to fetch detailed info for each offer
}

/**
 * Scrape WG-Gesucht listings from multiple cities and categories
 */
export class ListingsScraper {
  private config: ScraperConfig;
  private authenticated: boolean = false;

  constructor(config?: Partial<ScraperConfig>) {
    // Default configuration
    this.config = {
      cities: [
        CITY_IDS.BERLIN,
        CITY_IDS.MUNICH,
        CITY_IDS.HAMBURG,
        CITY_IDS.COLOGNE,
        CITY_IDS.FRANKFURT
      ],
      categories: [
        CATEGORY_TYPES.WG_ROOM,
        CATEGORY_TYPES.ONE_ROOM,
        CATEGORY_TYPES.TWO_ROOM
      ],
      fetchDetails: true,
      ...config
    };
  }

  /**
   * Authenticate with WG-Gesucht API
   * Required before scraping
   */
  async authenticate(username: string, password: string): Promise<void> {
    await authenticate(username, password);
    this.authenticated = true;
  }

  /**
   * Scrape all listings from configured cities and categories
   */
  async scrapeAll(): Promise<WGGesuchtOffer[]> {
    if (!this.authenticated) {
      throw new Error('Not authenticated. Please call authenticate() first.');
    }

    console.log(`Starting WG-Gesucht scrape for ${this.config.cities.length} cities...`);
    console.log(`Categories: ${this.config.categories.join(', ')}`);

    const allListings: WGGesuchtOffer[] = [];
    const stats: ScraperStats = {
      totalProcessed: 0,
      newOffers: 0,
      cities: {}
    };

    // Process all cities
    for (const cityId of this.config.cities) {
      try {
        const cityName = this.getCityName(cityId);
        console.log(`\n📍 Scraping ${cityName} (ID: ${cityId})...`);

        const listings = await this.scrapeCity(cityId);

        allListings.push(...listings);
        stats.totalProcessed += listings.length;
        stats.cities[cityName] = listings.length;

        console.log(`✅ ${cityName}: ${listings.length} listings`);
      } catch (error: any) {
        console.error(`❌ Error scraping city ${cityId}:`, error.message);
        // Continue with next city
      }
    }

    console.log(`\n✅ Scraping complete: ${stats.totalProcessed} total listings`);
    console.log(`   Cities processed: ${Object.keys(stats.cities).length}`);

    return allListings;
  }

  /**
   * Scrape a single city for all configured categories
   */
  private async scrapeCity(cityId: number): Promise<WGGesuchtOffer[]> {
    const listings: WGGesuchtOffer[] = [];

    const processPage = async (offers: any[], pageNumber: number) => {
      // Optionally enrich with detail data
      if (this.config.fetchDetails) {
        const enrichedOffers = await Promise.all(
          offers.map(async (offer) => {
            try {
              const detail = await fetchOfferDetail(offer.id);
              // Merge detail data with listing data
              return {
                ...offer,
                ...detail,
                // Preserve original fields
                description_long: detail.description || offer.description,
                images_full: detail.images || offer.images
              };
            } catch (error) {
              // If detail fetch fails, return original offer
              console.warn(`⚠️  Failed to fetch detail for offer ${offer.id}:`, (error as Error).message);
              return offer;
            }
          })
        );
        listings.push(...enrichedOffers);
      } else {
        listings.push(...offers);
      }

      // Log progress
      if (pageNumber % 5 === 0) {
        console.log(`   Page ${pageNumber}: ${listings.length} listings`);
      }
    };

    await fetchPaginatedData(cityId, this.config.categories, processPage);

    return listings;
  }

  /**
   * Get city name from city ID
   */
  private getCityName(cityId: number): string {
    const cityMap: Record<number, string> = {
      [CITY_IDS.BERLIN]: 'Berlin',
      [CITY_IDS.MUNICH]: 'Munich',
      [CITY_IDS.HAMBURG]: 'Hamburg',
      [CITY_IDS.COLOGNE]: 'Cologne',
      [CITY_IDS.FRANKFURT]: 'Frankfurt',
      [CITY_IDS.STUTTGART]: 'Stuttgart',
      [CITY_IDS.DUSSELDORF]: 'Düsseldorf',
      [CITY_IDS.DORTMUND]: 'Dortmund',
      [CITY_IDS.ESSEN]: 'Essen',
      [CITY_IDS.LEIPZIG]: 'Leipzig',
      [CITY_IDS.BREMEN]: 'Bremen',
      [CITY_IDS.DRESDEN]: 'Dresden',
      [CITY_IDS.HANOVER]: 'Hanover',
      [CITY_IDS.NUREMBERG]: 'Nuremberg',
      [CITY_IDS.DUISBURG]: 'Duisburg',
    };

    return cityMap[cityId] || `City ${cityId}`;
  }

  /**
   * Scrape specific city with custom parameters
   */
  async scrapeCustom(
    cityId: number,
    categories: string[],
    options?: {
      maxRent?: number;
      minSize?: number;
      fetchDetails?: boolean;
    }
  ): Promise<WGGesuchtOffer[]> {
    if (!this.authenticated) {
      throw new Error('Not authenticated. Please call authenticate() first.');
    }

    const listings: WGGesuchtOffer[] = [];

    const processPage = async (offers: any[]) => {
      if (options?.fetchDetails) {
        const enrichedOffers = await Promise.all(
          offers.map(async (offer) => {
            try {
              const detail = await fetchOfferDetail(offer.id);
              return { ...offer, ...detail };
            } catch (error) {
              return offer;
            }
          })
        );
        listings.push(...enrichedOffers);
      } else {
        listings.push(...offers);
      }
    };

    await fetchPaginatedData(cityId, categories, processPage);

    return listings;
  }
}
