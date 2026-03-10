/**
 * Ingest Adapter for LuxuryEstate.com Italy scraper
 *
 * Sends transformed property data to the Landomo ingest API
 * via the bulk-ingest endpoint.
 */

import axios from 'axios';

export interface PropertyPayload {
  portalId: string;
  data: unknown;
  rawData: unknown;
}

export class IngestAdapter {
  private baseUrl: string;
  private apiKey: string;
  private portal: string;

  constructor(portal: string) {
    this.portal = portal;
    this.baseUrl = process.env.INGEST_API_URL || 'http://localhost:3004';
    this.apiKey =
      process.env.INGEST_API_KEY_LUXURYESTATE_IT ||
      process.env.INGEST_API_KEY ||
      'dev_key_it_1';
  }

  async sendProperties(properties: PropertyPayload[]): Promise<void> {
    if (properties.length === 0) return;

    const payload = {
      portal: this.portal,
      country: 'it',
      properties: properties.map(p => ({
        portal_id: p.portalId,
        data: p.data,
        raw_data: p.rawData,
      })),
    };

    try {
      await axios.post(
        `${this.baseUrl}/api/v1/properties/bulk-ingest`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 60000,
        }
      );

      console.log(
        JSON.stringify({
          level: 'info',
          service: 'luxuryestate-scraper',
          msg: 'Batch sent to ingest',
          count: properties.length,
        })
      );
    } catch (error: any) {
      console.error(
        JSON.stringify({
          level: 'error',
          service: 'luxuryestate-scraper',
          msg: 'Failed to send batch to ingest',
          count: properties.length,
          err: error.message,
          status: error.response?.status,
        })
      );
      throw error;
    }
  }
}
