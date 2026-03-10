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
    this.baseUrl = process.env.INGEST_API_URL || 'http://localhost:3010';
    this.apiKey = process.env[`INGEST_API_KEY_${portal.toUpperCase().replace(/-/g, '_')}`] || process.env.INGEST_API_KEY || 'dev_key_de_1';
  }

  /**
   * Send properties to ingest API
   * Ingest service handles deduplication and change detection
   */
  async sendProperties(properties: PropertyPayload[]): Promise<void> {
    if (properties.length === 0) {
      return;
    }

    try {
      const payload = {
        portal: this.portal,
        country: 'germany',
        properties: properties.map(p => ({
          portal_id: p.portalId,
          data: p.data,
          raw_data: p.rawData
        }))
      };

      const response = await axios.post(
        `${this.baseUrl}/api/v1/properties/bulk-ingest`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 120000 // 2 minute timeout (batches can take 30-60s for first-time ingestion)
        }
      );

      console.log(JSON.stringify({ level: 'info', service: 'immowelt-de-scraper', msg: 'Batch sent to ingest', count: properties.length }));

      return response.data;
    } catch (error: any) {
      console.error(JSON.stringify({ level: 'error', service: 'immowelt-de-scraper', msg: 'Failed to send batch', count: properties.length, err: error.message, status: error.response?.status }));

      throw error;
    }
  }

  /**
   * Send a single property to ingest API
   */
  async sendProperty(property: PropertyPayload): Promise<void> {
    return this.sendProperties([property]);
  }
}
