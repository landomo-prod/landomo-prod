/**
 * Shared HTTP Client for Scrapers
 *
 * Provides retry, timeout, and rate-limit awareness for scraper HTTP requests.
 * Uses axios under the hood. All options are configurable per-instance.
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

export interface HttpClientOptions {
  /** Base URL for requests */
  baseURL?: string;
  /** Request timeout in ms (default: 30000) */
  timeout?: number;
  /** Max retries on failure (default: 3) */
  maxRetries?: number;
  /** Initial backoff delay in ms (default: 1000) */
  retryDelay?: number;
  /** Backoff multiplier (default: 2) */
  retryMultiplier?: number;
  /** Default headers to include */
  headers?: Record<string, string>;
  /** Minimum delay between requests in ms (default: 0, no rate limit) */
  rateLimitMs?: number;
  /** User-Agent string */
  userAgent?: string;
}

export class HttpClient {
  private client: AxiosInstance;
  private maxRetries: number;
  private retryDelay: number;
  private retryMultiplier: number;
  private rateLimitMs: number;
  private lastRequestTime: number = 0;

  constructor(options: HttpClientOptions = {}) {
    this.maxRetries = options.maxRetries ?? 3;
    this.retryDelay = options.retryDelay ?? 1000;
    this.retryMultiplier = options.retryMultiplier ?? 2;
    this.rateLimitMs = options.rateLimitMs ?? 0;

    const headers: Record<string, string> = {
      'Accept': 'application/json',
      ...options.headers,
    };

    if (options.userAgent) {
      headers['User-Agent'] = options.userAgent;
    }

    this.client = axios.create({
      baseURL: options.baseURL,
      timeout: options.timeout ?? 30000,
      headers,
    });
  }

  /**
   * GET request with retry and rate-limit handling
   */
  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.requestWithRetry<T>('GET', url, undefined, config);
  }

  /**
   * POST request with retry and rate-limit handling
   */
  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.requestWithRetry<T>('POST', url, data, config);
  }

  /**
   * Execute request with automatic retry and rate-limit backoff
   */
  private async requestWithRetry<T>(
    method: string,
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    // Rate limit: wait if needed
    await this.applyRateLimit();

    let lastError: Error | null = null;
    let delay = this.retryDelay;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.client.request<T>({
          method,
          url,
          data,
          ...config,
        });

        this.lastRequestTime = Date.now();
        return response;
      } catch (error: any) {
        lastError = error;

        // Don't retry on 4xx (except 429 rate-limit)
        if (error.response && error.response.status >= 400 && error.response.status < 500 && error.response.status !== 429) {
          throw error;
        }

        // Handle 429 rate-limit: use Retry-After header if present
        if (error.response?.status === 429) {
          const retryAfter = error.response.headers['retry-after'];
          if (retryAfter) {
            delay = parseInt(retryAfter, 10) * 1000 || delay;
          }
        }

        if (attempt < this.maxRetries) {
          const jitter = Math.random() * delay * 0.1;
          await this.sleep(delay + jitter);
          delay *= this.retryMultiplier;
        }
      }
    }

    throw lastError || new Error(`Request failed after ${this.maxRetries + 1} attempts`);
  }

  /**
   * Enforce minimum delay between requests
   */
  private async applyRateLimit(): Promise<void> {
    if (this.rateLimitMs <= 0) return;

    const elapsed = Date.now() - this.lastRequestTime;
    if (elapsed < this.rateLimitMs) {
      await this.sleep(this.rateLimitMs - elapsed);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /** Get the underlying axios instance for advanced usage */
  getAxiosInstance(): AxiosInstance {
    return this.client;
  }
}
