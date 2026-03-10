import axios from 'axios';
import { StandardProperty } from '@landomo/core';

const log = (level: string, msg: string, extra: Record<string, any> = {}) =>
  console.log(JSON.stringify({ level, service: 'zenga-hu', msg, ...extra }));

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
    this.apiKey = process.env[`INGEST_API_KEY_${portal.toUpperCase().replace(/-/g, '_')}`] || process.env.INGEST_API_KEY || 'dev_key_hu_1';
  }

  async sendProperties(properties: PropertyPayload[]): Promise<void> {
    if (properties.length === 0) {
      return;
    }

    try {
      const payload = {
        portal: this.portal,
        country: 'hu',
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
          timeout: 120000
        }
      );

      log('info', 'Batch sent to ingest', { count: properties.length });

      return response.data;
    } catch (error: any) {
      log('error', 'Failed to send batch', { count: properties.length, err: error.message, status: error.response?.status });
      throw error;
    }
  }

  async sendProperty(property: PropertyPayload): Promise<void> {
    return this.sendProperties([property]);
  }
}
