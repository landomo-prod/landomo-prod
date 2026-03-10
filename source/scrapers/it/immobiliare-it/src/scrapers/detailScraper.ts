import axios, { AxiosInstance } from 'axios';

const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
];

export interface ImmobiliareDetail {
  description?: string;
  features?: string[];
  rooms?: number;
  bathrooms?: number;
  surface?: number;
  floor?: number;
  totalFloors?: number;
  condition?: string;
  heating?: string;
  energyClass?: string;
  yearBuilt?: number;
  parking?: string;
  elevator?: boolean;
  furnished?: string;
  balcony?: boolean;
  terrace?: boolean;
  garden?: boolean;
  basement?: boolean;
}

/**
 * Optional detail scraper for immobiliare.it
 * Fetches additional data from /annunci/{id}/ pages via __NEXT_DATA__
 * Only used when listing data is incomplete
 */
export class DetailScraper {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      timeout: 30000,
      headers: {
        'Accept': 'text/html',
        'Accept-Language': 'it-IT,it;q=0.9',
      },
    });
  }

  async fetchDetail(id: string | number): Promise<ImmobiliareDetail | null> {
    try {
      const url = `https://www.immobiliare.it/annunci/${id}/`;
      const response = await this.client.get(url, {
        headers: { 'User-Agent': USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)] },
      });

      const html = response.data as string;
      const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
      if (!nextDataMatch) return null;

      const nextData = JSON.parse(nextDataMatch[1]);
      const props = nextData?.props?.pageProps?.listingData?.properties?.[0];
      if (!props) return null;

      return {
        description: props.description,
        features: props.ga4features,
        rooms: props.rooms ? parseInt(props.rooms) : undefined,
        bathrooms: props.bathrooms ? parseInt(props.bathrooms) : undefined,
        surface: props.surface_value ? parseFloat(props.surface_value) : undefined,
        floor: props.floor?.value ? parseInt(props.floor.value) : undefined,
        totalFloors: props.floors ? parseInt(props.floors) : undefined,
        condition: props.condition,
        heating: props.ga4Heating,
        energyClass: props.energy?.class,
        parking: props.ga4Garage,
        elevator: props.hasElevators,
        furnished: props.furniture,
      };
    } catch (err: any) {
      console.error(JSON.stringify({
        level: 'error', service: 'immobiliare-scraper',
        msg: 'Detail fetch failed', id, err: err.message,
      }));
      return null;
    }
  }

  async fetchDetails(ids: (string | number)[]): Promise<Map<string, ImmobiliareDetail>> {
    const results = new Map<string, ImmobiliareDetail>();
    for (const id of ids) {
      const detail = await this.fetchDetail(id);
      if (detail) results.set(String(id), detail);
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    return results;
  }
}
