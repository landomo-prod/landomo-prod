/**
 * LLM Extraction Cache Service (Hybrid Redis + PostgreSQL)
 *
 * Prevents re-extracting the same property multiple times by:
 * 1. Hashing listing text content
 * 2. Checking L1 cache (Redis, 7-day TTL, fast)
 * 3. Checking L2 cache (PostgreSQL, 90-day TTL, persistent)
 * 4. Storing results in both caches
 *
 * Cache Strategy:
 * - L1 (Redis): Fast, 7-day TTL, lost on restart
 * - L2 (PostgreSQL): Persistent, 90-day TTL, survives restarts
 * - Double-write: Redis (sync) + PostgreSQL (async)
 * - Warm-up: L2 hits warm up L1 automatically
 */

import crypto from 'crypto';
import { LLMExtractedProperty } from '../types/llmExtraction';
import { RedisCacheClient, createRedisCacheClient } from './redisCacheClient';
import { PostgresCacheClient, createPostgresCacheClient } from './postgresCache';

/**
 * Cache configuration
 */
interface CacheConfig {
  enabled: boolean;              // Enable/disable caching
  persistentCacheEnabled: boolean; // Enable Redis + PostgreSQL (vs in-memory fallback)
  redisEnabled: boolean;         // Enable Redis L1 cache
  postgresEnabled: boolean;      // Enable PostgreSQL L2 cache
  ttlSeconds: number;            // Fallback TTL for in-memory cache (30 days)
}

/**
 * In-memory cache fallback (when Redis unavailable)
 */
class InMemoryCache {
  private cache: Map<string, { data: LLMExtractedProperty; timestamp: number }> = new Map();
  private ttlMs: number;

  constructor(ttlSeconds: number) {
    this.ttlMs = ttlSeconds * 1000;
  }

  async get(key: string): Promise<LLMExtractedProperty | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  async set(key: string, value: LLMExtractedProperty): Promise<void> {
    this.cache.set(key, {
      data: value,
      timestamp: Date.now()
    });
  }

  async has(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) return false;

    // Check if expired
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  getSize(): number {
    return this.cache.size;
  }

  clear(): void {
    this.cache.clear();
  }
}

/**
 * Extraction Cache Manager (Hybrid Redis + PostgreSQL)
 *
 * Supports multiple cache backends:
 * - In-memory (fallback, lost on restart)
 * - Redis (L1, 7-day TTL, fast)
 * - PostgreSQL (L2, 90-day TTL, persistent)
 */
export class ExtractionCacheManager {
  private static instance: ExtractionCacheManager | null = null;

  // Cache backends
  private inMemoryCache: InMemoryCache;
  private redisCache?: RedisCacheClient;
  private pgCache?: PostgresCacheClient;

  private config: CacheConfig;
  private stats = {
    hits: 0,
    l1Hits: 0,  // Redis hits
    l2Hits: 0,  // PostgreSQL hits
    misses: 0,
    sets: 0,
    errors: 0
  };

  private constructor(config?: Partial<CacheConfig>) {
    this.config = {
      enabled: config?.enabled !== false,
      persistentCacheEnabled: process.env.PERSISTENT_CACHE_ENABLED === 'true',
      redisEnabled: process.env.REDIS_HOST ? true : false,
      postgresEnabled: process.env.DATABASE_URL || process.env.DB_HOST ? true : false,
      ttlSeconds: config?.ttlSeconds || 30 * 24 * 60 * 60, // 30 days fallback
    };

    // Always create in-memory cache as fallback
    this.inMemoryCache = new InMemoryCache(this.config.ttlSeconds);

    // Initialize persistent caches if enabled
    if (this.config.persistentCacheEnabled) {
      console.log('[ExtractionCache] Initializing hybrid cache (Redis + PostgreSQL)');

      // Initialize Redis L1 cache
      if (this.config.redisEnabled) {
        try {
          this.redisCache = createRedisCacheClient();
          console.log('[ExtractionCache] ✓ Redis L1 cache initialized');
        } catch (error: any) {
          console.error('[ExtractionCache] Failed to initialize Redis:', error.message);
          console.warn('[ExtractionCache] Continuing with in-memory + PostgreSQL cache');
        }
      }

      // Initialize PostgreSQL L2 cache
      if (this.config.postgresEnabled) {
        try {
          this.pgCache = createPostgresCacheClient();
          console.log('[ExtractionCache] ✓ PostgreSQL L2 cache initialized');
        } catch (error: any) {
          console.error('[ExtractionCache] Failed to initialize PostgreSQL:', error.message);
          console.warn('[ExtractionCache] Continuing with in-memory + Redis cache');
        }
      }
    } else {
      console.log('[ExtractionCache] Using in-memory cache only (persistent cache disabled)');
      console.log('  Enable with: PERSISTENT_CACHE_ENABLED=true');
    }

    console.log('[ExtractionCache] Initialized');
    console.log(`  Cache enabled: ${this.config.enabled}`);
    console.log(`  Persistent cache: ${this.config.persistentCacheEnabled}`);
    console.log(`  Redis L1: ${this.redisCache ? 'enabled' : 'disabled'}`);
    console.log(`  PostgreSQL L2: ${this.pgCache ? 'enabled' : 'disabled'}`);
  }

  /**
   * Get singleton instance
   */
  public static getInstance(config?: Partial<CacheConfig>): ExtractionCacheManager {
    if (!ExtractionCacheManager.instance) {
      ExtractionCacheManager.instance = new ExtractionCacheManager(config);
    }
    return ExtractionCacheManager.instance;
  }

  /**
   * Generate content hash from listing text
   */
  private hashContent(text: string): string {
    return crypto
      .createHash('md5')
      .update(text.trim().toLowerCase())
      .digest('hex');
  }

  /**
   * Generate cache key
   */
  private getCacheKey(portal: string, listingId: string, contentHash: string): string {
    return `llm:${portal}:${listingId}:${contentHash}`;
  }

  /**
   * Check if extraction exists in cache (Hybrid: Redis → PostgreSQL → In-Memory)
   *
   * @param portal - Portal name (e.g., "bazos")
   * @param listingId - Portal listing ID
   * @param listingText - Full listing text
   * @returns Cached extraction or null
   */
  public async get(
    portal: string,
    listingId: string,
    listingText: string
  ): Promise<LLMExtractedProperty | null> {
    if (!this.config.enabled) {
      return null;
    }

    try {
      const contentHash = this.hashContent(listingText);
      const cacheKey = this.getCacheKey(portal, listingId, contentHash);

      // L1: Try Redis (fast, 7-day TTL)
      if (this.redisCache) {
        const redisResult = await this.redisCache.get(cacheKey);
        if (redisResult) {
          this.stats.hits++;
          this.stats.l1Hits++;
          console.log(`[Cache] L1 HIT (Redis) for ${listingId} (hash: ${contentHash.substring(0, 8)})`);
          return redisResult;
        }
      }

      // L2: Try PostgreSQL (persistent, 90-day TTL)
      if (this.pgCache) {
        const pgResult = await this.pgCache.get(portal, listingId, contentHash);
        if (pgResult) {
          this.stats.hits++;
          this.stats.l2Hits++;
          console.log(`[Cache] L2 HIT (PostgreSQL) for ${listingId} (hash: ${contentHash.substring(0, 8)})`);

          // Warm up Redis asynchronously
          if (this.redisCache) {
            setImmediate(async () => {
              try {
                await this.redisCache!.set(cacheKey, pgResult);
                console.log(`[Cache] L1 warm-up for ${listingId}`);
              } catch (error: any) {
                console.error(`[Cache] L1 warm-up failed:`, error.message);
              }
            });
          }

          return pgResult;
        }
      }

      // Fallback: Try in-memory cache (for backward compatibility)
      const inMemoryResult = await this.inMemoryCache.get(cacheKey);
      if (inMemoryResult) {
        this.stats.hits++;
        console.log(`[Cache] In-memory HIT for ${listingId} (hash: ${contentHash.substring(0, 8)})`);
        return inMemoryResult;
      }

      // Cache miss
      this.stats.misses++;
      console.log(`[Cache] MISS for ${listingId} (hash: ${contentHash.substring(0, 8)})`);
      return null;

    } catch (error: any) {
      this.stats.errors++;
      console.error(`[Cache] Error getting cache for ${listingId}:`, error.message);
      return null; // Graceful degradation
    }
  }

  /**
   * Store extraction in cache (Double-write: Redis + PostgreSQL)
   *
   * @param portal - Portal name (e.g., "bazos")
   * @param listingId - Portal listing ID
   * @param listingText - Full listing text
   * @param extraction - LLM extracted data
   * @param metadata - Extraction metadata (duration, tokens)
   */
  public async set(
    portal: string,
    listingId: string,
    listingText: string,
    extraction: LLMExtractedProperty,
    metadata?: { durationMs: number; tokensUsed: number }
  ): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    try {
      const contentHash = this.hashContent(listingText);
      const cacheKey = this.getCacheKey(portal, listingId, contentHash);

      // Double-write strategy: Redis (sync) + PostgreSQL (async)

      // Write to Redis (L1) synchronously
      if (this.redisCache) {
        await this.redisCache.set(cacheKey, extraction);
      }

      // Write to PostgreSQL (L2) asynchronously
      if (this.pgCache && metadata) {
        setImmediate(async () => {
          try {
            await this.pgCache!.set(portal, listingId, contentHash, extraction, metadata);
          } catch (error: any) {
            console.error(`[Cache] PostgreSQL write failed:`, error.message);
          }
        });
      }

      // Write to in-memory cache as fallback
      await this.inMemoryCache.set(cacheKey, extraction);

      this.stats.sets++;
      console.log(`[Cache] SET for ${listingId} (hash: ${contentHash.substring(0, 8)})`);

    } catch (error: any) {
      this.stats.errors++;
      console.error(`[Cache] Error setting cache for ${listingId}:`, error.message);
      // Don't throw - caching is optional
    }
  }

  /**
   * Check if listing has cached extraction
   *
   * @param portal - Portal name (e.g., "bazos")
   * @param listingId - Portal listing ID
   * @param listingText - Full listing text
   */
  public async has(portal: string, listingId: string, listingText: string): Promise<boolean> {
    if (!this.config.enabled) {
      return false;
    }

    try {
      const contentHash = this.hashContent(listingText);
      const cacheKey = this.getCacheKey(portal, listingId, contentHash);

      // Check Redis first
      if (this.redisCache) {
        const exists = await this.redisCache.has(cacheKey);
        if (exists) return true;
      }

      // Check PostgreSQL
      if (this.pgCache) {
        return await this.pgCache.has(portal, listingId, contentHash);
      }

      // Fallback to in-memory
      return await this.inMemoryCache.has(cacheKey);

    } catch (error: any) {
      console.error(`[Cache] Error checking cache for ${listingId}:`, error.message);
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  public getStats() {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? (this.stats.hits / total * 100).toFixed(1) : '0.0';
    const l1Rate = this.stats.hits > 0 ? (this.stats.l1Hits / this.stats.hits * 100).toFixed(1) : '0.0';
    const l2Rate = this.stats.hits > 0 ? (this.stats.l2Hits / this.stats.hits * 100).toFixed(1) : '0.0';

    return {
      ...this.stats,
      total,
      hitRate: `${hitRate}%`,
      l1HitRate: `${l1Rate}%`,  // Percentage of hits from Redis
      l2HitRate: `${l2Rate}%`,  // Percentage of hits from PostgreSQL
      cacheSize: this.inMemoryCache.getSize(),
      persistentCacheEnabled: this.config.persistentCacheEnabled,
      redisConnected: this.redisCache?.isConnected() || false,
      postgresConnected: this.pgCache?.isConnected() || false,
    };
  }

  /**
   * Clear all caches (in-memory, Redis, PostgreSQL)
   */
  public async clear(): Promise<void> {
    // Clear in-memory
    this.inMemoryCache.clear();

    // Clear Redis
    if (this.redisCache) {
      await this.redisCache.clear();
    }

    // Clear PostgreSQL
    if (this.pgCache) {
      await this.pgCache.clear();
    }

    this.stats = { hits: 0, l1Hits: 0, l2Hits: 0, misses: 0, sets: 0, errors: 0 };
    console.log('[Cache] All caches cleared');
  }

  /**
   * Disconnect from persistent caches gracefully
   */
  public async disconnect(): Promise<void> {
    if (this.redisCache) {
      await this.redisCache.disconnect();
    }

    if (this.pgCache) {
      await this.pgCache.disconnect();
    }

    console.log('[Cache] Disconnected from persistent caches');
  }

  /**
   * Reset singleton (for testing)
   */
  public static async reset(): Promise<void> {
    if (ExtractionCacheManager.instance) {
      await ExtractionCacheManager.instance.clear();
    }
    ExtractionCacheManager.instance = null;
  }
}

/**
 * Get extraction cache manager instance
 */
export function getExtractionCache(): ExtractionCacheManager {
  return ExtractionCacheManager.getInstance();
}
