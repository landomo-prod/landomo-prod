import { fetchAllListingPages } from '../utils/fetchData';

export interface CategoryConfig {
  propertyType: string;
  offerType: 'buy' | 'rent';
}

export class ListingsScraper {
  private configs: CategoryConfig[];

  constructor(configs: CategoryConfig[] = [
    { propertyType: 'apartment', offerType: 'buy' },
    { propertyType: 'apartment', offerType: 'rent' },
    { propertyType: 'house', offerType: 'buy' },
    { propertyType: 'house', offerType: 'rent' },
    { propertyType: 'land', offerType: 'buy' },
    { propertyType: 'commercial', offerType: 'buy' },
    { propertyType: 'commercial', offerType: 'rent' },
  ]) {
    this.configs = configs;
  }

  async scrapeAll(): Promise<any[]> {
    const allListings: any[] = [];

    for (const config of this.configs) {
      const listings = await fetchAllListingPages(config.offerType, config.propertyType);
      allListings.push(...listings);
    }

    return allListings;
  }
}
