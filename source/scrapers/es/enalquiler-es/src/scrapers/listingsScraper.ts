import { fetchSearchPage } from '../utils/fetchData';
import { EnalquilerListingRaw, EnalquilerSearchConfig } from '../types/enalquilerTypes';

const MAX_PAGES_PER_CONFIG = 300;

export class ListingsScraper {
  private configs: EnalquilerSearchConfig[];

  constructor(configs: EnalquilerSearchConfig[]) {
    this.configs = configs;
  }

  async scrapeAll(): Promise<EnalquilerListingRaw[]> {
    console.log(JSON.stringify({
      level: 'info', service: 'enalquiler-scraper',
      msg: 'Starting listing scrape', combinations: this.configs.length,
    }));

    const allListings: EnalquilerListingRaw[] = [];
    const seenIds = new Set<string>();

    for (const config of this.configs) {
      const label = `${config.propertyType}/${config.province}`;
      try {
        const listings = await this.scrapeConfig(config, seenIds);
        allListings.push(...listings);
        console.log(JSON.stringify({
          level: 'info', service: 'enalquiler-scraper',
          msg: 'Config scraped', config: label, count: listings.length,
        }));
      } catch (error: any) {
        console.error(JSON.stringify({
          level: 'error', service: 'enalquiler-scraper',
          msg: 'Config failed', config: label, err: error.message,
        }));
      }
    }

    console.log(JSON.stringify({
      level: 'info', service: 'enalquiler-scraper',
      msg: 'Listing scrape complete', total: allListings.length,
    }));
    return allListings;
  }

  private async scrapeConfig(
    config: EnalquilerSearchConfig,
    seenIds: Set<string>
  ): Promise<EnalquilerListingRaw[]> {
    const listings: EnalquilerListingRaw[] = [];

    // Fetch first page to get total info
    const firstPage = await fetchSearchPage(config, 1);
    if (firstPage.totalListings === 0 && firstPage.listings.length === 0) return [];

    const totalPages = Math.min(firstPage.totalPages || 1, MAX_PAGES_PER_CONFIG);

    for (const listing of firstPage.listings) {
      if (!seenIds.has(listing.id)) {
        seenIds.add(listing.id);
        listings.push(listing);
      }
    }

    // Fetch remaining pages sequentially with rate limiting
    for (let page = 2; page <= totalPages; page++) {
      try {
        const result = await fetchSearchPage(config, page);
        if (result.listings.length === 0) break;

        let newOnPage = 0;
        for (const listing of result.listings) {
          if (!seenIds.has(listing.id)) {
            seenIds.add(listing.id);
            listings.push(listing);
            newOnPage++;
          }
        }

        // If all listings on this page were already seen, we've hit overlap — stop
        if (newOnPage === 0) break;

        if (page % 20 === 0) {
          const label = `${config.propertyType}/${config.province}`;
          console.log(JSON.stringify({
            level: 'info', service: 'enalquiler-scraper',
            msg: 'Page progress', config: label, page, totalPages, listings: listings.length,
          }));
        }
      } catch (error: any) {
        const label = `${config.propertyType}/${config.province}`;
        console.error(JSON.stringify({
          level: 'error', service: 'enalquiler-scraper',
          msg: 'Page fetch failed', config: label, page, err: error.message,
        }));
        // Brief pause on error before continuing
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    return listings;
  }
}
