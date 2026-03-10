import { PisosListingRaw, SearchConfig } from '../types/pisosTypes';
import { fetchAllSearchPages } from '../utils/fetchData';
import { getAllSearchConfigs } from '../utils/categoryDetection';
import { SPANISH_PROVINCES } from '../utils/pisosHelpers';

export interface ScraperStats {
  totalProcessed: number;
  byCategory: Record<string, number>;
  byProvince: Record<string, number>;
}

/**
 * Scrape all pisos.com listings across provinces and categories
 */
export class ListingsScraper {
  private configs: SearchConfig[];
  private provinceFilter?: string[];

  constructor(provinceFilter?: string[]) {
    this.configs = getAllSearchConfigs();
    this.provinceFilter = provinceFilter;
  }

  async scrapeAll(
    onBatch?: (batch: PisosListingRaw[], config: SearchConfig, province: string) => Promise<void>
  ): Promise<PisosListingRaw[]> {
    const allListings: PisosListingRaw[] = [];
    const stats: ScraperStats = {
      totalProcessed: 0,
      byCategory: {},
      byProvince: {},
    };

    const provinces = this.provinceFilter
      ? SPANISH_PROVINCES.filter(p => this.provinceFilter!.includes(p.slug))
      : SPANISH_PROVINCES;

    console.log(JSON.stringify({
      level: 'info',
      service: 'pisos-com-scraper',
      msg: 'Starting pisos.com scrape',
      provinces: provinces.length,
      configs: this.configs.length,
      combinations: provinces.length * this.configs.length,
    }));

    for (const province of provinces) {
      for (const config of this.configs) {
        try {
          const listings = await fetchAllSearchPages(config, province.slug);

          if (listings.length > 0) {
            allListings.push(...listings);
            stats.totalProcessed += listings.length;
            stats.byCategory[config.label] = (stats.byCategory[config.label] || 0) + listings.length;
            stats.byProvince[province.slug] = (stats.byProvince[province.slug] || 0) + listings.length;

            if (onBatch) {
              await onBatch(listings, config, province.slug);
            }

            console.log(JSON.stringify({
              level: 'info',
              service: 'pisos-com-scraper',
              msg: 'Province+category scraped',
              province: province.slug,
              category: config.label,
              count: listings.length,
            }));
          }
        } catch (error: any) {
          console.error(JSON.stringify({
            level: 'error',
            service: 'pisos-com-scraper',
            msg: 'Failed to scrape province+category',
            province: province.slug,
            category: config.label,
            err: error.message,
          }));
        }
      }
    }

    console.log(JSON.stringify({
      level: 'info',
      service: 'pisos-com-scraper',
      msg: 'Listing scrape complete',
      totalProcessed: stats.totalProcessed,
      byCategory: stats.byCategory,
    }));

    return allListings;
  }
}
