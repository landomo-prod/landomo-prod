import axios, { AxiosInstance } from 'axios';
import * as cheerio from 'cheerio';
import pLimit from 'p-limit';
import { IdealistaListing, IdealistaSearchConfig, PropertyCategory } from '../types/idealistaTypes';
import { getRandomUserAgent } from '../utils/userAgents';

const CITIES = ['milano', 'roma', 'torino', 'napoli', 'firenze', 'bologna'];
const MAX_PAGES = 60;
const PAGE_DELAY_MS = parseInt(process.env.PAGE_DELAY_MS || '400');
const CITY_CONCURRENCY = parseInt(process.env.CITY_CONCURRENCY || '2');

function buildSearchConfigs(): IdealistaSearchConfig[] {
  const configs: IdealistaSearchConfig[] = [];
  for (const city of CITIES) {
    configs.push(
      { city, operation: 'sale', propertyType: 'apartments', urlPath: `/vendita-case/${city}/con-appartamenti/` },
      { city, operation: 'sale', propertyType: 'houses', urlPath: `/vendita-case/${city}/con-chalets/` },
      { city, operation: 'rent', propertyType: 'apartments', urlPath: `/affitto-case/${city}/` },
      { city, operation: 'sale', propertyType: 'land', urlPath: `/vendita-terreni/${city}/` },
      { city, operation: 'sale', propertyType: 'commercial', urlPath: `/vendita-locali-commerciali/${city}/` },
    );
  }
  return configs;
}

function mapPropertyType(configType: string): PropertyCategory {
  switch (configType) {
    case 'apartments': return 'apartment';
    case 'houses': return 'house';
    case 'land': return 'land';
    case 'commercial': return 'commercial';
    default: return 'apartment';
  }
}

export class ListingsScraper {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: 'https://www.idealista.it',
      timeout: 30000,
    });
  }

  private getHeaders(): Record<string, string> {
    return {
      'User-Agent': getRandomUserAgent(),
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Referer': 'https://www.idealista.it/',
      'DNT': '1',
      'Connection': 'keep-alive',
    };
  }

  private async fetchPage(url: string, retries = 3): Promise<string | null> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await this.client.get(url, { headers: this.getHeaders() });
        return response.data;
      } catch (error: any) {
        const status = error.response?.status;
        if (status === 403 || status === 429) {
          const backoff = Math.min(2000 * Math.pow(2, attempt), 30000);
          console.log(JSON.stringify({ level: 'warn', service: 'idealista-scraper', msg: `Got ${status}, retrying in ${backoff}ms`, url, attempt }));
          await new Promise(r => setTimeout(r, backoff));
          continue;
        }
        if (status === 404) return null;
        if (attempt === retries) {
          console.error(JSON.stringify({ level: 'error', service: 'idealista-scraper', msg: 'Page fetch failed', url, err: error.message }));
          return null;
        }
        await new Promise(r => setTimeout(r, 1000 * attempt));
      }
    }
    return null;
  }

  private parseListings(html: string, config: IdealistaSearchConfig): IdealistaListing[] {
    const $ = cheerio.load(html);
    const listings: IdealistaListing[] = [];

    $('article.item').each((_i, el) => {
      try {
        const $el = $(el);
        const linkEl = $el.find('a.item-link');
        const href = linkEl.attr('href') || '';
        const id = href.match(/\/(\d+)\.htm/)?.[1] || $el.attr('data-adid') || '';
        if (!id) return;

        const title = linkEl.text().trim() || $el.find('.item-info-container .item-link').text().trim();
        const priceText = $el.find('.item-price').text().replace(/[^\d]/g, '');
        const price = parseInt(priceText) || 0;

        const detailItems = $el.find('.item-detail span');
        let rooms = 0;
        let size = 0;
        let floor: string | undefined;
        let bathrooms: number | undefined;

        detailItems.each((_j, detail) => {
          const text = $(detail).text().trim().toLowerCase();
          if (text.includes('m²') || text.includes('mq')) {
            size = parseInt(text.replace(/[^\d]/g, '')) || 0;
          } else if (text.includes('local') || text.includes('stanz')) {
            rooms = parseInt(text.replace(/[^\d]/g, '')) || 0;
          } else if (text.includes('piano')) {
            floor = text;
          } else if (text.includes('bagn')) {
            bathrooms = parseInt(text.replace(/[^\d]/g, '')) || undefined;
          }
        });

        const address = $el.find('.item-detail-char .item-location').text().trim() ||
                        $el.find('.item-info-container .item-detail').first().text().trim();

        const thumbnails: string[] = [];
        $el.find('img').each((_j, img) => {
          const src = $(img).attr('src') || $(img).attr('data-src') || '';
          if (src && !src.includes('logo')) thumbnails.push(src);
        });

        const features: string[] = [];
        $el.find('.item-tags-container .item-tag').each((_j, tag) => {
          features.push($(tag).text().trim().toLowerCase());
        });

        const description = $el.find('.item-description, .ellipsis').text().trim() || undefined;

        listings.push({
          id,
          url: href.startsWith('http') ? href : `https://www.idealista.it${href}`,
          title,
          price,
          currency: 'EUR',
          size,
          rooms,
          bathrooms,
          floor,
          description,
          location: {
            city: config.city,
            address: address || undefined,
          },
          thumbnails,
          propertyType: mapPropertyType(config.propertyType),
          operation: config.operation,
          features,
          hasElevator: features.some(f => f.includes('ascensore') || f.includes('lift')),
          hasParking: features.some(f => f.includes('parcheggio') || f.includes('garage') || f.includes('box')),
          hasGarden: features.some(f => f.includes('giardino')),
          hasTerrace: features.some(f => f.includes('terrazza') || f.includes('terrazzo')),
          hasSwimmingPool: features.some(f => f.includes('piscina')),
        });
      } catch (err: any) {
        console.error(JSON.stringify({ level: 'error', service: 'idealista-scraper', msg: 'Failed to parse listing', err: err.message }));
      }
    });

    return listings;
  }

  private hasNextPage(html: string): boolean {
    const $ = cheerio.load(html);
    return $('a.icon-arrow-right-after, .pagination .next a').length > 0;
  }

  async scrapeSearch(
    config: IdealistaSearchConfig,
    onBatch?: (batch: IdealistaListing[]) => Promise<void>
  ): Promise<IdealistaListing[]> {
    const all: IdealistaListing[] = [];

    for (let page = 1; page <= MAX_PAGES; page++) {
      const url = page === 1 ? config.urlPath : `${config.urlPath}pagina-${page}.htm`;
      const html = await this.fetchPage(url);
      if (!html) break;

      const listings = this.parseListings(html, config);
      if (listings.length === 0) break;

      all.push(...listings);

      if (onBatch && listings.length > 0) {
        try {
          await onBatch(listings);
        } catch (err: any) {
          console.error(JSON.stringify({ level: 'error', service: 'idealista-scraper', msg: 'Batch callback failed', err: err.message }));
        }
      }

      console.log(JSON.stringify({ level: 'info', service: 'idealista-scraper', msg: 'Page scraped', city: config.city, operation: config.operation, type: config.propertyType, page, count: listings.length, total: all.length }));

      if (!this.hasNextPage(html)) break;
      await new Promise(r => setTimeout(r, PAGE_DELAY_MS + Math.random() * 200));
    }

    return all;
  }

  async scrapeAll(
    onBatch?: (batch: IdealistaListing[]) => Promise<void>
  ): Promise<IdealistaListing[]> {
    const configs = buildSearchConfigs();
    const limit = pLimit(CITY_CONCURRENCY);
    const allListings: IdealistaListing[] = [];

    console.log(JSON.stringify({ level: 'info', service: 'idealista-scraper', msg: 'Starting scrape', searches: configs.length, cities: CITIES.length }));

    const tasks = configs.map(config =>
      limit(async () => {
        try {
          const listings = await this.scrapeSearch(config, onBatch);
          allListings.push(...listings);
          return listings;
        } catch (err: any) {
          console.error(JSON.stringify({ level: 'error', service: 'idealista-scraper', msg: 'Search failed', city: config.city, operation: config.operation, err: err.message }));
          return [];
        }
      })
    );

    await Promise.all(tasks);

    console.log(JSON.stringify({ level: 'info', service: 'idealista-scraper', msg: 'Scrape complete', total: allListings.length }));
    return allListings;
  }
}
