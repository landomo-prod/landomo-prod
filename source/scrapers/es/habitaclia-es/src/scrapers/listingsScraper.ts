import { fetchSearchPage } from '../utils/fetchData';
import { HabitacliaListingRaw, HabitacliaSearchConfig } from '../types/habitacliaTypes';
import { getConfigLabel } from '../utils/habitacliaHelpers';

const MAX_PAGES_PER_CONFIG = 200;

export class ListingsScraper {
  private configs: HabitacliaSearchConfig[];

  constructor(configs: HabitacliaSearchConfig[]) {
    this.configs = configs;
  }

  async scrapeAll(): Promise<HabitacliaListingRaw[]> {
    console.log(JSON.stringify({ level: 'info', service: 'habitaclia-scraper', msg: 'Starting listing scrape', combinations: this.configs.length }));

    const allListings: HabitacliaListingRaw[] = [];
    const seenIds = new Set<string>();

    for (const config of this.configs) {
      const label = getConfigLabel(config);
      try {
        const listings = await this.scrapeConfig(config, seenIds);
        allListings.push(...listings);
        console.log(JSON.stringify({ level: 'info', service: 'habitaclia-scraper', msg: 'Config scraped', config: label, count: listings.length }));
      } catch (error: any) {
        console.error(JSON.stringify({ level: 'error', service: 'habitaclia-scraper', msg: 'Config failed', config: label, err: error.message }));
      }
    }

    console.log(JSON.stringify({ level: 'info', service: 'habitaclia-scraper', msg: 'Listing scrape complete', total: allListings.length }));
    return allListings;
  }

  private async scrapeConfig(
    config: HabitacliaSearchConfig,
    seenIds: Set<string>
  ): Promise<HabitacliaListingRaw[]> {
    const listings: HabitacliaListingRaw[] = [];

    // Fetch first page to get total count
    const firstPage = await fetchSearchPage(config, 1);
    if (firstPage.totalListings === 0) return [];

    const totalPages = Math.min(firstPage.totalPages, MAX_PAGES_PER_CONFIG);

    for (const listing of firstPage.listings) {
      if (!seenIds.has(listing.id)) {
        seenIds.add(listing.id);
        listings.push(listing);
      }
    }

    // Fetch remaining pages sequentially
    for (let page = 2; page <= totalPages; page++) {
      try {
        const result = await fetchSearchPage(config, page);
        if (result.listings.length === 0) break;

        for (const listing of result.listings) {
          if (!seenIds.has(listing.id)) {
            seenIds.add(listing.id);
            listings.push(listing);
          }
        }

        if (page % 10 === 0) {
          console.log(JSON.stringify({ level: 'info', service: 'habitaclia-scraper', msg: 'Page progress', config: getConfigLabel(config), page, totalPages, listings: listings.length }));
        }
      } catch (error: any) {
        console.error(JSON.stringify({ level: 'error', service: 'habitaclia-scraper', msg: 'Page fetch failed', config: getConfigLabel(config), page, err: error.message }));
        if (error.message?.includes('429')) {
          // Rate limited, wait and retry
          await new Promise(resolve => setTimeout(resolve, 30000));
        }
      }
    }

    return listings;
  }
}
