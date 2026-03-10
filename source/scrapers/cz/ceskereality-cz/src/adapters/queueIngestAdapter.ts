import axios from 'axios';
import type { ApartmentPropertyTierI, HousePropertyTierI, LandPropertyTierI, CommercialPropertyTierI } from '@landomo/core';

type PropertyTierI = ApartmentPropertyTierI | HousePropertyTierI | LandPropertyTierI | CommercialPropertyTierI;

export interface PropertyPayload {
  portalId: string;
  data: PropertyTierI;
  rawData: any;
}

/**
 * IngestAdapter for queue workers
 * Sends already-transformed properties to ingest API
 */
export class IngestAdapter {
  private baseUrl: string;
  private apiKey: string;
  private portal: string;

  constructor(portal: string) {
    this.portal = portal;
    this.baseUrl = process.env.INGEST_API_URL || 'http://localhost:3001';
    this.apiKey = process.env.INGEST_API_KEY_CESKEREALITY || process.env.INGEST_API_KEY || 'dev_key_cz_1';
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
        country: 'czech',
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
          timeout: 120000 // 2 minute timeout
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
