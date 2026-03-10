import axios from 'axios';
import { StandardProperty, IngestionPayload } from '@landomo/core';

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
    this.baseUrl = process.env.INGEST_API_URL || 'http://cz-ingest:3000';
    this.apiKey = process.env[`INGEST_API_KEY_${portal.toUpperCase().replace(/-/g, '_')}`] || process.env.INGEST_API_KEY || 'dev_key_cz_1';
  }

  /**
   * Send properties to ingest API
   * Ingest service handles deduplication and change detection
   */
  async sendProperties(properties: PropertyPayload[], scrapeRunId?: string): Promise<void> {
    if (properties.length === 0) {
      return;
    }

    try {
      const payload: any = {
        portal: this.portal,
        country: 'cz',
        properties: properties.map(p => ({
          portal_id: p.portalId,
          data: p.data,
          raw_data: p.rawData
        }))
      };
      if (scrapeRunId) payload.scrape_run_id = scrapeRunId;

      const response = await axios.post(
        `${this.baseUrl}/api/v1/properties/bulk-ingest`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000 // 30 second timeout
        }
      );

      console.log(JSON.stringify({ level: 'info', service: 'reality-scraper', msg: 'Batch sent to ingest', count: properties.length }));

      return response.data;
    } catch (error: any) {
      console.error(JSON.stringify({ level: 'error', service: 'reality-scraper', msg: 'Failed to send batch', count: properties.length, err: error.message, status: error.response?.status }));

      throw error;
    }
  }

  /**
   * Send a single property to ingest API
   */
  async sendProperty(property: PropertyPayload, scrapeRunId?: string): Promise<void> {
    return this.sendProperties([property], scrapeRunId);
  }
}
