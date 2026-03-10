/**
 * Core Service API Client
 * HTTP client for sending data to the Core Service
 */

import axios, { AxiosInstance } from 'axios';
import { IngestionPayload, IngestionResponse } from '../types';

export class CoreServiceClient {
  private client: AxiosInstance;
  private apiKey: string;

  constructor(baseUrl?: string, apiKey?: string) {
    this.apiKey = apiKey || process.env.CORE_SERVICE_API_KEY || '';

    this.client = axios.create({
      baseURL: baseUrl || process.env.CORE_SERVICE_URL || 'http://localhost:3000',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      }
    });
  }

  /**
   * Send a single property to Core Service
   */
  async ingestProperty(payload: IngestionPayload): Promise<IngestionResponse> {
    try {
      const response = await this.client.post<IngestionResponse>(
        '/api/v1/properties/ingest',
        payload
      );
      return response.data;
    } catch (error: any) {
      if (error.response) {
        throw new Error(`Core Service error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      }
      throw new Error(`Core Service request failed: ${error.message}`);
    }
  }

  /**
   * Send multiple properties in bulk
   */
  async bulkIngest(portal: string, country: string, properties: any[]): Promise<any> {
    try {
      const response = await this.client.post(
        '/api/v1/properties/bulk-ingest',
        {
          portal,
          country,
          properties
        },
        { timeout: 60000 }
      );
      return response.data;
    } catch (error: any) {
      if (error.response) {
        throw new Error(`Core Service bulk error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      }
      throw new Error(`Core Service bulk request failed: ${error.message}`);
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<any> {
    const response = await this.client.get('/api/v1/health');
    return response.data;
  }
}

/**
 * Helper function for quick usage
 */
export async function sendToCoreService(payload: IngestionPayload): Promise<IngestionResponse> {
  const client = new CoreServiceClient();
  return client.ingestProperty(payload);
}

/**
 * Helper function for bulk ingestion
 */
export async function sendBulkToCoreService(
  portal: string,
  country: string,
  properties: any[]
): Promise<any> {
  const client = new CoreServiceClient();
  return client.bulkIngest(portal, country, properties);
}
