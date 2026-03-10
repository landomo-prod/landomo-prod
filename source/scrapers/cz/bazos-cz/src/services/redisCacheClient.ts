/**
 * Redis Cache Client
 *
 * Fast L1 cache for LLM extractions using Redis
 * - 7-day TTL (configurable)
 * - Graceful degradation on failures (never blocks extraction)
 * - JSON serialization
 * - Automatic retry strategy (max 3 attempts)
 */

import Redis from 'ioredis';
import { LLMExtractedProperty } from '../types/llmExtraction';

export interface RedisCacheConfig {
  host: string;
  port: number;
  ttlSeconds: number;
  password?: string;
}

export class RedisCacheClient {
  private client: Redis;
  private ttlSeconds: number;
  private connected: boolean = false;

  constructor(config: RedisCacheConfig) {
    this.ttlSeconds = config.ttlSeconds;

    this.client = new Redis({
      host: config.host,
      port: config.port,
      password: config.password,
      lazyConnect: true,
      retryStrategy: (times: number) => {
        if (times > 3) {
          console.error('[Redis] Max retry attempts reached (3), giving up');
          return null; // Stop retrying
        }

        const delay = Math.min(times * 100, 2000);
        console.warn(`[Redis] Retrying connection (attempt ${times}/3) in ${delay}ms...`);
        return delay;
      },
      maxRetriesPerRequest: 1, // Fail fast on operations
      enableReadyCheck: true,
      enableOfflineQueue: false, // Don't queue operations when disconnected
    });

    // Connection event handlers
    this.client.on('connect', () => {
      console.log('[Redis] Connecting...');
    });

    this.client.on('ready', () => {
      this.connected = true;
      console.log('[Redis] Connected successfully');
    });

    this.client.on('error', (error: Error) => {
      console.error('[Redis] Connection error:', error.message);
      this.connected = false;
    });

    this.client.on('close', () => {
      this.connected = false;
      console.warn('[Redis] Connection closed');
    });

    // Connect on initialization
    this.connect();
  }

  /**
   * Establish connection to Redis
   */
  private async connect(): Promise<void> {
    try {
      await this.client.connect();
    } catch (error: any) {
      console.error('[Redis] Failed to connect:', error.message);
      // Don't throw - graceful degradation
    }
  }

  /**
   * Get cached extraction
   *
   * @param key - Cache key (e.g., "llm:bazos:123:abc456")
   * @returns Cached extraction or null if miss/error
   */
  public async get(key: string): Promise<LLMExtractedProperty | null> {
    if (!this.connected) {
      console.warn('[Redis] Not connected - skipping cache read');
      return null;
    }

    try {
      const result = await this.client.get(key);

      if (!result) {
        return null; // Cache miss
      }

      // Parse JSON
      const parsed = JSON.parse(result);
      return parsed as LLMExtractedProperty;

    } catch (error: any) {
      console.error('[Redis] Get error:', error.message);
      return null; // Graceful degradation - treat as cache miss
    }
  }

  /**
   * Store extraction in cache
   *
   * @param key - Cache key
   * @param value - Extraction data to cache
   */
  public async set(key: string, value: LLMExtractedProperty): Promise<void> {
    if (!this.connected) {
      console.warn('[Redis] Not connected - skipping cache write');
      return; // Graceful degradation
    }

    try {
      const serialized = JSON.stringify(value);

      // SETEX = SET with EXpiration
      await this.client.setex(key, this.ttlSeconds, serialized);

    } catch (error: any) {
      console.error('[Redis] Set error:', error.message);
      // Don't throw - caching is optional, extraction should continue
    }
  }

  /**
   * Check if key exists in cache
   *
   * @param key - Cache key
   * @returns true if exists, false otherwise
   */
  public async has(key: string): Promise<boolean> {
    if (!this.connected) {
      return false;
    }

    try {
      const exists = await this.client.exists(key);
      return exists === 1;

    } catch (error: any) {
      console.error('[Redis] Has error:', error.message);
      return false;
    }
  }

  /**
   * Delete key from cache
   *
   * @param key - Cache key
   */
  public async delete(key: string): Promise<void> {
    if (!this.connected) {
      return;
    }

    try {
      await this.client.del(key);
    } catch (error: any) {
      console.error('[Redis] Delete error:', error.message);
    }
  }

  /**
   * Get cache statistics
   *
   * @returns Redis info stats or null if unavailable
   */
  public async getStats(): Promise<Record<string, string> | null> {
    if (!this.connected) {
      return null;
    }

    try {
      const info = await this.client.info('stats');

      // Parse INFO output into key-value pairs
      const stats: Record<string, string> = {};
      const lines = info.split('\r\n');

      for (const line of lines) {
        if (line.includes(':')) {
          const [key, value] = line.split(':');
          stats[key] = value;
        }
      }

      return stats;

    } catch (error: any) {
      console.error('[Redis] Stats error:', error.message);
      return null;
    }
  }

  /**
   * Clear all cache entries (use with caution!)
   */
  public async clear(): Promise<void> {
    if (!this.connected) {
      console.warn('[Redis] Not connected - cannot clear cache');
      return;
    }

    try {
      await this.client.flushdb();
      console.log('[Redis] Cache cleared');
    } catch (error: any) {
      console.error('[Redis] Clear error:', error.message);
    }
  }

  /**
   * Check connection status
   */
  public isConnected(): boolean {
    return this.connected;
  }

  /**
   * Close connection gracefully
   */
  public async disconnect(): Promise<void> {
    try {
      await this.client.quit();
      this.connected = false;
      console.log('[Redis] Disconnected');
    } catch (error: any) {
      console.error('[Redis] Disconnect error:', error.message);
    }
  }
}

/**
 * Create Redis cache client from environment variables
 */
export function createRedisCacheClient(): RedisCacheClient {
  const config: RedisCacheConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    ttlSeconds: parseInt(process.env.EXTRACTION_CACHE_REDIS_TTL_SECONDS || '604800', 10), // 7 days default
    password: process.env.REDIS_PASSWORD || undefined,
  };

  console.log('[Redis] Initializing cache client...');
  console.log(`  Host: ${config.host}:${config.port}`);
  console.log(`  TTL: ${config.ttlSeconds / 86400} days`);

  return new RedisCacheClient(config);
}
