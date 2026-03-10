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
        country: 'de',
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

      console.log(`✅ Sent ${properties.length} properties to ingest API`);

      return response.data;
    } catch (error: any) {
      console.error(`❌ Failed to send ${properties.length} properties:`, error.message);

      if (error.response) {
        console.error('Response error:', {
          status: error.response.status,
          data: error.response.data
        });
      }

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
