import axios from 'axios';

export interface PropertyPayload {
  portalId: string;
  data: any;
  rawData: any;
}

export class IngestAdapter {
  private baseUrl: string;
  private apiKey: string;
  private portal: string;

  constructor(portal: string) {
    this.portal = portal;
    this.baseUrl = process.env.INGEST_API_URL || 'http://localhost:3000';
    this.apiKey = process.env.INGEST_API_KEY || 'dev_key_fr_1';
  }

  async sendProperties(properties: PropertyPayload[]): Promise<void> {
    if (properties.length === 0) return;

    const payload = {
      portal: this.portal,
      country: process.env.INSTANCE_COUNTRY || 'fr',
      properties: properties.map(p => ({
        portal_id: p.portalId,
        data: p.data,
        raw_data: p.rawData,
      })),
    };

    const response = await axios.post(
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

    return response.data;
  }
}
