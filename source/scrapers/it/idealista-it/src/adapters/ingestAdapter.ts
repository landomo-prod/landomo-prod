import axios from 'axios';
import { StandardProperty } from '@landomo/core';

export interface PropertyPayload {
  portalId: string;
  data: StandardProperty;
  rawData: any;
}

export class IngestAdapter {
  private baseUrl: string;
  private apiKey: string;
  private portal: string;

  constructor(portal: string) {
    this.portal = portal;
    this.baseUrl = process.env.INGEST_API_URL || 'http://localhost:3004';
    this.apiKey = process.env.INGEST_API_KEY_IDEALISTA_IT || process.env.INGEST_API_KEY || '';
  }

  async sendProperties(properties: PropertyPayload[]): Promise<void> {
    if (properties.length === 0) return;

    try {
      const payload = {
        portal: this.portal,
        country: 'it',
        properties: properties.map(p => ({
          portal_id: p.portalId,
          data: p.data,
          raw_data: p.rawData,
        })),
      };

      await axios.post(
        `${this.baseUrl}/api/v1/properties/bulk-ingest`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 60000,
        }
      );

      console.log(JSON.stringify({ level: 'info', service: 'idealista-scraper', msg: 'Batch sent to ingest', count: properties.length }));
    } catch (error: any) {
      console.error(JSON.stringify({ level: 'error', service: 'idealista-scraper', msg: 'Failed to send batch', count: properties.length, err: error.message, status: error.response?.status }));
      throw error;
    }
  }
}
