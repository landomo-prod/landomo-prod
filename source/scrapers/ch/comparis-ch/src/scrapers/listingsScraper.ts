import { fetchAllListingPages } from '../utils/fetchData';

export interface CategoryConfig {
  propertyType: string;
  dealType: 'buy' | 'rent';
}

export class ListingsScraper {
  private configs: CategoryConfig[];

  constructor(configs: CategoryConfig[] = [
    { propertyType: 'apartment', dealType: 'buy' },
    { propertyType: 'apartment', dealType: 'rent' },
    { propertyType: 'house', dealType: 'buy' },
    { propertyType: 'house', dealType: 'rent' },
    { propertyType: 'land', dealType: 'buy' },
    { propertyType: 'commercial', dealType: 'buy' },
    { propertyType: 'commercial', dealType: 'rent' },
  ]) {
    this.configs = configs;
  }

  async scrapeAll(): Promise<any[]> {
    const allListings: any[] = [];

    for (const config of this.configs) {
      console.log(JSON.stringify({ level: 'info', service: 'comparis-ch', msg: 'Scraping category', propertyType: config.propertyType, dealType: config.dealType }));

      const listings = await fetchAllListingPages(config.dealType, config.propertyType);
      allListings.push(...listings);

      console.log(JSON.stringify({ level: 'info', service: 'comparis-ch', msg: 'Category scraped', propertyType: config.propertyType, dealType: config.dealType, count: listings.length }));
    }

    return allListings;
  }
}
