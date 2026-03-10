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
    this.apiKey = process.env.INGEST_API_KEY || 'dev_key_ch_1';
  }

  async sendProperties(properties: PropertyPayload[]): Promise<void> {
    if (properties.length === 0) return;

    try {
      const payload = {
        portal: this.portal,
        country: 'ch',
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
          timeout: 120000,
        }
      );

      console.log(JSON.stringify({ level: 'info', service: 'homegate-ch', msg: 'Sent batch', count: properties.length }));
    } catch (error: any) {
      console.error(JSON.stringify({ level: 'error', service: 'homegate-ch', msg: 'Failed to send batch', err: error.message }));
      throw error;
    }
  }
}
