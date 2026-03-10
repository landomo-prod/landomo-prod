import axios, { AxiosInstance } from 'axios';
import * as cheerio from 'cheerio';
import { IdealistaDetail } from '../types/idealistaTypes';
import { getRandomUserAgent } from '../utils/userAgents';

const DETAIL_DELAY_MS = parseInt(process.env.DETAIL_DELAY_MS || '500');

export class DetailScraper {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      timeout: 30000,
    });
  }

  async fetchDetail(url: string, retries = 3): Promise<IdealistaDetail | null> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await this.client.get(url, {
          headers: {
            'User-Agent': getRandomUserAgent(),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8',
            'Referer': 'https://www.idealista.it/',
          },
        });

        return this.parseDetail(response.data);
      } catch (error: any) {
        const status = error.response?.status;
        if (status === 403 || status === 429) {
          const backoff = Math.min(3000 * Math.pow(2, attempt), 60000);
          await new Promise(r => setTimeout(r, backoff));
          continue;
        }
        if (attempt === retries) {
          console.error(JSON.stringify({ level: 'error', service: 'idealista-scraper', msg: 'Detail fetch failed', url, err: error.message }));
          return null;
        }
        await new Promise(r => setTimeout(r, 2000 * attempt));
      }
    }
    return null;
  }

  private parseDetail(html: string): IdealistaDetail {
    const $ = cheerio.load(html);
    const detail: IdealistaDetail = { features: [], images: [] };

    // Try JSON-LD first
    $('script[type="application/ld+json"]').each((_i, el) => {
      try {
        const json = JSON.parse($(el).html() || '');
        if (json['@type'] === 'Residence' || json['@type'] === 'SingleFamilyResidence' || json['@type'] === 'Apartment') {
          if (json.description) detail.description = json.description;
          if (json.floorSize?.value) detail.builtArea = parseFloat(json.floorSize.value);
          if (json.numberOfRooms) detail.bathrooms = parseInt(json.numberOfRooms);
          if (json.yearBuilt) detail.yearBuilt = parseInt(json.yearBuilt);
        }
      } catch {}
    });

    // Description
    if (!detail.description) {
      detail.description = $('.comment .adCommentsBody, .details-property_description').text().trim() || undefined;
    }

    // Features from detail info sections
    $('.details-property-feature-one li, .details-property-feature-two li, .details-property_features li').each((_i, el) => {
      const text = $(el).text().trim().toLowerCase();
      detail.features.push(text);

      if (text.includes('classe energetica')) {
        const match = text.match(/classe energetica\s*:?\s*([a-g]\+?)/i);
        if (match) detail.energyClass = match[1].toUpperCase();
      }
      if (text.includes('anno di costruzione') || text.includes('anno costruzione')) {
        const match = text.match(/(\d{4})/);
        if (match) detail.yearBuilt = parseInt(match[1]);
      }
      if (text.includes('piano')) {
        const match = text.match(/piano\s*(\d+)/i);
        if (match) detail.floor = parseInt(match[1]);
      }
      if (text.includes('piani totali') || text.includes('piani edificio')) {
        const match = text.match(/(\d+)/);
        if (match) detail.totalFloors = parseInt(match[1]);
      }
      if (text.includes('bagn')) {
        const match = text.match(/(\d+)/);
        if (match) detail.bathrooms = parseInt(match[1]);
      }
      if (text.includes('riscaldamento')) {
        detail.heatingType = text.replace(/riscaldamento\s*:?\s*/i, '').trim();
      }
      if (text.includes('condizione') || text.includes('stato')) {
        detail.condition = text;
      }
      if (text.includes('arredato') || text.includes('ammobiliato')) {
        detail.furnished = text.includes('non') ? 'not_furnished' : 'furnished';
      }
      if (text.includes('parcheggio') || text.includes('garage') || text.includes('box auto')) {
        detail.parkingIncluded = true;
      }
      if (text.includes('superficie terreno') || text.includes('terreno')) {
        const match = text.match(/([\d.,]+)\s*m/);
        if (match) detail.plotSize = parseFloat(match[1].replace(',', '.'));
      }
    });

    // Images
    $('img.gallery-image, .multimedia-section img, .detail-multimedia img').each((_i, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src') || '';
      if (src && !src.includes('logo') && !src.includes('static')) {
        detail.images.push(src);
      }
    });

    // Agency info
    detail.agencyName = $('.professional-name, .advertiser-name').text().trim() || undefined;
    detail.agencyPhone = $('.phone-btn, .contact-phones').text().trim() || undefined;

    return detail;
  }

  async fetchDetails(
    urls: string[],
    onProgress?: (completed: number, total: number) => void
  ): Promise<Map<string, IdealistaDetail>> {
    const results = new Map<string, IdealistaDetail>();
    let completed = 0;

    for (const url of urls) {
      const detail = await this.fetchDetail(url);
      if (detail) {
        const id = url.match(/\/(\d+)\.htm/)?.[1] || url;
        results.set(id, detail);
      }
      completed++;
      if (onProgress) onProgress(completed, urls.length);
      await new Promise(r => setTimeout(r, DETAIL_DELAY_MS + Math.random() * 200));
    }

    return results;
  }
}
