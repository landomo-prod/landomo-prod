import axios from 'axios';
import { ApartmentPropertyTierI, HousePropertyTierI, LandPropertyTierI, CommercialPropertyTierI, ListingChecksum } from '@landomo/core';

export interface PropertyPayload {
  portalId: string;
  data: ApartmentPropertyTierI | HousePropertyTierI | LandPropertyTierI | CommercialPropertyTierI;
  rawData: any;
}

export class IngestAdapter {
  private baseUrl: string;
  private apiKey: string;
  private portal: string;

  constructor(portal: string) {
    this.portal = portal;
    this.baseUrl = process.env.INGEST_API_URL || 'http://localhost:3008';
    this.apiKey = (process.env[`INGEST_API_KEY_${portal.toUpperCase().replace(/-/g, '_')}`] || process.env.INGEST_API_KEY || 'dev_key_sk_1').split(',')[0].trim();
  }

  async sendProperties(properties: PropertyPayload[], scrapeRunId?: string): Promise<void> {
    if (properties.length === 0) {
      return;
    }

    try {
      const payload: any = {
        portal: this.portal,
        country: 'sk',
        properties: properties.map(p => ({
          portal_id: p.portalId,
          data: p.data,
          raw_data: p.rawData
        }))
      };

      if (scrapeRunId) {
        payload.scrape_run_id = scrapeRunId;
      }

      const response = await axios.post(
        `${this.baseUrl}/api/v1/properties/bulk-ingest`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 120000 // 2 minute timeout for large batches
        }
      );

      console.log(JSON.stringify({ level: 'info', service: 'topreality-sk-scraper', msg: 'Batch sent to ingest', count: properties.length }));
      return response.data;
    } catch (error: any) {
      console.error(JSON.stringify({ level: 'error', service: 'topreality-sk-scraper', msg: 'Failed to send batch', count: properties.length, err: error.message, status: error.response?.status }));
      throw error;
    }
  }

  async sendProperty(property: PropertyPayload): Promise<void> {
    return this.sendProperties([property]);
  }

  /**
   * Send checksums to ingest API (checksum mode)
   */
  async sendChecksums(checksums: ListingChecksum[]): Promise<void> {
    if (checksums.length === 0) {
      return;
    }

    try {
      const payload = {
        portal: this.portal,
        country: 'sk',
        checksums: checksums
      };

      const response = await axios.post(
        `${this.baseUrl}/api/v1/properties/bulk-ingest`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 120000
        }
      );

      console.log(JSON.stringify({ level: 'info', service: 'topreality-sk-scraper', msg: 'Checksums sent to ingest', count: checksums.length }));
      return response.data;
    } catch (error: any) {
      console.error(JSON.stringify({ level: 'error', service: 'topreality-sk-scraper', msg: 'Failed to send checksums', count: checksums.length, err: error.message, status: error.response?.status }));
      throw error;
    }
  }
}
