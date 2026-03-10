/**
 * Ingest Adapter
 * Sends scraped properties to the central ingest API
 */

import axios, { AxiosInstance } from 'axios';
import { StandardProperty } from '@landomo/core';

export interface PropertyPayload {
  portalId: string;
  data: StandardProperty;
  rawData?: any;
}

export class IngestAdapter {
  private client: AxiosInstance;
  private ingestUrl: string;
  private portal: string;

  constructor(portal: string, ingestUrl?: string) {
    this.portal = portal;
    this.ingestUrl = ingestUrl || process.env.INGEST_API_URL || 'http://localhost:3000';

    this.client = axios.create({
      timeout: 120000,  // 2 minutes - wait for ingest service to process
      baseURL: this.ingestUrl,
    });
  }

  /**
   * Send a batch of properties to the ingest API
   */
  async sendProperties(properties: PropertyPayload[]): Promise<void> {
    if (properties.length === 0) {
      console.log('No properties to send');
      return;
    }

    try {
      // Use standard bulk-ingest endpoint with country field
      const payload = {
        portal: this.portal,
        country: 'cz', // Czech Republic ISO 2-letter code
        properties: properties.map(p => ({
          portal_id: p.portalId,
          data: p.data,
          raw_data: p.rawData
        }))
      };

      const apiKey = process.env.INGEST_API_KEY || 'dev_key_cz_1';

      const response = await this.client.post('/api/v1/properties/bulk-ingest', payload, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 200 || response.status === 202) {
        console.log(`✓ Sent ${properties.length} properties to ingest API`);
      } else {
        console.warn(`Unexpected status ${response.status} from ingest API`);
      }
    } catch (error: any) {
      console.error(`Error sending properties to ingest API:`, error.message);

      if (error.response) {
        console.error('Response error:', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data
        });
      }

      throw error;
    }
  }

  /**
   * Send a single property
   */
  async sendProperty(property: PropertyPayload): Promise<void> {
    await this.sendProperties([property]);
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/health');
      return response.status === 200;
    } catch {
      return false;
    }
  }
}
