import { fetchAllListingPages } from '../utils/fetchData';

export interface CategoryConfig {
  objectCategory: string;
  offerType: string;
}

export class ListingsScraper {
  private configs: CategoryConfig[];

  constructor(configs: CategoryConfig[] = [
    { objectCategory: 'APARTMENT', offerType: 'RENT' },
    { objectCategory: 'APARTMENT', offerType: 'SALE' },
    { objectCategory: 'HOUSE', offerType: 'RENT' },
    { objectCategory: 'HOUSE', offerType: 'SALE' },
    { objectCategory: 'COMMERCIAL', offerType: 'RENT' },
    { objectCategory: 'COMMERCIAL', offerType: 'SALE' },
  ]) {
    this.configs = configs;
  }

  async scrapeAll(): Promise<any[]> {
    const allListings: any[] = [];

    for (const config of this.configs) {
      const listings = await fetchAllListingPages(config.objectCategory, config.offerType);
      allListings.push(...listings);
    }

    return allListings;
  }
}
